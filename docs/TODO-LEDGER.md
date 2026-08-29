# TODO ledger — deferred and gated work (authoritative)

**Created 2026-08-24 during roadmap item 10 (test/CI matrix).** No single
authoritative TODO file existed before this date; deferred items were spread
across `docs/NEXT-STEPS.md`, `docs/test-coverage-matrix.md`,
`docs/managed-db-release-gate.md`, `docs/roadmap/*`, and the continuity record
`docs/neo/2026-08-21-client-retention-handoff.md`. This ledger consolidates
them. Append updates with dates; never silently delete an entry.

## Deferred product work (NOT implemented — do not mark complete)

| Item | Status | Notes / gate |
|---|---|---|
| Scheduled reminder delivery | DEFERRED — not implemented | No scheduler, no reminder jobs exist. Design remains open. |
| Native-device verification | DEFERRED — never performed | See `docs/native-device-checklist.md`. CI's Expo exports/typecheck are NOT native validation. |
| Payment/refund behavior | DEFERRED — not implemented | Only pure money/status primitives exist (`payments-foundation`); no provider selected, no checkout, no webhooks, no refunds/payouts/invoices changes. |
| ~~Service-area / travel enforcement~~ | ~~DEFERRED — design only~~ **CLOSED 2026-08-26** | Implemented and merged as roadmap #12 — PR #49 (merged 2026-08-25 as `a0083e7`) plus the 2026-08-26 completion PR (CI wiring, remaining fixture alignment, docs; PR #50). See the "Roadmap #12" section below and `docs/service-area-travel-policy.md` implementation record. |
| Cross-provider client-overlap policy change | DEFERRED — operator decision | `docs/booking-overlap-policy.md` recommendation unapproved; behavior unchanged. |
| Client notification persistence / email / SMS | DEFERRED — not implemented | Provider-only in-app unread persists; no client persistence, no email/SMS. |
| Production deployment | NOT AUTHORIZED | No CI job deploys. Railway config unchanged. |
| Managed-database migration/release | GATED — see `docs/managed-db-release-gate.md` | Backup/restore evidence and read-only managed catalog verification remain release blockers. Frozen artifacts (`docs/migrations/*.sql`) are additive-only, no DOWN, never auto-applied. |

## Roadmap item 10 follow-ups (added 2026-08-24)

| Item | Status | Notes |
|---|---|---|
| Full native device lab (iOS/Android simulators + physical devices) | OPEN | Prerequisite for closing the native-device row above; Maestro is the lighter automation candidate (no repo dependency). |
| Real notification delivery verification | OPEN | Requires physical devices and Expo push credentials; never verified. |
| Additional browser matrix (real-browser E2E) | OPEN | Web tests run in jsdom; a Playwright login→book→reschedule smoke against a seeded server is the next increment (framework not added to the repo yet — operator approval for the dependency). |
| jsdom-level a11y limits | OPEN | axe in jsdom cannot check color-contrast or real focus-trap behavior across browser paint; manual AT/browser audit still needed before release. |
| Unsupported CI environment cases | OPEN | (a) `prevented-bookings-daily-rebuild.test.ts` contains a Session-080 changed-file-scope guard that fails by design on any non-main tree — it runs as a labeled NON-GATING CI step; do not weaken or delete it. (b) `prevented-booking-replay.integration.test.ts` DLQ subtests consume fixed seeded slot-pool positions, so ANY booking suite that ran earlier against the same database collides (duplicate 409) — verified in the first CI run; the suite therefore has a dedicated CI job (`api-replay-tests`) with its own disposable database, and locally must run against a freshly reset scratch DB. (c) Expo export with Hermes bytecode requires x86_64 (`hermesc` linux64 binary); on arm64 hosts use `--no-bytecode` locally — CI runners are x86_64 and run the full export. (d) Package-level `typecheck` (e.g. mobile) needs `pnpm run typecheck:libs` first to build referenced lib d.ts outputs — the CI job does this. |
| Root `pnpm test` scope | INFO | Added 2026-08-24: runs the pure API unit suite and the web Vitest suite recursively. DB-backed integration suites remain per-package `test:*` scripts (documented in `docs/test-coverage-matrix.md`). |

## How to update

Append a dated row or strike-through with a date and the PR that closed it.
Deferred items above may only be closed by a session explicitly scoped to them.

## Pre-#11 release-readiness review — 2026-08-24

Full gate report: `docs/pre-11-release-readiness.md`. Verified `main`:
`17b1bf9589f9665630346af3a85d110debcd170a`. All deterministic checks re-run and
green (295 scripted + 71 unscripted API tests, 60 web, smoke, migration checks,
secret scan; 16/16 CI jobs green on `main`). Per-item detail for every deferred
entry — owner for all items: repository operator; last reviewed: 2026-08-24.

### Scheduled reminder delivery — DEFERRED
- **Why:** no scheduler/queue infrastructure exists; operator approval for the
  delivery design is required (`docs/rescheduling-policy.md` Part 2 item 7).
- **Files:** `artifacts/api-server/src/lib/reschedule-policy.ts`
  (`PROPOSAL_REMINDER_LEAD_MS` constant only), notification helpers in
  `artifacts/api-server/src/lib/`.
- **Depends on:** scheduling infrastructure decision; notification persistence
  decision. **Next action:** operator approves a scheduler design.
- **Done when:** reminders fire at the documented lead time, covered by
  deterministic tests, without email/SMS scope creep.

### Native-device verification — DEFERRED (never performed)
- **Why:** no iOS/Android simulator, emulator, or physical device in any
  recorded environment. CI's Expo exports/typecheck are NOT native validation.
- **Files:** `docs/native-device-checklist.md`. **Depends on:** device lab or
  physical devices + Expo push credentials.
- **Next action:** run the checklist on one iOS and one Android device.
- **Done when:** every checklist row has a dated sign-off with device/OS/SHA.

### Payments/refunds/payouts — DEFERRED
- **Why:** only pure money/status primitives exist (`test:` suite
  `payments-foundation`, 6 tests); no provider selected, no checkout, no
  webhooks. **Files:** `docs/payments-foundation.md`, API money helpers.
