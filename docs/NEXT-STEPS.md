# NEXT STEPS — Resumable Build Plan

> **Read this first, then `.agents/LOG.md` (latest entry) and `replit.md`.**
> This file is the durable handoff so any agent, on any host, can continue.

> **Current status (2026-08-24, pre-#11 gate):** the task sections below are a
> historical build log (Session-018 era; their test counts are outdated).
> Roadmap items #1–#10 are merged to `main`; CI is live
> (`.github/workflows/ci.yml`, 16 jobs). Current totals: 22 scripted API suites
> (295 tests) + 71 unscripted API tests + 60 web tests. Authoritative today:
> `docs/TODO-LEDGER.md`, `docs/test-coverage-matrix.md` §8,
> `docs/pre-11-release-readiness.md`, and
> `docs/neo/2026-08-21-client-retention-handoff.md`.

## Where the build stands (origin/main)
- **Canonical stack:** Node/Express + TypeScript + PostgreSQL + React/Vite + Expo monorepo (pnpm workspaces).
- The `conflict_*` branches are a **different** stack (React + FastAPI + MongoDB) → **reference only, never merge**.
- Repo **builds, typechecks, runs, and deploys as a single service** (Express serves `/api/*` + the built React SPA). See `docs/deployment-notes.md`.
- **Provider-first:** `/` → `/provider`; canonical routes under `/provider/*`; legacy `/portal/*` redirects. Route constants in `artifacts/web/src/lib/routes.ts`.
- Booking state machine, notifications (SSE + Expo push), auth, and RBAC are **stable and passing (92 tests)**. Do not regress them.
- **No Stripe. Client portal activation is underway; admin remains limited to verification.**
- **GitHub is the source of truth** — push every stable checkpoint to `origin/main`.

## Guiding principles
1. Work in the smallest coherent vertical slice.
2. Don't touch unrelated areas mid-checkpoint.
3. Keep changes compatible with the single-service deploy.
4. Preserve booking/notification/auth/RBAC/hosting logic.
5. Push each stable chunk to `origin/main` immediately.
6. Reuse existing models/API/UI; add backend only if the UI truly needs it.
7. Prefer deriving new state from existing source-of-truth data.
8. Add only the tests that prove the feature + guard existing behavior.

## Verify locally before pushing
```bash
# Postgres (this workspace installs it locally; Railway uses managed PG)
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oncallfoot" JWT_SECRET="local-dev-secret"
pnpm install
pnpm run db:push          # idempotent schema push
pnpm run seed             # demo data (accounts below)
pnpm run build            # typecheck + web + api  (must be green)
PORT=8001 NODE_ENV=production pnpm run start   # serves API + web on :8001
# Integration/pressure tests hit a live server on $PORT:
PORT=8001 pnpm --filter @workspace/api-server run test           # 63 unit
PORT=8001 pnpm --filter @workspace/api-server run test:integration  # 16
PORT=8001 pnpm --filter @workspace/api-server run test:availability # 3
PORT=8001 pnpm --filter @workspace/api-server run test:pressure     # 13
```
Demo logins (all password `demo1234`): `sarah@oncallfoot.com` (provider), `mike@oncallfoot.com` (provider), `jane@oncallfoot.com` (client), `tom@oncallfoot.com` (client), `admin@oncallfoot.com` (admin).

## Task order (checkpoint = one commit + push each)

> **STATUS: all 4 tasks below are DONE and pushed (Session 018, commits `49d049c`, `9730a7f`, `183c255`, `94d629b`). 95 tests green.**

### 1) Availability preset — "9–5 weekdays"  ✅ DONE
One-tap weekday 09:00–17:00 preset on the provider availability screen. Reuses the existing availability save path; idempotent + reapplyable; manual edits still work; mobile-first. Tests: `pnpm --filter @workspace/api-server run test:availability`.
Files: `artifacts/web/src/pages/portal/availability.tsx` (`applyWeekdayPreset`), `artifacts/api-server/src/__tests__/availability-preset.test.ts`.

### 2) Booking filters  ✅ DONE
Status-chip filters (requested / confirmed / completed) with live count badges on the provider bookings inbox. Local, presentational — single fetch, `useMemo`-derived counts/filtering; no writes, no state-machine changes.
Files: `artifacts/web/src/pages/portal/bookings.tsx`.

### 3) Tap-to-reach  ✅ DONE
Client phone is a `tel:` link and address a `https://maps.google.com/?q=` link on booking cards. `GET /bookings` now left-joins `users` to return `clientFirstName/LastName/Phone` (additive OpenAPI fields; client regenerated).
Files: `artifacts/api-server/src/routes/bookings.ts`, `lib/api-spec/openapi.yaml`, `artifacts/web/src/pages/portal/bookings.tsx`.

### 4) Earnings export  ✅ DONE
Printable HTML earnings statement (browser print-to-PDF; no PDF dependency) derived from **completed bookings only** via read-only `GET /providers/me/earnings/export`. Page: `/provider/earnings/statement` with print-CSS (`print:` variants hide navs/toolbar). No Stripe.
Files: `artifacts/api-server/src/routes/providers.ts`, `artifacts/web/src/pages/portal/earnings-statement.tsx`, `earnings.tsx`, `lib/routes.ts`, `App.tsx`, `components/layout/provider-layout.tsx`.

## Provider profile depth ✅ DONE
- Added a provider trust checklist with completion progress and direct links to finish profile, services, and credentials.
- Public web and mobile profiles now show real avatars when available, clearer credential verification, new-client availability, service-area notes, and service eligibility notes.
- No schema, upload dependency, booking, notification, or payment changes were needed.

## Client portal activation ✅ CHECKPOINT 1
- Client-only booking access is enforced in the web shell and mobile bookings screen.
- Public discovery and provider profiles remain browsable without an account.
- Booking creation now routes unauthenticated visitors to sign-in and directs provider/admin accounts away from the client flow.
- Existing provider discovery, profile, service selection, `POST /bookings`, and booking views were reused; no API/schema/state-machine changes were needed.

## Preview schema and seed restoration ✅ DONE
- The existing Drizzle schema was pushed to the active development database with `pnpm run db:push`.
- The existing seed was run twice and is idempotent: 5 users, 2 provider profiles, 5 services, 4 sample bookings, and 1 review are present with valid provider-to-user links.
- The authenticated client/provider/admin booking flow passed in an isolated API process. Managed workflow authentication is now verified with `JWT_SECRET` supplied through secure environment settings.

## Client Portal Checkpoint 2 — booking list and detail ✅ FIRST SLICE
- Web and mobile clients now separate upcoming, past, and cancelled bookings with clear server-owned status labels.
- Each booking opens a role-safe detail view with provider, service, date/time, address, status explanation, client notes, and cancellation reason where applicable.
- Existing booking, provider, and service APIs were reused; no schema, OpenAPI, state-machine, provider-flow, or payment changes were needed.
- Provider-private `careNotes` remain private and are not rendered in the client detail view.

## What's next (pick with the user)
- Client Portal Checkpoint 2 continuation: add client cancellation confirmation and duplicate-submit protection, then present fresh provider status updates through the existing notification/status paths.
- After the lifecycle core: allow one review after an eligible completed booking and add only the minimum client-visible care history; keep provider-private notes private.
- Stripe payments (explicitly out of scope until requested).

## Operational rules
- After each chunk: `pnpm run build` + relevant tests green → commit → **push to origin/main**.
- Append a `.agents/LOG.md` entry per checkpoint (update Current Build State + Next Best Action).
- Never batch unrelated tasks into one commit. If a task grows, split into a shared-foundation commit + a feature commit.
- If you must stop early: commit what's stable, push, and record exactly what remains in `.agents/LOG.md` "Next best action".

## Credit-tight mode
Do **Task 1 only**, stop, push, then ask for the next task.

## Status note — 2026-08-25 (roadmap #11)

Roadmap #11 (provider-owned public booking pages and share links) is
implemented: `/book/:providerSlug` public page, publish/unpublish with
immutable slugs, dashboard share card with QR, and allowlisted booking
`source` attribution. See `docs/TODO-LEDGER.md` (2026-08-25 section),
`docs/api-routes.md`, and `docs/data-models.md` for the authoritative state.

## Status note — 2026-08-26 (roadmap #12)

Roadmap #12 (service-area eligibility + travel/setup buffer) is implemented
and merged: Canada-first FSA coverage (`/provider/service-area` portal page,
owner-scoped `/providers/me/service-area*` API), server-authoritative
eligibility (`eligible | ineligible | needs_review | invalid | unavailable`)
checked BEFORE service/slot selection on `/book/:providerSlug` and in the
marketplace/mobile booking modal, and a centrally managed 30-minute
travel/setup buffer enforced on new bookings and all future reschedule paths.
PR #49 merged 2026-08-25 (`a0083e7`); the 2026-08-26 completion PR #50 fixed the
three CI regressions #49 merged with, wired `test:service-area` into CI, and
recorded the implementation. Authoritative docs: `docs/TODO-LEDGER.md`
(roadmap #12 section), `docs/service-area-travel-policy.md` (implementation
record), `docs/api-routes.md`, `docs/data-models.md`.

## After roadmap #13 (2026-08-26)

#13 (cancellation/no-show policy + minimal support workflow) is implemented —
see `docs/cancellation-no-show-policy.md`. Natural next steps, in order:

1. Controlled pilot readiness review: #13 was the last blocker named in the
   continuity spec for a pilot with real users.
2. Support escalation notifications (a support inbox signal beyond the API).
3. Cancellation-fee policy design (money movement stays deferred until the
   payments provider decision).
4. The standing deferred items in `docs/TODO-LEDGER.md` (reminders, native
   device verification, managed-DB release gate evidence).

## Status note — 2026-08-26 (pilot readiness)

The Southern Ontario controlled-pilot readiness review is implemented
(`feat/pilot-readiness`): env-configured support contact surfaced on the
public booking page + provider portal (`GET /api/support/contact`), on-demand
real-browser smoke test (`pnpm run smoke:real-browser`, Chromium, 13/13),
native-device emulation checks (`pnpm run smoke:mobile-emulation`, iPhone
13/WebKit + Pixel 5/Chromium + 3G throttle, 9/9; hardware run DEFERRED with a
manual script), and the operations pack under `docs/pilot/` (readiness report,
support workflow, monitoring, backup/restore drill, secret rotation drill,
incident runbook, provider onboarding/checklist/FAQ). Authoritative:
`docs/pilot/pilot-readiness-report.md`. Remaining operator actions before
day 1 are listed there (set the real support email, hardware test run, uptime
monitor account, managed-DB backup confirmation).

## Status note — 2026-08-27 (provider dashboard)

The conversion-first provider dashboard is implemented and merged: canonical
`/provider/dashboard` route (old `/provider` redirects), one owner-scoped
read-only aggregate (`GET /api/providers/me/dashboard`, plus
`GET /api/providers/me/metrics`), greeting + today + next booking, quick
actions, 7/30-day upcoming list, performance metrics with supportive
color+text status, booking-link tools (existing publish/copy/share/QR card)
with a dependency-free source-attribution bar chart, collapsible recent
activity, and an honest "coming soon" earnings preview. No schema change, no
new dependencies. Authoritative: `docs/provider-dashboard.md`. Natural next
steps: availability exceptions (emergency slots / block-off dates), then the
standing deferred items in `docs/TODO-LEDGER.md`.

## Status note — 2026-08-27 (registration blocker fixed)

The mobile registration "Internal server error" is fixed: root cause was a
duplicate-submission TOCTOU race on `POST /auth/register` (unique-constraint
violation surfaced as 500). The API now returns a safe 409 for any
unique-violation, and the signup page prevents duplicate submissions, shows
client-safe errors (never "Internal server error"), and moves focus to the
error summary. Regression suite: `test:registration` (CI-gated). See the
TODO-LEDGER 2026-08-27 registration section.

## Graphify continuity aid

Before beginning a substantial continuation, query the local repository graph if `graphify-out/graph.json` exists:

```bash
graphify query "<task-specific architecture question>"
graphify path "<symbol or concept A>" "<symbol or concept B>"
graphify explain "<symbol or concept>"
```

Use Graphify to identify relevant source, docs, migrations, and dependencies before editing. Treat `EXTRACTED` links as direct source evidence and `INFERRED` links as leads that must be verified in code.

Graphify is optional and non-blocking. If it is unavailable or stale, continue with normal Git/source inspection. Never graph secrets, `.env` files, runtime data, managed-database contents, or credentials. Do not use Graphify as a production service, a CI gate, or a reason to skip tests.

Compact status block required in every future Neo handoff (update the
baseline SHA whenever the graph is refreshed):

```text
Graphify status:
- Main graph artifact baseline: 96b7102694d656112d9e486205d4850333040918 (refreshed 2026-08-28; previous baseline c2c6c10cc93a7f1f3b025fcf9ff5320283255044)
- Extraction mode: CODE-ONLY LOCAL
- Graph files: graphify-out/graph.json, GRAPH_REPORT.md, graph.html, manifest.json
- Refresh policy: manual after major merged roadmap work or significant refactor
- Refresh command:
  graphify extract . --code-only
  graphify cluster-only . --no-label
- Safety: no external APIs, no managed DB introspection, no public Graphify server, no hooks, no CI gate, query logging disabled
- Before substantial work: query Graphify first, then verify output against source and Git history
- If current HEAD differs materially from the graph baseline: graph is potentially stale; refresh is recommended but non-blocking
```

Setup, privacy boundaries, refresh policy: `docs/graphify-continuity-workflow.md`.

## Status note — 2026-08-28 (provider verification onboarding recovered)

The onboarding "Internal server error" on verification-document submission is
fixed. Root cause: both `/providers/me/verification` routes resolved the
profile via `getOwnProfile()`, whose bare Drizzle `select()` emits every
schema column — on databases missing the Gate B-pending booking-page columns
(#11 artifacts), PostgreSQL 42703 surfaced as an unhandled 500 before any
validation or persistence. The routes now read only signup-era columns
(mirroring the PR #56 signup convention), submission is transactional and
idempotent (profile row lock; identical pending submission returns the same
record; status bump rolls back with the insert), and inputs are bounded
(reference 3–200, notes ≤ 1000). The onboarding schema audit added the
missing frozen artifact `PROVIDER_APPLICATION_REJECTION_REASON_V1.sql`.
Conversion UX: honest purpose/success/error copy, focus management, support
link on true failures, values preserved. New CI-gated suite
`test:verification` (13 tests) + 11 web tests. Full record:
`docs/provider-verification-onboarding-policy.md`. Follow-up recorded in the
TODO ledger: ~24 other `/providers/me/*` routes still use the bare-select
`getOwnProfile()` and would 500 for approved providers on pre-Gate-B
databases.

## Status note — 2026-08-28 (Pilot Operations Dashboard Part 1 — metrics API)

Admin-only pilot metrics foundation is in: `GET /api/admin/pilot/metrics`
(pilot window incl. projected fallback, summary, per-provider activation
milestones/outcomes/risk flags, source attribution) and
`PATCH /api/admin/pilot/providers/:providerId/retention` (upsert, admin actor
audited), both under the admin gate. New table `pilot_provider_retention`
(frozen artifact `PILOT_PROVIDER_RETENTION_V1.sql`). Vertical-neutral metric
logic; privacy-redacted payload (no client identity/addresses/notes/
references — test-enforced). CI-gated `test:pilot-metrics` (14 tests).
Full model + definitions: `docs/pilot/pilot-metrics-dashboard.md`.
Part 2 next: `/admin/pilot` UI + CSV export over the generated
`useGetAdminPilotMetrics`/`useUpdatePilotProviderRetention` hooks — do NOT
rebuild Part 1 calculations, persistence, or authorization.

## Continuity handoff — 2026-08-28 (Pilot Operations Dashboard Part 1 COMPLETE)

```text
Pilot Operations Dashboard status:
Part 1 metrics API + retention storage: COMPLETE
Part 2 admin UI + chart + CSV: NOT STARTED
Part 3 weekly review pack: NOT STARTED

Baseline main SHA: 6f5778198470c70e763e8d8ee54003c5662d17f8
Current branch: main (Part 1 merged via PR #60)
Current head SHA: d7dcf115f39e8e2eddc8362f1347da1a4992079c
Uncommitted files: NONE
Committed files: 34 files in PR #60 (routes, metrics lib, schema, migration
  artifact, OpenAPI + regenerated clients, tests, docs, .env.example, CI)
PR: https://github.com/sbtheg17-market/foot/pull/60 — MERGED
Migration artifact: docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql (frozen,
  additive; sha256 ceaac6d5…bf90cad; disposable-PG checks PASS; Gate B-pending)
API routes: GET /api/admin/pilot/metrics;
  PATCH /api/admin/pilot/providers/:providerId/retention
Metric definitions implemented: pilot window w/ safe projected fallback,
  activation milestones + status ladder, outcome rates, repeat-client rate,
  source attribution (unknown grouping), support escalations, retention
  rollup, risk flags — vertical-neutral, PILOT_PROVIDER_TARGET display-only
Authorization behavior: requireAuth + requireRole("admin") on both routes
  (401/403 test-enforced); reads and writes audit-logged
Privacy boundaries: no client identity, addresses/postal codes, notes,
  document references, or tracking parameters — redaction test-enforced
Tests passed: CI 16/16 GREEN on d7dcf11 (incl. test:pilot-metrics 14 tests,
  pilot-window unit tests, migration checks, authz/concurrency, secret scan)
Tests not run: none outstanding for Part 1; suites not rerun locally in the
  handoff session — CI on the exact merged SHA is the validation record
CI status: GREEN (16/16 on d7dcf115f39e8e2eddc8362f1347da1a4992079c)
Exact next action: build Part 2 /admin/pilot UI from current main over the
  generated hooks; do NOT rebuild Part 1 logic, persistence, auth, or contract
```

```text
Strategic boundary:
This is a platform-admin pilot dashboard.
Organization-admin/workspace/workforce functionality remains FUTURE and NOT IMPLEMENTED.
Provider-facing dashboard remains FUTURE and is not part of this branch.
```

## Status note — 2026-08-28 (Pilot Operations Dashboard Part 2 — admin UI)

The platform-administrator `/admin/pilot` dashboard UI is implemented on
`feat/pilot-operations-dashboard-ui` (PR #62) over the merged Part 1 API,
with zero Part 1 duplication: pilot window context (incl. projected-window
guidance), summary cards with quiet threshold aids and honest
undefined-rate copy, activation/readiness ladder, provider health table
with non-punitive follow-up labels, retention-intent control (Part 1 PATCH
hook; failure preserves the previous value), dependency-free source
attribution chart, weekly review prompts, and a privacy-safe client-side
CSV export (allowlisted columns, RFC 4180 + formula-injection safe).
Web tests 180/180 (34 new), typecheck/build/build:deploy/secret-scan clean.
Authoritative doc: `docs/pilot/pilot-metrics-dashboard.md` (Part 2 section).
Part 3 next: weekly review pack — do NOT rebuild Parts 1 or 2.

## Status note — 2026-08-28 (Pilot Operations Dashboard Part 3 — weekly review pack + closure)

Part 3 is COMPLETE (branch `docs/pilot-operations-review-pack`, PR #63) —
documentation, continuity, verification, and closure only; zero product-code
change. Added `docs/pilot/weekly-pilot-review.md` (15–30 minute weekly
operator review, privacy-safe review-record template, cautious decision
rules, pilot closure criteria with the small-numbers caveat) and the Part 3
dashboard operator guide in `docs/pilot/pilot-metrics-dashboard.md` (access,
metric meanings, projected dates, retention updates, CSV export + privacy
limits, responsible label use, no-ranking rationale, data + conversations).
Graphify artifacts refreshed at `96b7102` (code-only local, scanned clean).
Dashboard smoke re-verified from current main on a seeded disposable local
PostgreSQL: 401/403/200 authorization, projected-window payload, retention
upsert + 400 on invalid intent, allowlisted privacy-safe payload. All three
pilot-dashboard parts are now CLOSED; the Pilot Operations Dashboard is an
operating workflow, not an open build item. Strategic boundary unchanged:
platform-admin dashboard only; organization-admin/workspace/workforce and
provider-facing pilot dashboards remain FUTURE and NOT IMPLEMENTED. Next
customer-facing conversion priority (evidence-guided): Provider Approval
Status Page, then Provider Dashboard, then Availability Exceptions.
Authoritative records: `docs/pilot/pilot-metrics-dashboard.md` (Part 3
closure block), `docs/pilot/weekly-pilot-review.md`, `docs/TODO-LEDGER.md`.

## Status note — 2026-08-28 (Provider Approval Status & Activation Hub)

The next customer-facing conversion priority is DONE on
`feat/provider-approval-status-hub` (PR #64, baseline main `65f4eee`).
`/provider/application-status` is now the guided Approval Status & Activation
Hub: plain-language status hero + truthful progress + server-derived next
best action, grouped 9-milestone activation checklist (locked steps
pre-approval, deep links to existing routes), verification section with
needs-update resubmission recovery and the privacy statement,
booking-readiness cards, share-and-grow section embedding the existing
BookingPageCard, honest value + help/trust sections, and the preserved
rejected-state recovery (reason, reset/resubmit, timeline). One new
owner-scoped read-only endpoint `GET /providers/me/activation-status`
(readable in every application state; composition of existing rules; no
schema change; redaction contract tested). The former draft/approved
auto-redirects were replaced by the hub serving those states — the only
intentional behavior change. Verified: typecheck/build/build:deploy PASS;
root tests api 132/132 + web 195/195 (15 new); `test:activation-status`
11/11; 13 regression suites 182/182; live auth smoke 401/403/403-admin/200;
hub mobile smoke 10/10 @390×844; emulation 9/9; real-browser 13/13; diff
check + secret scan PASS. Strategic boundary preserved: platform-admin pilot
dashboard IMPLEMENTED; this hub DONE; **Provider Dashboard is the next major
provider product surface (FUTURE)**; organization-admin/workforce dashboard
FUTURE, NOT IMPLEMENTED. Graphify: discovery queries only this session;
artifact refresh deferred until after merge per the continuity workflow.
Authoritative doc: `docs/provider-approval-status-hub.md`.

## Status note — 2026-08-28 (Provider Dashboard read-only conversion overview)

Docs-only blueprint on `docs/provider-dashboard-readonly-overview`: recorded
the truth that a conversion-first `/provider/dashboard` already ships
(PR #54) and blueprinted its evolution instead of a rebuild. Created
`docs/provider-dashboard-readonly-overview.md` (section-by-section concept
with exact IMPLEMENTED / EXISTS BUT NEEDS WIRING / NEEDS NEW BUILD /
FUTURE-DEFERRED / OUT OF SCOPE classification + phased plan A–E),
`docs/provider-dashboard-capability-inventory.md` (source-verified truth
tables), `docs/provider-dashboard-conversion-playbook.md` (60-second demo,
vertical-neutral + foot-care pitches, truthful social/local channel framing,
claims discipline), `docs/provider-dashboard-future-boundaries.md`
(org/white-label compatibility without tenancy; offer-system constraints),
and the static labeled concept `docs/provider-dashboard-wireframe.html`
(no scripts/external assets/routes). Zero runtime change. Key findings:
Phase A is shipped except the next-best-action card (wire the hub's
`nextAction` into the dashboard) and pending-reschedule surfacing; Phase B =
Availability Exceptions (first schema work, evidence-gated). Recommended
next build: Phase A completion wiring. Strategic boundary re-recorded:
organization/workspace/workforce and offer/engagement systems FUTURE, NOT
IMPLEMENTED.

## Status note — 2026-08-28 (Provider Dashboard Phase A — actions wiring)

Phase A completion is DONE on `feat/provider-dashboard-phase-a-actions`
(baseline main `e7210da`, PR #65). The existing `/provider/dashboard`
(PR #54) now surfaces: (1) a **Next Best Action card** rendering the
Activation Hub's server-derived `nextAction`
(`GET /providers/me/activation-status` via the existing
`useGetMyProviderActivationStatus` hook — shared query key, no duplicated
logic) with truthful copy and deep links to existing routes only
(publish/share resolve to the existing BookingPageCard; pre-approval/paused
states to the status hub); and (2) a **Pending Reschedules card** for
client-initiated `rescheduled` bookings awaiting the provider's
confirm/decline, fed by a `pendingReschedules { count, nextRequest }`
extension of the existing `GET /providers/me/dashboard` read model (derived
from rows already loaded; no new endpoint; no schema change) and
deep-linking to the existing bookings Reschedules tab via a new allowlisted
`?tab=` param. Action priority: reschedule work above nextAction only when
count > 0 (a `rescheduled` booking holds a live appointment until the
provider acts). Verified on a seeded disposable local PostgreSQL 15:
typecheck/build/build:deploy PASS; root tests api unit 132/132 + web
217/217 (22 new); scripted API loop 24 suites 299/299
(provider-dashboard 17/17 incl. 4 new pending-reschedule tests;
activation-status 11/11; booking-page 17/17; service-area 30/30;
cancellation 22/22; pilot-metrics 14/14); authz-concurrency loop 65/65
(authorization 7/7, concurrency 16/16, pressure 13/13, rescheduling 12/12,
proposals 17/17); mobile emulation 9/9; real-browser smoke 13/13; live
390×844 dashboard verification (priority ordering, deep link to
Reschedules tab, zero horizontal overflow); diff check + secret scan PASS.
Strategic boundary unchanged: Availability Exceptions remains Phase B
(DEFERRED, evidence-gated); Provider Offer & Engagement and
organization/workspace remain FUTURE, NOT IMPLEMENTED. Authoritative doc:
`docs/provider-dashboard.md` (Phase A section).

## Status note — 2026-08-29 (Availability Exceptions Phase B — blocked dates slice)

Phase B first slice is DONE on the working branch (baseline main `9398bf4`,
post PR #66): providers can now block specific marketplace-local calendar
dates (vacation, courses, personal days) from a new **Blocked dates**
section on the EXISTING `/provider/availability` Schedule page (evolved, not
rebuilt). Authoritative product rules: `docs/availability-exceptions-policy.md`.

What shipped: one additive table `provider_availability_exceptions`
(+ enum, migration `PROVIDER_AVAILABILITY_EXCEPTIONS_V1.sql`); three
owner-scoped endpoints extending the existing availability group
(GET/POST/DELETE `/providers/me/availability/exceptions[...]`); enforcement
at every write path (public slots suppression, booking creation, legacy
direct reschedule, consent-first proposal target validation at creation AND
consent — original-time feasibility intentionally untouched so a block
never invalidates an existing appointment); owner listing-preview skips
blocked dates. Public behavior is non-leaking (empty-slots shape identical
to a no-window day; reasons stay private). Reused reason code
`outside_availability` — no new public API surface for clients.

Validation (seeded disposable local PostgreSQL 15): typecheck PASS ·
build PASS · build:deploy PASS · API unit 132/132 · CI-equivalent scripted
loop 24 suites (incl. new `test:availability-exceptions` 9/9, wired into
`ci.yml`) + unscripted suites + authz/concurrency suites = 35/35 suites
green · web 228/228 (11 new in `blocked-dates.test.tsx`, incl. axe) · live
browser verification desktop + 390×844 (add/delete flow, truthful empty
state, no NEW horizontal overflow — a pre-existing 1px overflow from the
weekly-slot delete buttons was observed and left untouched).

Drive-by fix recorded: `availability-enforced-booking.test.ts` had a
pre-existing DST calendar flake (hardcoded EDT offsets; fails on main
whenever today+60d lands in EST, e.g. Nov 2026) — made DST-aware with an
Intl-based Toronto offset helper. No runtime code affected.

Explicitly deferred (see policy doc §8): emergency one-off openings, date
ranges, partial-day blocks, blocked-date warnings listing existing
bookings, pruning past rows, admin visibility. Next candidates per the
relay: Reschedule nav badge (3.2), printable QR card (3.3), Graphify
artifact refresh (3.4 — still TODO; Graphify CLI unavailable again this
session).

## Status note — 2026-08-29 (Reschedule alerts — portal nav badge)

DONE on `feat/reschedule-nav-badge` (relay §3.2). The existing provider
portal nav now shows a pending-reschedule count badge on the Bookings tab
(mobile bottom nav + desktop sidebar) whenever `rescheduled` bookings await
the provider's confirm/decline, deep-linking to
`/provider/bookings?tab=rescheduled` (Phase A allowlisted param). Absent at
zero. Data source: existing `useListBookings({ status: rescheduled })`
total — same owner-scoped count as Phase A `pendingReschedules.count`,
mirroring the adjacent requested-count badge (no new endpoint, no schema
change; avoids polling the heavier audit-logged dashboard read model from
every page). Accessible (aria-label text, not color-only), truthful count,
99+ cap, touch-safe. Validation: typecheck/build/build:deploy PASS · web
234/234 (6 new in `provider-layout.test.tsx`) · zero backend changes (API
suites unaffected; 35/35 from the Phase B session still current) · live
desktop + 390×844 verification incl. badge appear/disappear with real data
and deep-link landing. Details: `docs/provider-dashboard.md`
("Reschedule alerts" section). Next candidates: Printable QR Card,
Emergency Openings, Vacation Ranges.

## Status note — 2026-08-29 (Printable QR card — booking page handout)

DONE on `feat/printable-qr-card` (relay §3.3). New presentation-only route
`/provider/booking-page/print` (provider-authenticated, rendered inside the
existing provider layout whose chrome is already `print:hidden`): OnCall
Foot mark, provider name + title, up to six active services with duration
and price, QR (canonical URL + existing `source=qr-card` attribution),
human-readable URL, truthful scan-to-book line. "Print handout" link added
to the published BookingPageCard. Data: owner booking-page read + the SAME
public `GET /booking-pages/:slug` clients see — public data only; no new
endpoint, no schema change, no booking/availability logic touched.
Unpublished → truthful "publish first" zero state. Validation:
typecheck/build/build:deploy PASS · web 240/240 (6 new) · zero backend
changes · live desktop + print-media emulation (single ink-friendly page,
no chrome) + 390×844 (0px overflow). Details:
`docs/provider-dashboard.md` § Printable QR card. Next candidates:
Emergency Openings, Vacation Ranges, Graphify Refresh.
