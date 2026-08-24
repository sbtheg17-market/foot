# Test coverage matrix — web, mobile, API

**Status:** Audited 2026-08-23 from the repository state at `origin/main`
`75396f2d997668666135f35243899c7705a9aa86`. This document records what exists, what
is missing, and the proposed CI/release matrix. **No CI workflow exists in the
repository today (`.github/` is absent), and no web or mobile test framework is
installed.** Nothing here claims coverage that is not in the repo.

> **Update 2026-08-24 (pre-#11 gate):** §1–§7 below are the historical
> pre-implementation audit, preserved unchanged — their "no CI / no web or mobile
> test framework" statements described `75396f2` and are no longer current. The
> matrix was implemented in roadmap item #10 (PR #46); see **§8** for the live
> 16-job CI workflow and the suites that actually run.

---

## 1. Current framework inventory

| Layer | Framework | Installed? | Notes |
|---|---|---|---|
| API (`@workspace/api-server`) | Node.js built-in test runner (`node --test`) + `tsx` loader + `node:assert/strict` | Yes | Only test framework in the repo |
| Web (`@workspace/web`) | None | — | `typecheck` (tsc) only; Vite present but no Vitest |
| Mobile (`@workspace/mobile`) | None | — | `typecheck` only; Expo; no jest-expo, no RNTL, no Detox/Maestro, no `eas.json` |
| E2E browser | None | — | No Playwright/Cypress |
| CI | None | — | No `.github/workflows`; deploy is Railway (`railway.json`, `nixpacks.toml`, `pnpm run build:deploy`, healthcheck `/api/healthz`) |
| Repo scripts | `scripts/check-github-sync.sh` (`git:check`), `scripts/verify-publication.sh` (`publish:gate`) | Yes | Shell gates, not tests |

### Test commands (package `@workspace/api-server`, all run from repo root)

Environment for integration suites: seeded scratch PostgreSQL
(`DATABASE_URL`, `JWT_SECRET`), `pnpm run db:push && pnpm run seed`, and a running
API server on `$PORT` (default expected `8080`; docs use `PORT=8001`).

| Command | File | Server/DB needed |
|---|---|---|
| `test` | `booking-state-machine.test.ts` | No (pure) |
| `test:integration` | `booking-concurrency.test.ts` | Server + PG |
| `test:rescheduling` | `rescheduling-enforcement.integration.test.ts` | Server + PG |
| `test:lifecycle` | `client-booking-lifecycle.integration.test.ts` | Server + PG |
| `test:availability` | `availability-preset.test.ts` | Server + PG |
| `test:pressure` | `booking-pressure.test.ts` | Server + PG |
| `test:authorization` | `authorization-hardening.integration.test.ts` | Server + PG |
| `test:client-retention` | `client-retention.integration.test.ts` | Server + PG |
| `test:reviews`, `test:care-history`, `test:role-state`, `test:provider-*`, `test:onboarding`, `test:reviewer-decisions`, `test:first-booking`, `test:marketplace-events` | corresponding `src/__tests__/*.integration.test.ts` | Server + PG |
| (no script) | `availability-enforced-booking.test.ts`, `payments-foundation.test.ts`, `listing-preview.integration.test.ts`, `prevented-booking-*.test.ts`, `prevented-bookings-daily-rebuild.test.ts`, `replay-safety-controls.test.ts` | Mixed; several pure (`payments-foundation`), most Server + PG |

28 test files total, all under `artifacts/api-server/src/__tests__/`.

---

## 2. Coverage matrix

Release-blocking = must pass before a production release once CI exists.

| Test area | Framework | Command | Files | Actually tested | Only typechecked | Needs server | Needs PostgreSQL | Needs auth setup | Needs native device | Missing coverage | Priority | Owner / action | Release-blocking |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Booking state machine | node:test | `pnpm --filter @workspace/api-server run test` | `booking-state-machine.test.ts` | All role/status transitions, terminal states, admin override (63 tests) | — | No | No | No | No | — (complete for current machine) | — | Keep green | Yes |
| Rescheduling enforcement | node:test | `run test:rescheduling` | `rescheduling-enforcement.integration.test.ts` | Ownership, state gating, missing/malformed/past time, availability fit, cross-client overlap, own duplicate, inactive service, happy path, reconfirm+re-reschedule, terminal lockout (12 tests) | — | Yes | Yes | Seeded demo accounts | No | Reschedule idempotent retry; marketplace-timezone DST boundary reschedules; admin-forced reschedule | High | API owner: extend suite | Yes |
| Booking concurrency | node:test | `run test:integration` | `booking-concurrency.test.ts` | Concurrent confirms/cancels/cross-actor races, ordered transitions incl. reschedule cycle | — | Yes | Yes | Seeded | No | Concurrent reschedule vs. create race assertion (advisory-lock path) | High | API owner | Yes |
| Booking creation & availability | node:test | `run test:availability`, `run test:pressure`, `availability-enforced-booking.test.ts` | 3 files | Preset save, slot generation, overlap/duplicate pressure | — | Yes | Yes | Seeded | No | Explicit DST nonexistent/repeated wall-clock cases (design requires them) | High | API owner | Yes |
| Authorization | node:test | `run test:authorization` (+ ownership cases inside other suites) | `authorization-hardening.integration.test.ts` | Role gates, ownership, approved-provider gate | — | Yes | Yes | Seeded | No | Token expiry/refresh lifecycle | Medium | API owner | Yes |
| Client lifecycle / retention / reviews / care history / role state / provider onboarding / notifications persistence / marketplace events / prevented bookings & replay | node:test | `run test:lifecycle`, `test:client-retention`, `test:reviews`, `test:care-history`, `test:role-state`, `test:provider-*`, `test:marketplace-events`, (unscripted replay/prevented files) | 18 files | End-to-end API flows against seeded server | — | Yes | Yes | Seeded | No | — | Medium | Keep green | Yes (existing 92+ suite) |
| Payments foundation primitives | node:test | `node --import tsx/esm --test src/__tests__/payments-foundation.test.ts` | `payments-foundation.test.ts` | Pure money/status primitives | — | No | No | No | No | Everything else is EXCLUDED (payments not live) | — | Excluded scope | No |
| Notification failure behavior | node:test | covered inside booking suites | — | Push failure never rolls back a transition (by design; asserted indirectly) | — | Yes | Yes | Seeded | No | Direct fault-injection test for push retry/failure path | Medium | API owner | No |
| Health endpoint | — | none | — | Nothing (Railway healthcheck `/api/healthz` exists but is untested) | — | Yes | Yes | No | No | Curl-level smoke assertion | Low | Add to CI smoke | Yes |
| API typecheck/build | tsc / esbuild | `pnpm run typecheck`, `pnpm run build` | workspace | Compile-time only | All API/web/lib code | No | No | No | No | — | — | Keep green | Yes |
| Web unit/component | **none** | — | 0 files | **Nothing** | All of `artifacts/web/src` | — | — | — | No | Booking flow, reschedule modal (slot pick, current-time block, 409 refresh paths), loading/error states, unauthorized redirects, timezone labels | **High** | Approve Vitest + React Testing Library (see §4) | Future yes |
| Web E2E/smoke | **none** | — | 0 files | **Nothing** | — | Yes | Yes | Seeded | No | Login → book → reschedule → reconfirm happy path; a11y scan | High | Approve Playwright later (see §4) | Future yes |
| Web accessibility | none | — | 0 | Nothing | — | — | — | — | No | Modal focus trap, `aria-*` on reschedule slots (markup exists, untested) | Medium | With web layer | Future |
| Timezone/DST display (web+mobile) | none | — | 0 | Nothing (server slot labels tested only via API suites) | UI code | — | — | — | Device TZ matters | Device-timezone ≠ marketplace-timezone rendering; DST boundary labels | High | With web/mobile layers | Future yes |
| Mobile unit/component | **none** | — | 0 files | **Nothing** | All of `artifacts/mobile` | — | — | — | Partially | Reschedule modal, booking screens, status feedback hooks | High | Approve jest-expo + RNTL (see §4) | Future |
| Mobile flows on device (booking, reschedule, push foreground/background, cold-start deep links `/booking/:id`, token lifecycle incl. logout removal, permission denial, native alerts, device timezones) | **none** | — | 0 | **Nothing verified on native devices** | — | Yes | Yes | Seeded | **Yes** | Everything; see §5 native verification | High | Manual checklist now; Maestro/Detox decision later | Future |
| iOS / Android export | Expo | `artifacts/mobile/scripts/build.js` (static export), no `eas.json` | — | Static export only | — | No | No | No | For real builds | EAS build config; store-level export untested | Medium | Operator decision on EAS | Future |
| Migrations in disposable DB | drizzle-kit | `pnpm run db:push` + `pnpm run seed` (local scratch only, per `docs/managed-db-release-gate.md`) | `lib/db` | Schema push + idempotent seed exercised manually | — | No | Yes (scratch) | No | No | Automated disposable-DB push+seed+suite job; rollback rehearsal is a managed-gate item (restore-based; frozen artifacts have no DOWN) | High | CI job (§3) | Yes |
| Secret scan / `git diff --check` | git | manual | — | Manual only | — | No | No | No | No | Automated CI step | Medium | CI job (§3) | Yes |

---

## 3. Required CI/release matrix (PROPOSED — not yet implemented)

No workflow file exists yet. **Do not treat this section as implemented.** Proposed
GitHub Actions pipeline, in dependency order; all jobs use a disposable PostgreSQL
service container and dummy secrets; no production access, no managed database, no
real notifications.

### Stage A — static (fast, always)
1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck` (libs + api + web + mobile via workspace filter)
3. `git diff --check` (whitespace) on the merge ref
4. Secret scan (gitleaks or `git grep` deny-list) — no credentials in tree
5. Builds: `pnpm run build` and `pnpm run build:deploy` (Railway parity)

### Stage B — API against disposable PostgreSQL
1. Service container `postgres:16`, `DATABASE_URL` scratch, `JWT_SECRET=ci-secret`
2. `pnpm run db:push` (migration application in disposable DB) + `pnpm run seed` twice (idempotency)
3. Start built server (`PORT=8001 NODE_ENV=production pnpm run start &`), wait on `/api/healthz` (health smoke)
4. Unit: `test` (state machine)
5. Integration: `test:rescheduling`, `test:integration` (concurrency), `test:availability`, `test:pressure`, `test:authorization`, `test:lifecycle`, remaining `test:*` scripts
6. Covers: booking state machine, rescheduling, authorization, concurrency, duplicate-idempotency (partial unique index), notification-failure tolerance (push is a no-op without Expo tokens — asserts transitions still succeed)

### Stage C — Web (once framework approved, §4)
Component tests (booking + reschedule modal states: loading, empty slots, 409 refresh,
unauthorized), accessibility checks (axe on modal), timezone display with mocked
marketplace TZ + DST boundary instants, then a Playwright smoke
(login → book → reschedule → reconfirm) against the Stage B server.

### Stage D — Mobile (once framework approved, §4)
`typecheck` (exists today) + static export build; component tests via jest-expo/RNTL
(reschedule modal, status feedback hooks, permission-denial branches); native-device
smoke stays a documented manual checklist (§5) until Maestro/Detox is approved.

### Stage E — Release gate (tag/release only)
All above green + `pnpm run publish:gate` + artifact provenance (record commit SHA,
lockfile hash, build artifact checksums in the release notes) + manual native
checklist sign-off + `docs/managed-db-release-gate.md` for any schema change
(rollback = restore rehearsal per the gate; never invented DOWN SQL).

---

## 4. Test-framework recommendation (smallest sustainable stack)

- **API: keep `node:test` + `tsx`.** Zero new dependencies; 28 suites already work.
  Do **not** introduce Vitest/Jest for the API.
- **Web: add Vitest + @testing-library/react + jsdom** when approved. Rationale: the
  web app is already Vite; Vitest reuses `vite.config.ts`, adds dev-only deps, no
  runtime impact. This is the single highest-value gap (0 web tests today).
- **Web E2E: Playwright**, second step after component tests, for the one booking →
  reschedule smoke; do not add Cypress alongside it.
- **Mobile: jest-expo + @testing-library/react-native** when approved (standard Expo
  pairing). **Detox is not recommended now** (heavy native build infra); **Maestro**
  is the lighter future option for device smoke since it needs no repo dependencies.
- **Not recommended:** adding Jest for web, multiple E2E frameworks, or any framework
  duplication "for completeness".

**Stop-for-review:** the web (Vitest/RTL) and mobile (jest-expo/RNTL) additions modify
`package.json` + lockfile with significant dev-dependency trees. Per session scope they
are **documented here and NOT installed**. Operator approval required before adding.

---

## 5. Native verification status (exact)

These are distinct levels; only the last two are native validation:

| Level | What it proves | Status in repo |
|---|---|---|
| Expo web verification (`expo start` web / browser) | React tree renders in a browser | Available locally; **not native validation** |
| Static export (`artifacts/mobile/scripts/build.js`) | Bundle compiles/export succeeds | Used in prior sessions; **not native validation** |
| Simulator/emulator (iOS Simulator / Android emulator) | Native runtime, alerts, deep links, foreground push UX | **Unavailable in this environment; never verified in recorded sessions** |
| Physical device (Expo Go or dev build) | Real push delivery, background/cold-start behavior, permission dialogs, device timezone | **Unavailable in this environment; never verified in recorded sessions** |

**Native-device behavior is NOT verified.** Future exact steps:

1. `pnpm --filter @workspace/mobile run dev` (Expo start) with the API reachable from
   the device; sign in with seeded demo accounts.
2. Verify: booking create/reschedule flows; foreground push (in-app receipt);
   background push (app backgrounded → notification tap routes to `/booking/:id`);
   cold-start deep link (kill app → tap push); permission denial (deny notifications →
   token registration remains non-fatal); logout removes the push token; native alerts
   in the reschedule modal; device timezone set to a non-marketplace zone shows
   marketplace-timezone labels.
3. Record device model, OS version, Expo SDK, app commit SHA in the release notes.
4. For store builds, add `eas.json` (operator decision) — none exists today.

---

## 6. Known blocked suites and exact setup requirements

Integration suites fail fast without: a scratch PostgreSQL (`DATABASE_URL`), pushed
schema, idempotent seed, `JWT_SECRET`, and a live server on `$PORT` (suites default to
`8080`; docs use `8001`). When blocked, report the exact connection/HTTP error — never
report blocked suites as passed.

---

## 7. Addendum — 2026-08-23: roadmap item 9 suites (implemented)

Recorded after the consent-first rescheduling implementation on
`feat/rescheduling-consent-workflow`. Rows below reflect suites that actually
ran against a disposable local PostgreSQL 15 + built server in this session.

| Test area | Command | Files | Result | Notes |
|---|---|---|---|---|
| Reschedule policy helpers (deadline math incl. DST-boundary instants, limit fallback) | `pnpm --filter @workspace/api-server run test` (now also runs this file) | `reschedule-policy.test.ts` | 7/7 pass | Pure; no server/DB |
| Booking state machine (updated: provider `confirmed → rescheduled` now forbidden) | same `test` script | `booking-state-machine.test.ts` | 63/63 pass | Unit total for `pnpm test`: 70/70 |
| Consent-first proposals (authz/404 non-leak, idempotency, single-pending, accept atomic history, decline feasibility, stale accept, lazy expiry, accept re-validation, concurrency storm, provider limit, cancellation interaction, no-show gating, history append-only) | `pnpm --filter @workspace/api-server run test:proposals` | `reschedule-proposals.integration.test.ts` | 17/17 pass | Server + PG |
| Rescheduling enforcement (updated: provider direct reschedule now 409 consent-required) | `run test:rescheduling` | `rescheduling-enforcement.integration.test.ts` | 12/12 pass | Server + PG |
| Full scripted regression (all 22 `test:*` scripts) | see §1 | 22 suites | all pass (e.g. concurrency 16/16, authorization 7/7, lifecycle 14/14, pressure 13/13) | Server + PG |
| Unscripted suites | direct `node --test` | 6 files | pass EXCEPT 1 known non-regression failure | `prevented-bookings-daily-rebuild.test.ts` contains a Session-080 changed-file-scope guard that diffs the tree against `main`; it fails BY DESIGN on any later feature branch and is not a behavior failure (25/26; the other 25 pass) |

Known environment facts, unchanged: no CI workflow yet (item 10), no web/mobile
test framework, native-device verification never performed.

---

## 8. Addendum — 2026-08-24: roadmap item 10 IMPLEMENTED (CI matrix + web tests)

Recorded on branch `test/web-mobile-ci-matrix` (base `origin/main`
`a911d2248b46b6f7ecd9945165d2b379acb69b99`, item 9 merged). §3's proposal is now
implemented in `.github/workflows/ci.yml`; §4's web recommendation is installed.
Statements below reflect suites that actually ran in the implementing session.

### Frameworks added (dev-only, web workspace; per §4 and the 2026-08-23 operator decision)

- **Web:** Vitest 4 + @testing-library/react 16 (+ jest-dom, user-event,
  @testing-library/dom peer) + jsdom 26 + axe-core. jsdom is pinned to v26:
  jsdom 30 requires an undici API absent from Node 20, the repo's engine.
- **Mobile:** NO jest-expo/RNTL (per the operator decision) — typecheck +
  deterministic Expo static exports (`export:ios`, `export:android` scripts).
- **API:** unchanged (`node:test` + `tsx`).

### CI workflow: `.github/workflows/ci.yml` (pull_request + push to main)

15 jobs plus a dedicated replay-isolation job (16 total), all deterministic, no
production secrets, no deploy, no managed DB:

| Job | Covers |
|---|---|
| `typecheck` | Full workspace typecheck (libs, api, web incl. test files, mobile, scripts) |
| `api-build` | esbuild API bundle + artifact existence |
| `deploy-build` | `pnpm run build:deploy` (Railway parity) + artifact existence |
| `api-tests` | Disposable postgres:15 service; db:push; seed ×2; built server; health; unit (state machine + reschedule policy); 16 scripted integration suites; 5 unscripted suites; NON-GATING labeled step for the daily-rebuild suite (contains the Session-080 branch-scope guard that fails by design off main) |
| `api-replay-tests` | Dedicated disposable DB for `prevented-booking-replay.integration.test.ts` — its DLQ subtests consume fixed seeded slot-pool positions, so any earlier booking suite on the same DB collides (duplicate 409) |
| `authz-concurrency` | `test:authorization`, `test:integration`, `test:pressure`, `test:rescheduling`, `test:proposals` on a disposable DB |
| `migration-checks` | Fresh db:push; idempotent re-push; seed ×2; frozen-artifact hash + no-destructive-DDL check; startup after migration |
| `web-tests` | 60 Vitest tests: booking modal, reschedule modal (client + provider consent proposal), proposal card (accept/decline/stale-409), marketplace-time, timezone hook |
| `accessibility` | `-t accessibility` subset: labeled dialog, focus entry, Escape (incl. mid-submit lockout), aria-pressed slots, non-color "current" marking, labeled regions, axe scans (color-contrast off — jsdom cannot compute it) |
| `timezone-dst` | Web marketplace-time suite (EDT/EST, 2026-03-08 spring-forward, 2026-11-01 fall-back, date boundary, labeled device fallback) + API pure reschedule-policy DST deadline math |
| `mobile-typecheck` | `tsc --noEmit` for the Expo app |
| `expo-export-ios` / `expo-export-android` | Deterministic static exports + `metadata.json` existence — explicitly NOT native validation |
| `smoke` | build:deploy; seeded server; `/api/healthz` 200; seeded login 200; critical booking/reschedule routes registered (401, never 404: `GET/POST /bookings`, `PATCH /bookings/:id/status`, `POST/GET /bookings/:id/reschedule-requests`, `GET /bookings/:id/rescheduling-history`); SPA served |
| `secret-scan` | `scripts/secret-scan.sh` deny-list over tracked files (GitHub/OpenAI/Stripe/AWS/Slack tokens, private keys, signed JWTs, non-local DB passwords; local scratch + documented test-fixture hosts allowed) |
| `git-diff-check` | `git diff --check` against the PR base (or `HEAD^` on main pushes) |

### Session validation results (local; disposable PostgreSQL 15 only)

- 22 scripted API suites: **295/295 pass** against a seeded scratch DB + built
  server. Unscripted suites: **71/71 pass on a fresh DB** (replay suite's DLQ
  subtests are single-run-safe only — fixed slot-pool positions persist as
  bookings; re-running on the same DB yields duplicate 409s; CI DBs are fresh).
- Daily-rebuild suite: 25/26 — the changed-file-scope guard fails BY DESIGN on
  this feature branch; preserved, run non-gating in CI.
- Web: 60/60; a11y subset 10/10; TZ/DST subset 10/10. Root `pnpm test`
  (new script: recursive `test`) passes (API 70 unit + web 60).
- Typecheck, `pnpm run build`, `pnpm run build:deploy`, secret scan,
  `git diff --check`: pass.
- Expo exports: pass locally with `--no-bytecode` (this container is arm64 and
  cannot execute the x86_64 `hermesc`); CI (x86_64) runs the full export with
  Hermes bytecode.
- The failing-a11y-test-driven fixes to `booking-modal.tsx` (axe `button-name`
  on the icon-only close button; axe `label` on the date input) are the only
  product-file changes: `aria-label`, `type="button"`, `aria-hidden` on the
  icon, and a `htmlFor`/`id` label association. No behavior change.

### Still true / not claimed

- Native devices: NEVER verified — see `docs/native-device-checklist.md`.
- Real-browser E2E (Playwright): not added; jsdom-level only (ledger follow-up).
- Reminders, payments, service-area enforcement, managed-DB migration: deferred
  (see `docs/TODO-LEDGER.md`).