- **Depends on:** provider choice + compliance decisions.
- **Next action:** operator selects a payment provider and scope.
- **Done when:** end-to-end payment flow exists behind tests and a rollout gate.

### Service-area/travel enforcement — DEFERRED (design only)
- **Why:** `docs/service-area-travel-policy.md` is approval-gated; current
  behavior is descriptive only. **Depends on:** operator approval of the policy.
- **Next action:** approve/revise the policy doc, then a scoped implementation.
- **Done when:** feasibility checks are enforced with tests, per approved policy.

### Production deployment — NOT AUTHORIZED
- **Why:** no deployment authorization; CI intentionally has no deploy job.
- **Files:** `railway.json`, `nixpacks.toml`, `Procfile` (all unchanged);
  `deploy-build` CI job proves Railway build parity only.
- **Next action:** operator decision. **Done when:** explicitly authorized,
  with the managed-DB gate satisfied first.

### Managed database migration/release — GATED
- **Why:** `docs/managed-db-release-gate.md` blockers (backup/restore evidence,
  read-only managed catalog verification) remain open. Frozen artifacts
  (`docs/migrations/*.sql`) are additive-only, hash-checked in CI, never
  auto-applied. **Next action:** satisfy the gate's evidence steps.
- **Done when:** the gate document's checklist is complete and signed off.

### Real-browser E2E (Playwright) — OPEN (not implemented)
- **Why:** web tests run in jsdom (axe cannot compute color-contrast; no real
  focus-trap/paint verification). Dependency addition needs operator approval.
- **Next action:** approve Playwright as a dev dependency; add a seeded-server
  login → book → reschedule smoke. **Done when:** the browser smoke runs in CI.

### CI status badge — OPEN (not implemented)
- **Why:** cosmetic; not part of item #10's scope. **Files:** `README.md`.
- **Next action:** add the workflow badge to README in any docs-scoped session.
- **Done when:** README shows live CI status for `main`.

### Environment-specific limitations (recorded facts)
- arm64 hosts must use `expo export --no-bytecode` (x86_64 `hermesc`); CI
  runners are x86_64 and run full exports.
- The replay/DLQ suite needs a booking-free slot pool → dedicated CI job
  (`api-replay-tests`); locally reset the scratch DB first.
- The Session-080 changed-file-scope guard
  (`prevented-bookings-daily-rebuild.test.ts`) fails by design off `main`
  (non-gating, labeled, in CI). **2026-08-24 fix:** the API server's runtime
  DLQ directory `artifacts/api-server/var/` was untracked-and-unignored and
  tripped this guard even on a clean `main` checkout after any server run; it
  is now gitignored (file-hygiene fix, no runtime change). External
  test-harness reports (`/test_reports/`) are likewise ignored to keep agent
  tooling out of the repository.

### Stale open PR #2 — OPERATOR DECISION
- `docs: record Session 068 publication verification` (2026-08-11, branch
  `docs/session-069-publication-record`, +38 lines to `.agents/LOG.md` and
  `.agents/NEXT_TASK.md`). Its `.agents/NEXT_TASK.md` payload is long
  superseded (it gates on the client booking-lifecycle slice, done many
  sessions ago); merging now would regress the task ledger. Recommendation:
  close without merging, preserving the branch as the historical record. Not
  closed in this gate (branch/PR disposition left to the operator).

## Roadmap #11 — provider public booking pages — 2026-08-25

Implemented in `feat/provider-public-booking-pages` (operator-defined scope:
provider-owned public booking pages and shareable conversion links). Canonical
public page `/book/:slug` (API `GET /booking-pages/:slug`), explicit
publish/unpublish (default unpublished; non-leaking generic 404 for
missing/unpublished/inactive/invalid slugs), immutable kebab-case slug with
deterministic collision suffix, dashboard share card (copy/native
share/preview/QR encoding the canonical URL + `source=qr-card`), allowlisted
booking `source` attribution (`instagram|qr-card|text|facebook|website`,
stored on bookings, dropped when unknown, never authorization-relevant), and
frozen additive artifact `docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql`.
Booking reuses the existing slots/bookings path — no duplicated booking logic.
Marketplace discovery stays separate at `/providers`.

### Deferred follow-ups from #11 (NOT implemented — do not mark complete)

| Item | Status | Notes |
|---|---|---|
| Slug rename + redirect/history policy | DEFERRED | Slugs are immutable after first publish in this release; renaming a published URL needs a redirect policy first. |
| Custom domains for booking pages | DEFERRED | Out of #11 scope. |
| Per-channel attribution analytics dashboard | DEFERRED | `bookings.source` is durably recorded; no aggregation/dashboard was built (advanced analytics excluded from #11). |
| Referral programs / payouts | DEFERRED | Explicitly excluded by the #11 authorization. |
| Marketplace ranking | DEFERRED | Explicitly excluded by the #11 authorization. |

## Roadmap #12 — service-area eligibility + travel/setup buffer — 2026-08-26

Implemented in `feat/service-area-travel-enforcement`. PR #49 (the full
feature) was squash-merged to `main` on 2026-08-25 as `a0083e7`; a follow-up
completion PR from the same branch (2026-08-26, PR #50,
https://github.com/sbtheg17-market/foot/pull/50) closed the three CI
regressions PR #49 merged with (pure-unit `DATABASE_URL` guard for the
DB-free timezone-dst job, travel-buffer-aware slot spacing in the replay/DLQ
fixture pool, buffer-clear times in the proposals acceptance-revalidation
fixture), wired `test:service-area` into the `api-tests` CI job (it was
missing), and recorded the implementation in the docs listed below.

Scope shipped: Canada-first provider-managed FSA (postal-prefix) coverage
(`provider_service_areas` + `provider_coverage_areas`, frozen artifact
`docs/migrations/PROVIDER_SERVICE_AREAS_V1.sql`); country/province-aware
postal normalization; server-authoritative eligibility states
(`eligible | ineligible | needs_review | invalid | unavailable`) with
allowlisted reason codes; public eligibility check BEFORE service/slot
selection on `/book/:providerSlug` and in the marketplace/mobile booking
modal; provider "Areas you serve" portal page (`/provider/service-area`);
privacy-safe public service-area summary (raw prefix list never public);
centrally managed 30-minute travel/setup buffer enforced on booking creation,
client immediate reschedules, provider proposal creation, and proposal
acceptance; publishing a booking page requires active coverage. Existing
confirmed bookings are never silently cancelled by coverage changes.

