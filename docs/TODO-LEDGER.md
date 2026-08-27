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
