# Return Clients for OnCall Foot — Checkpoint A report and the reviewed-design slice

A native repeat-visit engine for OnCall Foot providers: completed in-home appointments earn a client credit, a threshold unlocks a one-time reward, and clients who are due to return get one consent-gated invitation to book again — with a phone-friendly provider activity feed instead of a CRM.
Nothing is built in this workspace. This document is the read-only repository reality report the handoff asked for, plus the first slice to run against the real repository once approved.

## Who it's for

- **Providers** (mobile foot care professionals on OnCall Foot): want returning clients without remembering follow-ups or learning GoHighLevel.
- **Clients**: want to see what they have earned and book the next visit in the app they already use.
- **Platform admin / owner**: wants to see which programs are active, healthy, compliant, and associated with repeat bookings — with an audit trail for every correction.
- **Next Neo / agent session**: needs a verified starting point, a safe way to open the real repository, and a scoped first task.

## Core features and experience

### 1. What was inspected in this workspace, and why it is a starter template

- `/app` contains only the Emergent FastAPI + React + MongoDB starter: `backend/server.py`, `backend/requirements.txt`, `frontend/src`, `frontend/package.json`, `tests/__init__.py`, `memory/`, `test_reports/`, `test_result.md`, `README.md`. There is no `artifacts/`, `lib/`, `docs/`, `.agents/`, `pnpm-workspace.yaml`, `AGENTS.md`, or OnCall Foot git history. No git remote points at `sbtheg17-market/foot`.
- Nothing in `/app` was changed. The only file written this session is this plan. No clone, fetch, install, database connection, secret read, push, merge, or deployment happened.
- The three uploaded `.xlsx` files are subtitle exports of the Marc Aristide / LoyalShot sessions (day-1 opportunity talk, day-2 snapshot install walkthrough, and the "$20K/month" interview). They were read for reference only; concrete mechanics extracted are listed under "Source material lessons" below.

### 2. The intended repository — verified read-only via GitHub