### Deferred follow-ups from #12 (NOT implemented — do not mark complete)

| Item | Status | Notes |
|---|---|---|
| Provider-specific buffer override | DEFERRED | Buffer is centrally managed: 30-minute default, environment override `TRAVEL_SETUP_BUFFER_MINUTES` (validated 0–240; invalid values throw at resolution, never a silent fallback). No per-provider setting. |
| Countries beyond Canada | DEFERRED | Schema/API are country-aware but only `CA` is accepted; expansion needs per-country normalization rules. |
| Routing / geocoding / radius / polygons / coordinates | DEFERRED | Explicitly excluded by the #12 authorization; nothing was implemented or stored. |
| Maximum daily appointment caps | DEFERRED | Explicitly excluded by the #12 authorization. |
| Manual-review workflow tooling | DEFERRED | `needs_review` routes clients to contact the provider/support; no admin queue exists. |
| Coverage-change review of existing bookings | DEFERRED | Coverage changes affect future bookings/reschedules only; no proactive review of already-confirmed visits. |

## Roadmap #13 — cancellation/no-show policy + minimal support (2026-08-26)

Implemented and merged from `feat/cancellation-no-show-policy` (spec:
`docs/roadmap-13-cancellation-no-show-continuity.md`, draft PR #51 — doc only,
no prior code recovered). See `docs/cancellation-no-show-policy.md` for the
implementation record.

| Item | Status | Notes |
|---|---|---|
| Cancellation policy states + server enforcement | DONE 2026-08-26 | `client_cancelled_early/late`, `provider_cancelled`, `cancelled_by_support`; notice window `CANCELLATION_NOTICE_HOURS` (default 24h, validated). |
| No-show time-passed rule + marking metadata | DONE 2026-08-26 | Provider-only, confirmed-only, after scheduled time; `no_show_marked_by/at`. |
| Append-only `booking_outcome_history` | DONE 2026-08-26 | Frozen artifact `CANCELLATION_NO_SHOW_SUPPORT_V1.sql`; disposable-PG tested. |
| Minimal support workflow (API-first) | DONE 2026-08-26 | Escalations linked via `support_tickets.booking_id`; admin-role view/mediate/correct/suspend; audit-logged. NO dedicated support dashboard UI (by design). |
| Cancellation fees / refunds / payments | DEFERRED — unchanged | Late cancellations are recorded only; zero money behavior. |
| Support SLAs, queues, assignment | DEFERRED | Minimal open→in_progress→resolved only. |
| Automated no-show detection / reliability scoring | DEFERRED | Not built. |
| Escalation notifications (email/push to support) | DEFERRED | Escalations are visible via the support API only; no delivery guarantees exist repo-wide. |

**2026-08-26 completion note (PR #52 validation):** the branch's first CI run
failed one job (`Authorization, concurrency and idempotency`) because three
pre-#13 regression suites still used the old cancellation contract —
provider cancels without the now-required allowlisted `reasonCategory`, and a
no-show marked before the scheduled time had passed. Aligned
`booking-concurrency.test.ts`, `booking-pressure.test.ts`, and
`reschedule-proposals.integration.test.ts` with the #13 contract (test-only
change; no production code touched). Migration artifact re-verified against
disposable PostgreSQL: main schema + `CANCELLATION_NO_SHOW_SUPPORT_V1.sql`
is semantically identical to the branch's pushed schema. Full local
validation green (typecheck, build, build:deploy, root tests, all scripted +
unscripted API suites, replay/DLQ, web/a11y/tz, smoke incl. the five new #13
routes, secret scan, `git diff --check`).

## Pilot readiness — Southern Ontario controlled pilot — 2026-08-26

Implemented in `feat/pilot-readiness` (operator authorization + four recorded
configuration decisions). See `docs/pilot/pilot-readiness-report.md` for the
authoritative status table.

| Item | Status | Notes |
|---|---|---|
| Support contact path | DONE 2026-08-26 | `GET /api/support/contact` (SUPPORT_CONTACT_URL > SUPPORT_CONTACT_EMAIL > placeholder, invalid values throw); footer links on public booking page + provider portal; escalation drill tested. |
| Real-browser smoke test | DONE 2026-08-26 — ON-DEMAND, NOT CI-GATED (operator decision) | `pnpm run smoke:real-browser` (Playwright/Chromium, 13 steps). Closes the "Real-browser E2E (Playwright) — OPEN" row above in its approved on-demand form; a CI-gated browser job remains OPEN if ever wanted. |
| Native-device EMULATION checks | DONE 2026-08-26 | `pnpm run smoke:mobile-emulation` (iPhone 13/WebKit, Pixel 5/Chromium, PST tz, deep link, 3G throttle). |
| Native-device verification (hardware) | STILL DEFERRED — never performed | Manual script now exists: `docs/pilot/native-device-hardware-test-script.md`; run on real iOS 16+/Android 12+ before pilot day 1. |
| External uptime/error alerting | BLOCKED — external accounts | Procedures documented in `docs/pilot/monitoring-setup.md`; manual daily check accepted for the pilot. |
| Backup/restore drill (disposable PG) | DONE 2026-08-26 | Dump 181 ms / restore 659 ms / integrity match; RTO ≤30 min, RPO ≤24 h documented. Managed-host backup confirmation remains an operator action; managed DB not accessed. |
| Secret rotation | DONE 2026-08-26 | Inventory + procedures + live JWT_SECRET drill (old token 401, new login 200) in `docs/pilot/secret-rotation-procedure.md`. |
| Incident response runbook | DONE 2026-08-26 | P0–P3, comms templates, post-incident template in `docs/pilot/incident-response-runbook.md`. |
| Provider onboarding package | DONE 2026-08-26 | `provider-onboarding.md`, `provider-setup-checklist.md`, `provider-faq.md`. |
| Pilot operator actions before day 1 | OPEN | Set real SUPPORT_CONTACT_EMAIL; hardware test run; uptime monitor account (or manual daily check); managed-DB backup confirmation. |
| Payments, reminders, production deployment | UNCHANGED | Deferred / NOT AUTHORIZED as recorded above. |

