# Roadmap #12 Plan — Service-area eligibility + travel/setup buffer enforcement

## 1) Objectives
- Add **Canada-first FSA prefix allowlist** coverage for providers (configurable by provider; server-authoritative evaluation).
- Add **30-minute travel/setup buffer** between provider appointments (centrally managed default; env override; no per-provider override in this slice).
- Introduce **public booking eligibility step** at `/book/:slug` before service/slot selection with 5 states: `eligible | ineligible | needs_review | invalid | unavailable` and exact messages.
- Enforce both rules on: **POST /bookings**, **PATCH /bookings/:id/status (reschedule)**, **POST reschedule proposal create**, **POST proposal accept**.
- Ship additive-only schema + frozen SQL artifact + OpenAPI + generated clients + web + mobile parity + tests + CI + docs.

## 2) Implementation Steps

### Phase 1 — Core POC (server-only, prove core works end-to-end)
User stories:
1. As a client, I can check if my postal code is eligible before seeing services.
2. As a provider, I can add an allowed FSA prefix and immediately become eligible for public booking.
3. As a client, I’m blocked with a clear message if my FSA is outside the provider’s allowlist.
4. As the system, I reject bookings that violate a 30-minute buffer even if slots UI is stale.
5. As the system, reschedules/proposals are rejected if they violate service-area or buffer rules.

Steps:
1. **Websearch (best practices)**: postal/FSA normalization + allowlist patterns + privacy-safe eligibility responses.
2. Add **schema (Drizzle)** + **frozen SQL** `docs/migrations/PROVIDER_SERVICE_AREAS_V1.sql`:
   - `provider_service_areas` (providerId FK, country/province/city, publicDescription, enabled flag, created/updated)
   - `provider_coverage_areas` (id, providerServiceAreaId FK, type='fsa_prefix', prefix, createdAt) with uniqueness.
3. Implement server **pure evaluator**:
   - Normalize CA postal → FSA (trim, uppercase, remove spaces, validate pattern).
   - Return state + message; never return raw prefixes.
4. Add API endpoints:
   - Provider config: `GET/PUT /providers/me/service-area`, `POST /providers/me/service-area/prefixes`, `DELETE /providers/me/service-area/prefixes/:id`.
   - Eligibility checks: `POST /booking-pages/:slug/service-area-check`, `POST /providers/:providerId/service-area-check`.
5. Enforce on write paths:
   - `POST /bookings`: require eligibility `eligible` (or `needs_review`? per spec) + buffer conflict check.
   - `PATCH ... reschedule`, `POST proposal create`, `POST accept`: same enforcement.
6. Local disposable Postgres: run `pnpm db:push`, apply frozen SQL in tests (or verify via migration checks), seed, run a minimal integration test proving the eligibility+buffer core.

### Phase 2 — V1 App Development (web + mobile around proven core)
User stories:
1. As a client on `/book/:slug`, I see an eligibility step and know exactly what to do next.
2. As a client, once eligible, I can choose a service then see buffer-aware slots.
3. As a provider, I can configure my service area in the portal and see whether public booking is publishable.
4. As a client on mobile provider page, I’m blocked early with the same eligibility messages.
5. As a provider, publishing is prevented unless coverage is active.

Steps:
1. OpenAPI updates (`lib/api-spec/openapi.yaml`) for new schemas/endpoints + response contracts; run **orval codegen**.
2. Web:
   - New provider portal page `/provider/service-area` (list + add/remove prefixes, country/province/city, public description).
   - Public booking page `/book/:slug`: add stepper (eligibility → service → slots). Call slug-based service-area check.
   - Slots UI: reflect buffer by marking slots unavailable if within buffer of an existing booking (advisory) while server remains authoritative.
3. Mobile:
   - Update provider booking modal in `artifacts/mobile/app/provider/[id].tsx` to run eligibility check before enabling slot selection.
   - Add friendly handling for new error reasons from server (service-area invalid/ineligible/needs_review/unavailable; buffer conflict).
4. Publish gating:
   - `POST /providers/me/booking-page/publish` must require active service-area coverage enabled.
5. End Phase 2: run one full local E2E pass (seeded server on 8080):
   - eligible path → create booking
   - ineligible/invalid/unavailable messaging
   - buffer rejection

### Phase 3 — Comprehensive Testing + CI wiring + docs
User stories:
1. As a maintainer, I can run a single command and validate service-area/buffer rules.
2. As a maintainer, CI runs the new test suite without changing the job matrix size.
3. As a reviewer, I can see an additive-only migration artifact with hashes.
4. As a provider, I never leak my exact coverage list on public endpoints.
5. As a client, reschedule proposals respect the same rules as booking.

Steps:
1. Tests:
   - Unit: postal/FSA normalization + evaluator + buffer computation.
   - Integration: `service-area.integration.test.ts` (public booking page check, provider config endpoints, booking/reschedule/proposal enforcement).
   - Web vitest + a11y updates for new booking step + portal page.
   - Migration checks: ensure frozen SQL hash present and no destructive DDL.
2. CI:
   - Add new api-server test script and include it in the existing `api-tests` loop.
   - Ensure no new jobs; preserve 16-job matrix.
3. Docs updates (append-only where required):
   - `docs/service-area-travel-policy.md` (mark what is now enforced, keep deferred items explicit).
   - `docs/api-routes.md`, `docs/data-models.md`, `docs/ux-guidelines.md`, `docs/NEXT-STEPS.md`, `docs/TODO-LEDGER.md`.
   - `docs/neo/...handoff.md` append dated section for #12.
4. Validation checklist:
   - `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build:deploy`.
   - API integration suites on disposable Postgres + seeded server on 8080.
   - Expo exports (verify host arch; if arm64 use `--no-bytecode`).
   - `scripts/secret-scan.sh`, `git diff --check`.

### Phase 4 — Delivery (branch/PR/merge)
User stories:
1. As a reviewer, I get a single PR with clear scope + validation evidence.
2. As an operator, I can squash-merge safely with all checks green.
3. As a maintainer, no force-push occurs and history remains clean.
4. As a user, no unrelated features (payments, routing) appear.
5. As security, no private coverage data is exposed publicly.

Steps:
1. Create branch `feat/service-area-travel-enforcement`.
2. Commit in logical chunks (schema+sql, server, openapi+codegen, web, mobile, tests, docs).
3. Push branch + open PR **“feat: enforce provider service areas and travel buffers”**.
4. If push is blocked (no credentials), report exact blocker and required token steps.
5. Once CI passes, squash-merge (operator-authorized only).

## 3) Next Actions
- Confirm exact **eligibility-state mapping** for booking writes (is `needs_review` bookable or blocked?) and the exact **client-facing message strings** to use.
- Implement Phase 1 POC server core (schema+evaluator+enforcement) and get the first integration test green.
- After core is stable, implement web + mobile UX surfaces.

## 4) Success Criteria
- Public booking pages enforce eligibility step and show the 5 states with exact messages.
- All booking/reschedule/proposal paths reject invalid/ineligible service-area inputs and buffer violations server-side.
- Provider publish is gated on active service-area coverage.
- No public endpoint leaks raw provider coverage entries.
- Additive-only migration artifact exists and passes CI migration checks.
- All typecheck/build/tests pass locally and in CI; secret scan clean; no managed DB/deploy changes.
