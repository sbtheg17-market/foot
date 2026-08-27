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

Handoff-template line for every future Neo handoff:

```text
Graphify status: report whether graphify-out/ is present, its latest refresh commit/date, whether code-only or full extraction was used, and whether a refresh is recommended.
```

Setup, privacy boundaries, refresh policy: `docs/graphify-continuity-workflow.md`.