## Provider dashboard — conversion-first provider experience — 2026-08-27

Implemented in `feat/provider-dashboard`. See `docs/provider-dashboard.md`
for metric definitions, thresholds, and honest-scope decisions.

| Item | Status | Notes |
|---|---|---|
| `GET /providers/me/dashboard` + `GET /providers/me/metrics` | DONE 2026-08-27 | Approved-provider gate; read-only; audit-logged access; privacy-trimmed names (first + last initial) and FSA/city locations. |
| `/provider/dashboard` web page | DONE 2026-08-27 | Canonical route (`/provider` redirects); greeting/today/next, quick actions, 7/30-day upcoming toggle, metrics, booking-link tools + source chart, collapsible activity, earnings preview. Loading/error/empty states; axe-tested. |
| Source-attribution chart | DONE 2026-08-27 | Dependency-free CSS bars; label + count as text; no chart library added. |
| Earnings preview | DONE 2026-08-27 | "Coming soon"; estimate = completed-this-month × service price; `available: false` until payments exist. |
| Tests + CI | DONE 2026-08-27 | `test:provider-dashboard` (13 subtests) wired into the CI scripted loop; 15 web tests incl. two axe scans. |
| Emergency availability / block-off dates quick actions | DEFERRED | Requires a date-specific availability-exceptions model (current schema is weekly windows only). No fake buttons shipped. |
| Calendar view for upcoming bookings | DEFERRED | List + 7/30-day toggle shipped; calendar only if providers ask. |
| On-time rate metric | DEFERRED | Appointment start times are not tracked anywhere in the schema. |
| Average rating on dashboard | DEFERRED | Reviews exist; deferred until review volume is meaningful for 5 pilot providers. |
| Dashboard response caching | DEFERRED | Single-query read is cheap at pilot scale. |

## Registration "Internal server error" blocker — FIXED 2026-08-27