| Item | Verified value |
|---|---|
| Repository | `https://github.com/sbtheg17-market/foot` (public), project name **OnCall Foot** |
| Default branch | `main` |
| `main` HEAD | `1213110d491c73c4879f8217176f73aeff3ef294`, committed 2026-09-27T04:36:13Z, "Conflict 260926 1408 (#94)", parent `ee0d1805d611e9517d6aa02909c34d30bc7f6501` (PR #93) |
| History | 287 commits, 160 branches (26 historical `conflict_*` refs classified in `docs/roadmap/BRANCH_INVENTORY_V7.md`, plus many later `conflict_YYMMDD_HHMM` branches created by Emergent "Save to GitHub") |
| What PR #94 landed | The 2026-09-27 session work the previous handoff listed as "not on GitHub" — provider scorecard + earnings relabel, the three Phase-4 SQL proposals, the Ground Game design, `docs/neo/2026-09-27-session-completion-handoff.md`. It is now on `main`. |
| Stack | pnpm workspace (pnpm 10.18.3, Node 24) · Express 5 + TypeScript 5.9 · PostgreSQL (Supabase, PG 17.6) + Drizzle · OpenAPI 3.1 + Orval codegen · React 19 + Vite + TanStack Query · Expo mobile |
| Deployed | Railway single service from `main` (`railway.json`: build `pnpm run build:deploy`, start `pnpm run start`, healthcheck `/api/healthz`); Express serves the SPA. Live URL recorded in repo: `https://foot-production-9784.up.railway.app` |
| Not verifiable from here | Which commit Railway is currently running (the handoff noted the 09-27 merge had not triggered a deploy); whether the owner's local VS Code worktree has unpushed commits; whether `frontend/yarn.lock` shim artefact is still untracked; whether the `orbitetech12` password exposed in PR #89 history was rotated; whether the Railway project token was revoked and the stale `JWT` variable deleted. |

Relation to this workspace: previous Emergent sessions ran the pnpm monorepo *inside* the Emergent container by checking the repo out at `/app` and adding two preview shims that are now committed in the repo root (`backend/server.py` proxying 8001 → node 8011, `frontend/package.json` serving the built web app on 3000, `backend/tests/*.py` read-only pytests). The current `/app` is a fresh container that never received that checkout. The blank starter is not a fork or a corruption of OnCall Foot; it is simply the default template.

### 3. Safe plan to open the real repository without overwriting anything

1. Confirm `/app` has no owner work: no remote, only starter files (already observed).
2. Clone read-only into a **sibling** directory: `git clone https://github.com/sbtheg17-market/foot.git /app/foot`. HTTPS with no credentials cannot push. The starter stays untouched.
3. Verify identity before trusting anything: `git -C /app/foot rev-parse HEAD` must equal `1213110d…`, `git remote -v` shows origin, `git fetch origin` then `git merge-base origin/main HEAD`. Never check out or base work on any `conflict_*` branch.
4. Read in the mandated order: `AGENTS.md` → `docs/roadmap/NEO_EAGLE_VIEW.md` → `.agents/AGENT-RULES.md` → `.agents/SETUP.md` → `.agents/NEXT_TASK.md` → latest `.agents/LOG.md`.
5. Toolchain inside `/app/foot` only: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm test` (pure suites). Server-backed suites need a **disposable local PostgreSQL** and a throwaway `JWT_SECRET`; `db:push` is run only against that scratch database. The Supabase `DATABASE_URL` is not needed and will not be requested for Phases 1–2.
6. Work happens on a new feature branch (`feat/return-clients-design`); publication remains owner-driven (Save to GitHub → PR → reviewed fast-forward). No push from the agent.
7. Only if a live preview is later wanted (Phase 2 demo) does the checkout need to sit at `/app` so the committed shims match supervisor; that step replaces the starter and requires explicit approval plus the owner-supplied gitignored `.env` and `memory/` files.

### 4. How the application actually works today (evidence from `main`)

**Authentication and roles** — JWT HS256 bearer tokens (`artifacts/api-server/src/lib/jwt.ts`) with bcrypt passwords; `requireAuth` re-validates the user against PostgreSQL on every request; `account_roles` is the authoritative membership table (`users.role` is compatibility); roles are `client | provider | admin`; `requireRole`, `requireApprovedProviderIfProvider`; a provider may operate only when the application is `approved` **and** `provider_profiles.verification_status = approved`; the whole `/api/admin` router is admin-gated. Registration/login exist for all roles. Return Clients reuses this unchanged: provider routes under `/api/providers/me/return-clients/*` scoped by the caller's own profile, client routes under `/api/return-clients/me/*`, admin routes under `/api/admin/return-clients/*`, public program page read under `/api/booking-pages/:slug/return-program`.

**Vendor tenancy** — No organisation or tenant layer. A "vendor" is one `provider_profiles` row, 1:1 with a provider user. `marketplace_events` already uses `provider_profile_id` as the business key and documents it as forward-compatible with a future `marketplace_id`. The Return program owner is therefore `provider_profile_id`; one active program per provider.

**Booking completion** — `PATCH /api/bookings/:id/status` (`routes/bookings.ts`). Only the owning provider may move `confirmed → completed` (admin may force any transition, per `lib/booking-state-machine.ts`). The row is locked with `SELECT … FOR UPDATE`, the transition is validated against the locked status, and `completed` is terminal — a second completion attempt returns 409. There is **no** `completed_at` column (only `updated_at`), **no** `booking_outcome_history` row for completions (only cancelled/no-show), **no** marketplace event for completion (the enum has no `booking_completed`, and funnel events are declared but never emitted), and **no** time gate stopping a provider from marking completion before the scheduled time (no-show has one). Reversal of a completion has no dedicated path: only an admin force-transition, which today writes no audit row. Push notifications fire after commit and never roll back the write. There is no outbox, queue, or scheduler — `index.ts` only validates `JWT_SECRET`/`PORT` and listens.

**Booking value** — `services.price_cents` exists; an `invoices` row (`amount_cents`, status `pending`) is auto-created on confirmation. No payment backend is wired and the earnings API already labels figures "invoiced, NOT confirmed paid". Return Clients may show "booking value" from these fields and must never call it revenue.

**Notifications and messaging** — In-app: `provider_notifications` (server-rendered, idempotent by `UNIQUE(user_id, event_id)`, created in the same transaction as the lifecycle event, but keyed only to provider-application events; web feed at `/provider/notifications` with unread badge; no client feed). Real-time: an in-memory SSE bus (`notification-bus.ts`) for new bookings only. Push: Expo via `push_tokens`, best-effort, one retry, no delivery log. Email: `lib/decision-emails.ts` calls the Emergent managed transactional proxy, gated on `EMERGENT_EMAIL_KEY` + `EMAIL_FROM_NAME` (+ `PUBLIC_APP_URL`), with a structural safety gate, returning `{sent, reason}`; used only for application decisions; no persisted outbound log. **No SMS, no inbound channel, no two-way inbox, no "replied" signal anywhere.** No cron/worker. A file-based DLQ directory exists only for prevented-booking analytics.

**Consent and contact preferences** — None. `users.phone` is nullable; there is no marketing consent, unsubscribe, or preference field. The house pattern for consent is the Comfort-Wiring design (design-only, §4 of the Eagle View): append-only versioned consent rows; withdrawal hides, never deletes.

**Admin surface** — `/admin` command center (credential queue with decision dialog, applications under review with approve/reject, support escalations, system health `/admin/system` incl. env-var presence and applied-migration state, owner-only demo-data purge), `/admin/verification`, `/admin/pilot` (metrics incl. repeat-client rate, CSV, retention intent). Audit today: `provider_application_events`, `booking_outcome_history`, `reschedule_history` (all append-only). A general `admin_audit_log` and `users.is_demo` are **proposed, not approved, not applied** (three hashed artifacts under `docs/migrations/`). Demo accounts are recognised only by the `DEMO_EMAILS` allowlist.

**Migrations (Gate B)** — Schema changes reach the managed database only as frozen additive SQL artifacts `docs/migrations/*_V1.sql`: SHA-256 recorded in `docs/managed-db-release-gate.md` and `docs/migrations/APPLIED_LEDGER_2026-09-26.md`; no `IF NOT EXISTS` (drift fails loudly); no DOWN (rollback is restore-based); rehearsed on disposable PostgreSQL (fresh apply passes, re-apply fails, `db:push` ×2, seed ×2); applied once by the operator with `psql --set ON_ERROR_STOP=1` in one transaction; then the Drizzle schema is mirrored. Startup never pushes schema. Read paths are drift-safe (`lib/schema-drift.ts`) so code can ship before an artifact is applied. Ten artifacts are recorded as applied to Supabase (2026-09-26); three are proposed.

**Testing** — `node:test` API unit suites plus server-backed integration suites (scratch `DATABASE_URL`, `JWT_SECRET`, running server), Vitest web suites incl. accessibility and timezone subsets, component tests with axe, 16 CI jobs (typecheck, builds, disposable-PostgreSQL migration checks, smoke, secret scan, `git diff --check`), read-only preview pytests under `backend/tests` reading credentials from the environment only. Every UI change is verified at 390px. Contract first: `lib/api-spec/openapi.yaml` → codegen → route; generated files are never hand-edited.

**Backup and release gates** — `docs/backup-restore-runbook.md` lists every control (owner, provider, frequency, retention, PITR, restore cadence, RPO, RTO) as `TBD`, which the gate document treats as a blocker for managed schema releases; a pilot drill was recorded once (dump 181 ms / restore 659 ms) and operator-only backup/restore-rehearsal scripts exist. Publication to `main` is by PR / reviewed fast-forward only; never force-push; one scoped task → one reviewed commit → `.agents/LOG.md` entry.

**Governance inconsistency to resolve** — `AGENTS.md` says never merge any `conflict_*` branch, yet PRs #89, #92, #93 and #94 merged Emergent-created `conflict_2609xx_*` branches into `main`. The plan treats those Save-to-GitHub branches as ordinary feature branches (they share a merge base with `main`) and the 26 historical no-merge-base refs as never-merge; an `AGENTS.md` clarification is part of Phase 1.

### 5. What exists vs. what is missing for Return Clients

| Needed | Exists today | Missing |
|---|---|---|
| Reliable completion signal | Provider-only, row-locked, terminal `completed` status; 409 on repeat | Completion timestamp, completion audit row, reversal path with audit, completion event |
| Tenant key | `provider_profile_id` | Multi-provider business (explicitly out of scope) |
| Client identity | `users` + JWT sessions; public booking page `/book/:slug` | Public phone-number lookup (deliberately never) |
| Ledger / rewards / members / consent / outbound log / reminders / QR sources | — | All new tables (additive artifact) |
| Vendor alerting surface | Provider notification feed + unread badge, SSE, Expo push | Event kinds beyond application lifecycle, digest, urgent/routine preference, deep links to member/reward |
| Client notices | Push infra (device-dependent) | Client in-app feed, email templates, consent gate |
| Scheduler for due clients | — | Any recurring job runner (needs an external trigger such as a Railway cron service hitting a guarded admin endpoint) |
| Two-way channel | — | None; "replied" can never be shown in this design |
| Admin correction audit | Append-only history tables; `admin_audit_log` proposed | Loyalty adjustment events with required reason |
| Repeat-booking baseline | Scorecard `repeatClients` (distinct clients with ≥2 completed visits), pilot repeat-client rate | Pre-launch baseline snapshot per program |
| Demo isolation | `DEMO_EMAILS` allowlist, `isDemo` badges | `users.is_demo` (proposed) |

### 6. Source material lessons (transcripts), translated

- Marc's engine: QR scan → phone-number form → `+1` point via math action on a custom field; 30-minute cooldown with "potential point abuse" owner alert; 10 visits → coupon by text/email with a redeem QR; owner scans, enters a 4-character passcode; coupon invalid on reuse; points reset to zero after redemption; welcome message + first point on signup; 30-day "we miss you" text with a coupon; Google-review ask at redemption; LeadConnector notifies the owner on every signup/point/redemption/abuse attempt.
- What transfers: a visible owner feed of meaningful events, a single-use redeem token confirmed by the vendor, an already-enrolled path, a due-client rule, and simplicity ("everyone understands: come in N times, get this").
- What does not transfer: a scan is not proof of a paid service; a mutable point counter is replaced by an append-only ledger; points are not reset by deletion but by a new earning cycle recorded in the ledger; no reward for reviews; no message without separate promotional consent; no "replied" without an inbound channel; Marc's 10-visit/30-day settings and $97/$20K figures are not defaults or forecasts.

### 7. The revised first slice (what Phase 1 produces — documents only, in the real repository)

A **reviewed design packet** (Checkpoint B) committed on a feature branch with no application code, no migration applied, no secrets:

1. **Repo reality report** in `docs/neo/` (this document's sections 2–5 with the evidence table produced after the clone: full SHAs, merge-base, test results).
2. **Data and state design**: `return_programs` (one per provider, versioned rules and terms), `return_members` (unique per program + client, enrollment source recorded separately from any credit), `return_ledger_events` (append-only signed events with actor, source, booking reference, reason and a unique idempotency key `return-credit:{program_id}:{booking_id}`, plus a partial unique index guaranteeing one credit per booking), `return_rewards` (unlocked → redeemed | expired | reversed, hashed single-use token, redeemer and timestamp), `return_consents` (append-only, purpose transactional vs promotional, channel, wording version, evidence, withdrawal), `return_outbound_messages` (template version, purpose, channel, status incl. `dry_run` and `suppressed` with reason, provider id if any), `return_reminders` (due date, status, suppression reason, resulting booking), `return_qr_sources` (per-program codes; scans counted without PII). Current progress is a projection reconcilable from the ledger. State machines for program, member, reward and reminder, with every edge case from the handoff (cancel, no-show, reschedule, replay, reversal, multi-service, cross-vendor, pause, demo, import).
3. **Event and retry design**: the credit is appended inside the existing completion transaction (drift-safe: skipped and logged if the artifact is not applied), reward unlock in the same transaction, notifications post-commit and never rolled back; an admin reconciliation view lists "completed bookings under an active program without a credit" so gaps from replay, drift or bugs are detected rather than hidden.
4. **Permission matrix** per role and route, using the existing middlewares; token hashing and no public balance lookup.
5. **Consent model and compliance notes** for Canada (CASL): enrollment = transactional programme notices only; reactivation requires a separate recorded opt-in; unsubscribe honoured everywhere; review requests neutral and never rewarded; a "needs legal review" list of exact wordings.
6. **Frozen SQL artifact** `docs/migrations/RETURN_CLIENTS_V1.sql` written, hashed and rehearsed only against disposable PostgreSQL — status PROPOSED / NOT APPLIED — and the proposed OpenAPI paths listed (not yet added to the spec).
7. **Wireframes** (text/HTML like the existing dashboard wireframe) for the provider "Return Clients" page (overview counts, action queue, activity feed with filters, member progress, mobile Redeem), the seven-step setup wizard with demo-mode test run, the client progress page with Book again, the public program page, and the admin list/drill-down and correction dialog.
8. **Test and rollback plan** mapping the 14 acceptance criteria to unit, integration, component and read-only preview tests; rollback by restore, per house policy.
9. **GoHighLevel comparison worksheet** in the requested columns, pre-filled only from the transcripts and marked as such until the owner supplies screenshots from the trial.
10. **Pilot-vendor questionnaire** (return cadence, who marks complete, existing follow-up, reward the vendor will fund, QR practicality during a home visit, off-platform clients, digest vs urgent) and the `AGENTS.md` clarification about Save-to-GitHub branches.

## User flow

- **Provider**: opens Return Clients → guided setup (outcome → eligible services and threshold → reward → return timing and messaging → consent wording and terms → preview → demo test run → activate and share QR/link) → later, marks a visit completed as today → the activity feed shows "credit recorded"; when a reward unlocks, the action queue shows "1 reward ready to redeem" → at the next visit, taps Redeem, scans or types the client's code, confirms → confirmation for both sides.
- **Client**: after a completed visit sees progress in the portal (or via the post-appointment link) → at the threshold receives the reward code and terms → books again from the same screen → manages notice preferences and can withdraw promotional consent at any time. Scanning a QR shows the program and asks to sign in or register; it never grants a visit credit.
- **Admin**: sees every program with status, rule version, enrollments, verified credits, rewards, due clients, message outcomes, failures and "last successful event"; an action queue surfaces paused programs, programs with no eligible services, failed messages, unusual manual adjustment rates and disputed redemptions; every correction requires a reason and appears in the audit history visible to the provider.

## UI/UX feel

Follows the repository's own `docs/ux-guidelines.md` and `docs/design-guidelines.json`: mobile-first at 390px, calm plain-language copy, cards that answer "what happened, why it matters, what to do next, how we will know" (the pattern of the existing `/admin` home and provider scorecard), exact counts with "n of 5 so far" style thresholds, and honest labels that separate **verified** (completed bookings, redemptions), **observed** (booking after enrollment) and **attributed under a stated rule** (booking within the window after a reminder). No revenue claims, no "review generated" claims, no fake inbox.

## Implementation phases

**Phase 1 — Checkpoint B, reviewed design (built now, documents only).** Clone read-only to `/app/foot`, reconcile and record evidence, run the existing test suites against a disposable database, and deliver the ten-item design packet above on a feature branch. Stop for review. No application code, no schema applied, no Supabase, Railway, secrets, push, merge or deploy.

**Phase 2 — Checkpoints C and D, end-to-end loyalty loop.** After the artifact hashes are approved and applied through Gate B by the owner (with the backup gate satisfied): Drizzle mirror, OpenAPI + codegen, ledger and reward services with idempotency and tenant isolation, completion hook, enrollment (booking-based and QR/link), client progress, reward unlock and one-time redemption, provider setup wizard and Return Clients page, in-app notifications and outbound-message log in dry-run mode, demo-mode walkthrough, full test coverage of the edge cases. Vendor confirms return cadence and reward before activation; no production defaults.

**Phase 3 — Checkpoints E and F, Return Engine and oversight.** Due-client evaluation behind a guarded endpoint triggered by an external schedule (there is no in-app scheduler), consent-gated email reminders through the existing Emergent email proxy only once credentials, wording review and per-vendor limits are signed off, suppression rules, digest and urgent/routine preferences, deep links, admin health view, correction and failure queues, baseline and attribution reporting, then a small pilot measured on activation and repeat use.

## Assumptions

Decisions made without asking; each can be reversed at review.

1. The canonical baseline is `origin/main` at `1213110d491c73c4879f8217176f73aeff3ef294` (2026-09-27T04:36Z). No other branch or local worktree is presumed newer; if one exists, it must be named before Phase 1 starts.
2. The real repository is cloned to `/app/foot` as a sibling of the untouched starter; the starter is never overwritten unless a live preview is later approved.
3. The managed Supabase database is not accessed in Phases 1–2; all schema and test work uses disposable local PostgreSQL. The gitignored `.env` and `memory/` files are requested only if a live preview is approved.
4. The program owner is `provider_profile_id`; exactly one program per provider; credits, rewards and members are always scoped to that provider.
5. The only credit source is a booking reaching `completed` through the existing status route. QR scans and public sign-ups enroll only. Vendor-confirmed off-platform check-ins are deferred to a separately gated design.
6. One credit per completed booking regardless of how many services it covers; cancelled, no-show and rescheduled bookings never credit; an admin force-reversal of a completion appends a reversal event and reverses an unredeemed reward; a redeemed reward is never clawed back automatically but is flagged for admin review.
7. The ledger insert runs inside the existing completion transaction (skipped with a warning if the artifact is absent, matching the drift-safe pattern). Alternative if rejected: post-commit write with the reconciliation view as the safety net.
8. No production program default. The setup wizard requires the vendor to choose threshold, reward and return window; the "5 completed visits / 6-week window" figures appear only as a labelled pilot hypothesis example, and Marc's 10-visit / 30-day settings are not offered as defaults.
9. Consent: enrolling grants transactional programme notices (in-app, and email to the account address). Reactivation reminders require a separate, recorded promotional opt-in with wording version and timestamp. Exact CASL wording is reviewed by the owner or counsel before any live reminder; the target market is Canada (Southern Ontario pilot, CAD).
10. Channels: Phase 2 delivers in-app notifications plus a dry-run outbound log only; live email is Phase 3 and only through the existing Emergent proxy after credential, cost and consent sign-off; SMS is out of scope (no provider, no cost model); a "replied" status will never be displayed because no inbound channel exists.
11. Client identity is the existing account; the public program page offers sign-in or registration; no lookup by phone number or guessable URL; reward tokens are stored hashed and shown once.
12. Return Clients ships its own append-only ledger and admin adjustment events (reason required). The proposed `admin_audit_log` and `users.is_demo` artifacts are helpful but not dependencies; demo isolation uses the existing `DEMO_EMAILS` allowlist until `is_demo` is applied.
13. Money labels use invoice `amount_cents` or service `price_cents` and are always called "booking value (not paid revenue)". The pre-launch repeat baseline reuses the scorecard definition (distinct clients with two or more completed visits) and shows "insufficient baseline" below a stated minimum.
14. Emergent Save-to-GitHub `conflict_*` branches are treated as feature branches (as PRs #89–#94 already did); the 26 historical no-merge-base refs stay never-merge; `AGENTS.md` is updated to say so in Phase 1.
15. The GoHighLevel worksheet is populated from the transcripts only and labelled as such; no trial account is connected to production data and no live campaign is sent.
16. All existing gates stay in force: this plan authorises no production, Supabase, Railway, SQL, secret, push, merge or deployment action; each phase begins only on an explicit, named go-ahead.