Mobile registration (Samsung/Android Chrome, 2026-08-26 test) failed with a
generic "Internal server error". Root cause: a TOCTOU race in
`POST /auth/register` — two concurrent identical submissions (mobile
double-tap fires before the submit button's pending state renders) both
passed the duplicate-email SELECT pre-check; the losing INSERT violated the
`users.email` unique constraint and the unhandled PostgreSQL error surfaced
as 500 via the global handler.

| Item | Status | Notes |
|---|---|---|
| API: 23505 unique-violation → safe 409 | DONE 2026-08-27 | Same conflict copy as the pre-check; other failures still 500. `artifacts/api-server/src/routes/auth.ts`. |
| Web: synchronous duplicate-submission guard | DONE 2026-08-27 | `submittingRef` in `register.tsx`; button-disable via isPending lags one render. |
| Web: safe error UX | DONE 2026-08-27 | 5xx → "We couldn't create your account right now. Please try again." + support contact link; 409 → account-exists + sign-in guidance; 400 → field-specific messages; focus moves to the alert; label/id + autoComplete added. |
| Tests | DONE 2026-08-27 | `test:registration` (12 API subtests incl. 4-way concurrent race, wired into CI scripted loop); 12 web tests incl. axe. Independent E2E verification: concurrent race 1×201 + N×409, mobile-viewport (360×800) registration + double-tap pass. |
| Rate limiting on auth endpoints | DEFERRED | Not required to fix this defect; consider before public launch. |

## Provider signup provisioning failure — FIXED 2026-08-28

After PR #55, mobile testing still failed with the safe generic error — but
only for "I'm providing care". Root cause: Drizzle's insert builder lists
EVERY schema column (`values (default, …)`), so on a deployed database whose
newest additive provider columns are still pending the frozen Gate B
migrations (`provider_profiles.public_slug`/booking-page columns from #11;
`provider_applications.rejection_reason` has no frozen artifact at all), the
provider-only provisioning INSERT failed with 42703 "column does not exist"
→ 500. Client signup never touches those tables, so it kept working. The
failure occurred AFTER the user INSERT inside the transaction; rollback was
clean (no orphaned users). Reproduced deterministically on a disposable
PostgreSQL with those columns dropped (client 201 / provider 500 before the
fix; both 201 after).

| Item | Status | Notes |
|---|---|---|
| API: provisioning inserts name only signup-required columns | DONE 2026-08-28 | `provider_profiles (user_id)` + `provider_applications (user_id, provider_profile_id)` explicit-column SQL inside the same transaction; all other columns have DB defaults. Signup no longer depends on post-signup feature columns. `artifacts/api-server/src/routes/auth.ts`. |
| Web: provider post-signup next step | DONE 2026-08-28 | One-time "Your provider account is ready" notice on `/onboarding/provider` (honest: review required before the listing goes live). |
| Tests | DONE 2026-08-28 | `test:registration` now 15 subtests: drift-simulation (Gate B pending columns) 201 + records verified; trigger-forced provisioning failure → safe 500, full rollback, retry 201; 4-way concurrent provider race → one 201/one profile+application. 2 new web tests. |
| Gate B reminder | OPEN | Full provider features (#11 booking pages, rejection reasons) still require the frozen migrations to be applied to the managed DB under Gate B. Signup no longer blocks on them. |

## Graphify continuity workflow (developer/agent tooling only)

| Item | Status | Notes |
|---|---|---|
| Graphify knowledge graph | DONE | Local, code-only AST extraction (`graphify extract . --code-only` + `cluster-only --no-label`, no external APIs). Committed artifacts: `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`, `manifest.json`. Not a runtime/CI/deploy dependency. `docs/graphify-continuity-workflow.md`. |
| Docs/PDF/image semantic extraction | DEFERRED | Requires a configured LLM backend and explicit operator privacy approval. Code + SQL migration artifacts are covered by the deterministic build. |
| LLM community naming | DEFERRED | `GRAPH_REPORT.md` shows `Community N` placeholders (`--no-label`). Optional later with an approved backend. |
| Auto graph Git hooks / CI rebuild | NOT ENABLED | By policy; manual refresh after major merged work only. |

## Provider verification onboarding recovery — 2026-08-28

Root cause evidenced on disposable PostgreSQL: `getOwnProfile()` bare
`select()` emitted the Gate B-pending `provider_profiles` booking-page
columns → 42703 → unhandled 500 on both `/providers/me/verification` routes,
**before** validation/persistence (no orphaned records ever existed). Full
record: `docs/provider-verification-onboarding-policy.md`.

| Item | Status | Notes |
|---|---|---|
| API: verification routes drift-safe | DONE 2026-08-28 | Narrow signup-era column select (`id`, `verification_status`) mirrors the PR #56 convention; GET+POST work on current and pre-Gate-B schemas. `artifacts/api-server/src/routes/providers.ts`. |
| API: bounded validation | DONE 2026-08-28 | `docType` allowlist; reference 3–200 chars; notes ≤ 1000; type-checked bodies; client-safe 400s; nothing persisted on invalid input. OpenAPI bounds added; clients regenerated. |
| API: transactional idempotent submission | DONE 2026-08-28 | Profile row lock serializes double-taps; identical pending submission returns the existing record (4-way concurrency test: exactly one record); insert + pending→under_review bump commit/roll back together; rejected docs allow resubmission. |
| Frozen artifact: rejection_reason | DONE 2026-08-28 | Closes the OPEN 2026-08-28 gap above: `docs/migrations/PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` (additive, no IF NOT EXISTS per gate policy). Disposable-PG: fresh apply PASS, re-apply fails loudly (expected), push×2/seed×2 PASS. Managed DB NOT accessed — Gate B-pending. |
| Web/mobile conversion UX | DONE 2026-08-28 | Honest purpose/success copy, safe recoverable-failure copy + support link, focus to error alert, double-tap guard, values preserved, mobile-width E2E PASS (incl. under drift). Onboarding + portal credentials + Expo parity. |
| Tests | DONE 2026-08-28 | New CI-gated `test:verification` (13 tests) + 11 web tests (`provider-verification-step`, incl. axe). Regression: registration 15, onboarding 23, provider-application 8, authorization 7, service-area 30, cancellation 22, booking-page 17, rescheduling 12, lifecycle 14, integration 16 — all PASS. Mobile emulation 9/9; real-browser smoke 13/13. |
| AUDIT FOLLOW-UP: bare-select getOwnProfile | OPEN 2026-08-28 | ~24 other `/providers/me/*` portal routes (services, availability, travel zones, service-area config, listing preview, booking-page mgmt) still select every profile column and would 500 for approved providers on a pre-Gate-B database. Booking-page routes legitimately need the #11 artifact; the rest could adopt narrow selects in a follow-up. Deliberately not broadened here. |

## Pilot Operations Dashboard (admin-only, three parts) — 2026-08-28

| Item | Status | Notes |
|---|---|---|
| Part 1: metrics API + retention storage | DONE 2026-08-28 | `GET /admin/pilot/metrics` + `PATCH /admin/pilot/providers/:id/retention` under the admin gate; vertical-neutral activation/outcome/source/retention metrics; frozen artifact `PILOT_PROVIDER_RETENTION_V1.sql`; CI-gated `test:pilot-metrics` (14 tests). `docs/pilot/pilot-metrics-dashboard.md`. |
| Part 2: `/admin/pilot` UI + CSV export | DONE 2026-08-28 | PR #62: platform-admin-only page over the Part 1 hooks (no duplication); summary cards, activation ladder, provider health table, retention control, dependency-free source chart, review prompts, privacy-safe client-side CSV; 34 new web tests + axe. `docs/pilot/pilot-metrics-dashboard.md` (Part 2 section). |
| Part 3: weekly review pack + closure | DONE 2026-08-28 | PR #63: `docs/pilot/weekly-pilot-review.md` (weekly review workflow, review-record template, decision rules, closure criteria), Part 3 operator guide + closure block in `docs/pilot/pilot-metrics-dashboard.md`, Graphify refresh at `96b7102`, continuity records. Docs-only; smoke re-verified (401/403/200, retention upsert, privacy-safe payload). |
| Pilot cohort/allowlist | DEFERRED | `approvedProviders` counts ALL approved profiles; introduce an explicit cohort before relying on rates once non-pilot providers exist. |
| Metrics on pre-Gate-B DBs | DOCUMENTED | The metrics read reads `booking_page_published` (#11 Gate B-pending column); internal admin tool requires current schema. |

### Pilot Operations Dashboard — continuity handoff (2026-08-28)

```text
Pilot Operations Dashboard status:
Part 1 metrics API + retention storage: COMPLETE
Part 2 admin UI + chart + CSV: NOT STARTED
Part 3 weekly review pack: NOT STARTED

Baseline main SHA: 6f5778198470c70e763e8d8ee54003c5662d17f8
Current branch: main (Part 1 merged via PR #60)
Current head SHA: d7dcf115f39e8e2eddc8362f1347da1a4992079c
Uncommitted files: NONE
Committed files: 34 files in PR #60
PR: https://github.com/sbtheg17-market/foot/pull/60 — MERGED
Migration artifact: docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql (frozen,
  additive; sha256 ceaac6d5…bf90cad; Gate B-pending; managed DB NOT accessed)
API routes: GET /api/admin/pilot/metrics;
  PATCH /api/admin/pilot/providers/:providerId/retention
Metric definitions implemented: window fallback, activation milestones/ladder,
  outcome + repeat-client rates, source attribution, escalations, retention
  rollup, risk flags (vertical-neutral)
Authorization behavior: admin-only (requireAuth + requireRole("admin")),
  401/403 test-enforced, audit-logged
Privacy boundaries: redaction test-enforced (no client identity/addresses/
  notes/document references/tracking parameters)
Tests passed: CI 16/16 GREEN on merged SHA d7dcf11 (incl. test:pilot-metrics)
Tests not run: none outstanding; no local rerun in the handoff session
CI status: GREEN
Exact next action: Part 2 /admin/pilot UI from current main; do NOT rebuild
  Part 1
```

```text
Strategic boundary:
This is a platform-admin pilot dashboard.
Organization-admin/workspace/workforce functionality remains FUTURE and NOT IMPLEMENTED.
Provider-facing dashboard remains FUTURE and is not part of this branch.
```

### Pilot Operations Dashboard — Part 2 handoff (2026-08-28)

Part 2 (`/admin/pilot` UI + CSV) is implemented on
`feat/pilot-operations-dashboard-ui` (PR #62, baseline main
`4285bb8991b4d9abbc3bac0d8f486e4b6b9e0401`). Full status block and Part 3
handoff (weekly review pack — NOT STARTED; files Part 3 must not duplicate):
`docs/pilot/pilot-metrics-dashboard.md` (Part 2 section). Strategic
boundary unchanged: platform-admin tool; organization/workspace/workforce
functionality remains FUTURE and NOT IMPLEMENTED (see
`docs/neo/2026-08-21-client-retention-handoff.md`).

### Pilot Operations Dashboard — Part 3 closure (2026-08-28)

Part 3 (weekly review pack + closure) is COMPLETE on
`docs/pilot-operations-review-pack` (PR #63, baseline main
`96b7102694d656112d9e486205d4850333040918`) — documentation, continuity,
verification, and closure only; Parts 1–2 were not rebuilt or modified.
Deliverables: `docs/pilot/weekly-pilot-review.md` (12-step 15–30 minute
weekly review, privacy-safe review-record template, cautious decision
rules, continue/iterate/pause closure criteria with the small-numbers
caveat), the Part 3 dashboard operator guide and closure status block in
`docs/pilot/pilot-metrics-dashboard.md`, refreshed Graphify artifacts at
`96b7102` (code-only local; keyword + value secret scans clean), and the
continuity records in `docs/NEXT-STEPS.md`, the Neo handoff, and
`.agents/LOG.md`. Verified from current main on a seeded disposable local
PostgreSQL 15: typecheck/build/build:deploy PASS; root tests PASS
(api unit 132/132, web 180/180); `test:pilot-metrics` 14/14 PASS;
`test:authorization` 7/7 PASS; dashboard smoke 401/403/200 + retention
upsert + privacy-safe payload PASS; diff check + secret scan PASS.
Managed DB NOT accessed; production deployment NOT authorized. All three
pilot-dashboard parts are CLOSED — the dashboard is now operated weekly per
`docs/pilot/weekly-pilot-review.md`, and the pilot cohort/allowlist and
pre-Gate-B rows above remain the only standing dashboard ledger items.

```text
Strategic boundary record (2026-08-28, Part 3 closure — append-only):
Current dashboard: platform-admin pilot dashboard only — IMPLEMENTED.
Organization administrator/workspace/workforce management: documented-only,
  NOT IMPLEMENTED.
Provider-facing pilot dashboard: FUTURE, NOT IMPLEMENTED.
Do not infer organization, tenant, provider affiliation, client-group, or
  delegated-admin support from the current dashboard.
Future conversion direction: Provider Approval Status Page, then Provider
  Dashboard, then Availability Exceptions — guided by pilot evidence.
```

### Provider Approval Status & Activation Hub (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Approval Status & Activation Hub | DONE 2026-08-28 | PR #64: `/provider/application-status` evolved into the guided hub (status hero, 9 true milestones, next-action, verification recovery, readiness cards, BookingPageCard share section, value/help sections). New owner-scoped read-only `GET /providers/me/activation-status` (no schema change). `test:activation-status` 11/11 + 15 web tests; regressions 182/182; mobile smoke 10/10 @390×844. |
| Expo-native activation hub parity | DEFERRED | Mobile app keeps the existing application-status screen (unchanged `/application/status` API). Bring hub milestones/next-action to Expo when provider mobile usage justifies it. |
| Provider Dashboard gap-closure | NEXT MAJOR PROVIDER SURFACE (FUTURE) | Existing `/provider/dashboard` already covers today/next/outcomes/share/activity. Remaining per roadmap: quick availability actions, reschedule/cancel/no-show actions from the dashboard, support entry point. Build after hub evidence from pilot weekly reviews. |
| Graphify artifact refresh post-merge | TODO | Refresh after PR #64 merges (continuity workflow: refresh after major merged roadmap work). Current baseline `96b7102`. |

```text
Conversion candidate observed while building the hub (documented only — NOT implemented):
Problem observed: providers without a social/web presence have no low-effort
  offline way to share their booking link; the hub/share card offers link,
  native share, and on-screen QR only.
Provider value: printable one-pager/QR card to hand to clients or post at a
  clinic/pharmacy corkboard — offline client acquisition for mobile foot care.
Client value: an easy, trusted route to the booking page without typing a URL.
Evidence needed: weekly pilot reviews showing published-but-no-booking
  providers whose stated blocker is "nowhere to share the link"; direct
  provider requests for printable material.
Dependency: existing booking-page QR feature (#11); no backend work expected.
Recommended priority: after Provider Dashboard gap-closure; only with pilot
  evidence.
```

### Provider Dashboard read-only overview (2026-08-28 — docs only)

| Item | Status | Notes |
| --- | --- | --- |
| Dashboard conversion blueprint | DONE 2026-08-28 | `docs/provider-dashboard-readonly-overview.md` + capability inventory + conversion playbook + future boundaries + static labeled wireframe. Zero runtime change. Truth recorded: initial `/provider/dashboard` already IMPLEMENTED (PR #54); blueprint covers evolution only. |
| Phase A completion — next-best-action card + pending-reschedule count on dashboard | READY TO IMPLEMENT NEXT | Wire existing `GET /providers/me/activation-status` `nextAction` + booking-row `rescheduled` count into `/provider/dashboard`. No new schema. Recommended next actual build. |
| Availability Exceptions (block-off, emergency openings) | FUTURE / DEFERRED (Phase B) | First new model in the roadmap; extend the existing availability engine + buffers; gate on weekly-review evidence of real demand. |
| Dashboard trends / true event-history timeline | FUTURE / DEFERRED (Phase C remainder) | Only if providers ask "am I improving?" in weekly reviews. No analytics pipeline authorized. |
| Provider Offer & Engagement system | FUTURE / DEFERRED (Phase D) | Constraints pre-recorded in `provider-dashboard-future-boundaries.md` (consent, caps, no fake scarcity, moderation, audit). Reminders remain demand-gated per existing decision rule. |
| Organization/workspace expansion | FUTURE / DEFERRED (Phase E) | NOT IMPLEMENTED; compatibility documented without tenancy work. |

### Provider Dashboard Phase A — actions wiring (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Phase A completion — next-best-action card + pending-reschedule visibility | DONE 2026-08-28 | `feat/provider-dashboard-phase-a-actions`: existing `/provider/dashboard` evolved (not rebuilt). Next Best Action card reuses `GET /providers/me/activation-status` `nextAction` (existing hook, shared query key); Pending Reschedules card fed by `pendingReschedules { count, nextRequest }` added to the existing `GET /providers/me/dashboard` read model (derived from rows already loaded — no new endpoint, no schema change). Deep links: existing provider routes, dashboard BookingPageCard scroll, and `/provider/bookings?tab=rescheduled` (new allowlisted `?tab=` param on the existing bookings page). Priority: reschedule work first only when count > 0. API 17/17; web 217/217 (22 new); full regression loops green; mobile emulation 9/9; real-browser 13/13. |
| Availability Exceptions (block-off, emergency openings) | FUTURE / DEFERRED (Phase B) | Unchanged — first new model in the roadmap; gate on weekly-review evidence. NOT pre-built in Phase A. |
| Dashboard trends / event-history timeline | FUTURE / DEFERRED (Phase C remainder) | Unchanged. |
| Provider Offer & Engagement system | FUTURE / DEFERRED (Phase D) | Unchanged; constraints pre-recorded. |
| Organization/workspace expansion | FUTURE / DEFERRED (Phase E) | Unchanged; NOT IMPLEMENTED. |
| Graphify artifact refresh post-merge | TODO | Still pending from PR #64/#65; refresh after major merged roadmap work per continuity workflow (deferred this session — feature delivery had priority). |

### Availability Exceptions Phase B — Emergency Openings (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Emergency openings (one-off extra slots) | DONE 2026-08-28 | `feat/emergency-openings`: policy doc, additive `provider_emergency_openings` table + `PROVIDER_EMERGENCY_OPENINGS_V1.sql`, owner-scoped GET/POST/DELETE under `/providers/me/availability/emergency-openings`, engine extension (`generateEffectiveSlotsForDate` / `isWithinEffectiveAvailability` — one engine, second source), enforcement wired into booking creation, provider reschedule action, and proposal validation/feasibility, `/provider/availability` UI section, truthful urgent-only slot label in the client booking modal. API `test:emergency-openings` 10/10; web 227/227 (10 new); regression loops green on fresh disposable PG 15. |
| Delete guard conservatism | KNOWN LIMITATION | Deleting an opening is blocked by ANY overlapping active booking — even one that would still fit a weekly window. Honest, safe, acceptable at pilot scale (documented in the policy doc). |
| Listing-preview slot preview includes openings | DEFERRED | `GET /providers/me/listing-preview` remains weekly-windows-only (documented candidate preview); the real public slots endpoint includes openings. Revisit on provider feedback. |
| Vacation ranges (block a date range in one step) | DONE 2026-06 | `feat/vacation-ranges`: policy doc `docs/availability-exceptions-policy.md`, additive `provider_blocked_ranges` table + `PROVIDER_BLOCKED_RANGES_V1.sql`, owner-scoped GET/POST/DELETE under `/providers/me/availability/blocked-ranges`, engine extension (blocked ranges as a subtractive source in `generateEffectiveSlotsForDate` / `isWithinEffectiveAvailability`), enforcement wired into public slots, booking creation, provider reschedule action, and proposal validation/feasibility, honest 409s (`range_overlap`, `emergency_opening_conflict`, `bookings_exist` + count), mutual exclusion with emergency openings in both directions, private provider-only `reason` note, `/provider/availability` "Time off" UI. API `test:vacation-ranges` 10/10 (added to CI scripted loop); web `vacation-ranges.test.tsx` 10 new. |

### Provider first-login return-path reliability (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Provider status reads 500 on pre-Gate-B database (first-return blocker) | DONE 2026-08-28 | `fix/provider-first-login-status`: `isSchemaDriftError` (42703/42P01 via Drizzle `cause` chain), drift-safe `getOwnApplication` (stable signup-era select + eager `rejection_reason` degraded to null), new narrow `getOwnActivationProfile` replacing the bare-select `getOwnProfile` in the activation hub, guarded service-area probe. Truthful degraded states only; migrated path byte-identical; auth/ownership untouched. Root cause CONFIRMED by local drift simulation (pre-fix build: 42703 → 500 on both status reads after re-login). `test:return-path-drift` 11/11 (added to CI scripted loop); full API loop 27 suites green; authz + unscripted green; web 237 + a11y 33 + tz 10 green; live browser proof on drifted DB (desktop + 390×844). Plan + evidence: `docs/provider-onboarding-return-path-reliability-plan.md`. |
| Apply frozen Gate B artifacts to managed Railway database | TODO (separate release gate) | Per `docs/managed-db-release-gate.md`. The code fix makes drift survivable for the status hub, but booking pages, service areas, and rejected-resubmission flows still require the artifacts. Production metadata verification was BLOCKED here (no Railway access). |
| Production deploy + new-provider re-login verification | TODO (separate release gate, NOT AUTHORIZED) | After Gate B: deploy merged main, then verify signup → logout → re-login → status hub with a brand-new provider. |
| Bare-select `getOwnProfile` in ~24 other provider routes | OPEN (unchanged) | Deliberately not broadened — those routes are post-approval surfaces that legitimately need their artifacts; revisit per the standing audit follow-up. |

### Provider route read audit — drift-safety hardening (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Provider route read audit (adjacent to PR #69) | DONE 2026-08-28 | `fix/provider-route-read-drift-audit`: audited 38 provider-owned routes/helpers against the pre-Gate-B drift class; evidence table + stable read-selection rule in `docs/provider-route-read-audit.md`. |
| Bare-select `getOwnProfile` in ~24 other provider routes (standing follow-up above) | DONE 2026-08-28 | `getOwnProfile` itself is now drift-safe (eager-first + stable projection + truthful unpublished defaults), closing the whole route class at the helper. |
| Booking/reschedule owner reads on pending additive columns/relations | DONE 2026-08-28 | Bookings list/detail/outcome-history (recovered work) + reschedule-requests/rescheduling-history and `loadOwnedBooking` (completed this session) degrade truthfully; shared `lib/schema-drift.ts`. Regression: `test:route-read-drift` 19 tests in the CI scripted loop. |
| Client/public booking reads needing pending relations (`/providers/:id/slots`, booking-create availability checks, public booking page) | OPEN (out of scope) | Reviewed, intentionally unchanged — client/public surface, not provider-owned reads. Becomes moot once Gate B is applied; recorded in the audit doc. |
| Apply frozen Gate B artifacts + deploy + new-provider verification | TODO (separate release gates, NOT AUTHORIZED) | Unchanged from the first-login session; per `docs/managed-db-release-gate.md`. |

### Status Hub Progress & next-step clarity (2026-08-28)

| Item | Status | Notes |
| --- | --- | --- |
| Status hub progress meter + next-step clarity | DONE 2026-08-28 | `feat/provider-status-hub-progress`: hero reordered to mobile CTA priority (status → one server-derived next action → compact text-first progress → checklist); factual "what follows" line added per next action (`NEXT_ACTION_COPY.after`). Server authority unchanged (`GET /providers/me/activation-status` milestones/nextAction; no client readiness computation). No API/schema change. Web 240 tests (3 new) + axe green; live 390×844 + desktop verification (CTA above fold, next action above progress, zero horizontal overflow, semantic progressbar). Mobile app: NOT APPLICABLE (no status hub surface). |
| Provider-facing schema/drift health banner | REJECTED (deliberate) | Schema compatibility is an internal operational concern; PR #69/#71 safe degradation + feature-specific truthful states are the correct behavior. Do not add a global provider-facing infrastructure banner. |
| Clean-device pilot usability / release-readiness loop | TODO (next) | Fresh provider account + clean browser profile + phone viewport: full journey (signup → re-login → status page → follow every next action → services/territory/availability/opening/time-off → publish → QR → client booking → reschedule). Record dead ends and friction; fix only repeated/high-severity issues before SEO/marketing/payments. |

### Clean-device Provider–Client Pilot Journey Validation (2026-08-29)

Executed the clean-device pilot usability / release-readiness loop as a
validation + docs phase (baseline `main` `c647d4d`). Authoritative record:
`docs/pilot/provider-client-journey-validation.md`.

| Item | Status | Notes |
| --- | --- | --- |
| Pilot journey validation protocol + executed run | DONE 2026-08-29 | Provider + client journeys PASS on desktop (real Chromium 13/13) and 390×844 (mobile emulation 9/9); web a11y 33/33; API unit 70; 26/27 scripted (`test:lifecycle` 14/14 in isolation — shared-DB concurrency artifact only); authz/concurrency + unscripted + replay all PASS. 0 blockers, 0 high. Managed DB NOT accessed; production NOT deployed. |
| M-1: activation-hub next action vs. verification gate | DEFERRED (MEDIUM) | Hub can surface `nextAction=configure_service_area` when the application is approved but verification is still `under_review`, while `PUT /providers/me/service-area` requires full approval (403 in that window). Transient/admin-controlled. Narrow future fix: gate the hub next action on full approval. No code change this phase. |
| L-1: verification `notes` in `reviewerNotes` column | DEFERRED (LOW) | Provider-submitted notes stored in the doc `reviewerNotes` column; admin-only visible, no provider-facing leak observed. Field-name reuse; watch during the managed-DB gate. |
| L-2: two availability routes by application state | DOCUMENTED (LOW) | `PUT /providers/application/availability` (draft/rejected) vs `PUT /providers/me/availability` (approved). Web UI selects correctly; API-only integrators could be briefly confused. No change. |
| Managed-DB release gate (backup/restore + read-only catalog verify) | OPEN (NEXT) | The real blocker to a production pilot. See `docs/managed-db-release-gate.md`. |
| Apply Gate-B migrations + deploy + re-run protocol on production | TODO / NOT AUTHORIZED | After the gate. Then re-run `docs/pilot/provider-client-journey-validation.md` on production with a brand-new provider + client. |
| Native-device hardware run | STILL DEFERRED | No simulator/device in this environment; mobile emulation is not hardware validation. `docs/native-device-checklist.md`. |

### Pilot finding M-1 — CLOSED (2026-08-29)

| Item | Status | Notes |
| --- | --- | --- |
| M-1: activation-hub next action vs. verification gate | **CLOSED 2026-08-29** | Server fix in `deriveActivationNextAction`: an approved application that has not passed the full approved-provider gate (application AND verification approved) now emits `wait_for_review`, or `review_update_needed` when verification was rejected (resubmission is accessible). Checklist deep links key on the server-derived `approved` milestone; the `review_update_needed` anchor target exists in both producing states. Invariant regression-tested table-driven against live routes (`test:activation-status` 13/13; web 242/242; drift suites green). Branch `fix/activation-next-action-verification-gate`. |
| L-1: verification `notes` in `reviewerNotes` column | DEFERRED (LOW) | Unchanged. |
| L-2: two availability routes by application state | DOCUMENTED (LOW) | Unchanged. |

### Canonical prototype and isolated instance model — documented (2026-08-29)

| Item | Status | Notes |
| --- | --- | --- |
| Canonical prototype + isolated instance operating model | DONE 2026-08-29 | Docs-only (branch `docs/canonical-instance-operating-model`): `docs/canonical-prototype-and-instance-model.md` (decision statement, benefits/tradeoffs, core-vs-configuration boundary, ownership model, non-secret registry spec, provisioning lifecycle, update/release model, backup/migration/recovery rules, scaling thresholds, cross-vertical guardrails, explicit non-goals) + `docs/instance-provisioning-checklist.md`; append-only notes in `docs/product-vision.md`, `docs/github-continuation.md`, `docs/graphify-continuity-workflow.md`, `docs/NEXT-STEPS.md`, `.agents/LOG.md`. No runtime/schema/deploy change. |
| Instance registry (Google Sheet, non-secret metadata only) | OPEN — owner action | Owner creates the sheet from the column spec in `docs/canonical-prototype-and-instance-model.md` §E. Must never contain secrets, connection strings, PII, or booking data. |
| First real isolated client instance | GATED | Only after the canonical production gate: backup/export evidence → Gate-B apply → deploy → production pilot protocol re-run. Then provision via `docs/instance-provisioning-checklist.md`. |
