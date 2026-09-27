# Neo Handoff — Admin Command Center & Provider Experience Plan

Date: 2026-09-26 · Authors: E1/Neo session (draft) + E2 verification pass (this
version) · Status: **PLAN AND EVIDENCE RECORD — NOT APPROVAL TO EXECUTE**

This is a read-only handoff for the next Neo. It records the verified state of
the local workspace, the repository, Railway and Supabase at the end of the
2026-09-26 sessions, and a phased plan for an admin command center that works
together with the provider experience. **Nothing in this document authorizes
execution of any phase.** The next Neo must run Phase 0 first and stop for
user review before any implementation.

Evidence labels used throughout:

- **[VERIFIED]** — observed directly on 2026-09-26 by the writing session
  (command output, HTTP response, file grep, bundle grep, screenshot). The
  evidence location is named.
- **[VERIFIED-PRIOR]** — observed by the earlier 2026-09-26 E1 session and
  recorded in `memory/PRD.md` / commit messages, but **not** re-observable
  read-only by the verification pass (e.g. Railway variables, Supabase catalog).
  Treat as strong but re-verify in Phase 0 where a read-only path exists.
- **[CLAIMED]** — stated in an earlier report/inventory only; hypothesis.
- **[UNVERIFIED]** — no evidence either way.
- **[CORRECTED]** — an earlier statement that this pass found to be wrong.

---

## 0. Product vision (why this plan exists)

OnCall Foot / Portal1 needs an admin command center and a provider experience
that work together:

- **Admin** operates a trustworthy, responsive marketplace: approve and support
  providers, resolve exceptions, identify unmet client demand, and improve
  service quality. Admin should not have to manually interpret disconnected
  reports.
- **Providers** manage their own businesses: profile, credentials, services,
  availability, bookings, client experience and performance. Providers must
  never see platform-wide private data or internal risk notes.
- **Clients** get easier access to suitable, verified care and reliable
  booking and support.
- Every dashboard item must answer: *What happened? Why does it matter? What
  can this person do next? How will we know it worked?*
- Vendor value = practical help with readiness, booking conversion, response
  times, availability, repeat use and service quality — **not** vanity numbers
  or unsupported revenue promises. Platform value = a healthier marketplace,
  visible operational problems, evidence-based decisions.

---

## 1. State snapshot

### 1.1 Git (local Emergent workspace `/app`, IDE `vscode-785221eb-…`)

| Item | Value | Evidence |
|---|---|---|
| Local branch | `main` | `git branch --show-current` [VERIFIED] |
| Local HEAD | `7af23c6b1885c9213c75f7d33c9f782eefc2d11d` (2026-09-26 15:35:42 +0000, author `emergent-agent-e1`) | `git rev-parse HEAD`, `git log -4 --format=%H %ad %an` [VERIFIED] |
| Local commit chain (all by the platform checkpoint mechanism, same author) | `7af23c6` ← `befb072` (15:26) ← `3268eae` (15:23) ← `6a9a080` (15:18) ← `7c09176` | `git log` [VERIFIED] |
| Working tree | Two untracked files only: `docs/neo/2026-09-26-admin-vendor-command-center-plan.md` (this document) and `frontend/yarn.lock` (preview-shim artefact). No modified tracked files. No stash. No tags. | `git status --short --branch`, `git stash list`, `git tag` [VERIFIED] |
| **Git remote** | **NONE configured** in this workspace (`git remote -v` empty; `.git/refs/remotes` absent). GitHub publication from this workspace happens only through the Emergent "Save to Github" action, which has previously pushed to a `conflict_*` branch, not to `main`. | `git remote -v`, `ls .git/refs/remotes`, `git config --get remote.origin.url` [VERIFIED] |
| Remote `origin/main` | `5a8ec42 Conflict 260926 1108 (#89)` — squash-merge of branch `conflict_260926_1108` | bare `--filter=blob:none` clone inspected by the E1 session [VERIFIED-PRIOR]; not re-fetchable here (no remote) |
| Local vs remote | Local `main` is **not** a descendant of remote `main` (squash produced a new SHA). Content of local `7c09176` == remote `5a8ec42`. Local `6a9a080..7af23c6` is **not on GitHub**. | E1 session `git merge-base --is-ancestor` false [VERIFIED-PRIOR]; diff below [VERIFIED] |
| Remote `docs/admin-handoff-2026-09-26` | Created remotely from `main`; tip `5a8ec42`, **identical to `origin/main`**, contains no extra files; its `docs/neo/` holds only `2026-08-21-client-retention-handoff.md` | E1 bare-clone inspection [VERIFIED-PRIOR]. Cannot be inspected from this workspace (no remote) — **do not assume it has been fetched; do not merge it blindly** |
| Remote `conflict_260926_1108` | Snapshot branch, already merged via PR #89; non-authoritative afterwards | [VERIFIED-PRIOR] |

**The "16 uncommitted files" from the earlier inventory — resolved
[VERIFIED]:** they no longer exist as uncommitted files. They were
auto-committed by the platform checkpoint mechanism into local commits
`6a9a080`, `3268eae`, `befb072`, `7af23c6`. They are now **committed locally on
`main` but not on GitHub**. Exact content of `git diff --stat 7c09176..HEAD`
= **27 files, +1466 insertions, 0 deletions**:

```
artifacts/api-server/src/lib/demo-data.ts                          +118 (new)
artifacts/api-server/src/lib/system-status.ts                      +132 (new)
artifacts/api-server/src/routes/admin.ts                           +30  (system-status, demo-data, demo-data/purge)
artifacts/web/src/App.tsx                                          +2   (/admin/system route)
artifacts/web/src/components/admin-system/demo-data-section.tsx    +84  (new)
artifacts/web/src/lib/routes.ts                                    +2   (ROUTES.admin.system)
artifacts/web/src/pages/admin/system.tsx                           +132 (new)
artifacts/web/src/pages/admin/verification.tsx                     +6   (nav links Pilot/System)
backend/tests/test_orbite_approved_endpoints.py                    +56  (Emergent testing-agent artefact, preview-only)
backend/tests/test_system_status_and_providers.py                  +168 (same)
lib/api-client-react/src/generated/api.schemas.ts                  +76  (orval codegen)
lib/api-client-react/src/generated/api.ts                          +229 (orval codegen)
lib/api-spec/openapi.yaml                                          +143 (+3 operations, +2 schemas)
lib/api-zod/src/generated/api.ts                                   +83  (orval codegen)
lib/api-zod/src/generated/types/{index,demoDataSummary,demoDataSummaryCounts,
  demoDataSummaryUsersItem,purgeAdminDemoData200,purgeAdminDemoDataBody,
  systemStatusResponse,systemStatusResponseDatabase,systemStatusResponseEnvItem,
  systemStatusResponseMigrationsItem,systemStatusResponseOverall,
  systemStatusResponseRuntime}.ts                                  12 files (orval codegen)
scripts/apply-frozen-migrations.py                                 +33  (new; Gate-B apply-once runner)
```

Also on GitHub `main` via PR #89 (earlier the same day) [VERIFIED-PRIOR]:
`artifacts/web/src/App.tsx` redirect fix, `artifacts/web/index.html` boot
screen, `artifacts/api-server/src/index.ts` `JWT_SECRET` fail-fast,
`backend/server.py`, `frontend/package.json`, `backend/tests/backend_test.py`,
`backend/tests/test_orbitetech_login.py`. `backend/` and `frontend/` are
**Emergent preview shims** (FastAPI proxy 8001→Node, SPA on 3000; the
supervisor expects those paths). They are not part of the product, are not in
`pnpm-workspace.yaml`, and are harmless to Railway; decide in Phase 0 whether
they stay.

**Process gaps found by this pass [VERIFIED]:**

- `.agents/LOG.md` has **no entry dated 2026-09** (last entry 2026-08-30).
  `.agents/AGENT-RULES.md` §2 and `AGENTS.md` require a LOG entry per session.
  The 2026-09-26 work (PR #89 + the 27 local files) is therefore invisible to
  the mandated read order. Phase 0 must add the entry (docs-only).
- `docs/commit-strategy.md` "Project-Specific Constraints" still states
  **"Provider-first scope only — do not build client or admin portals yet"**.
  This plan proposes admin work; the owner must explicitly lift or amend that
  constraint (docs-only edit) before Phase 1. Do not treat this handoff as
  that lift.

### 1.2 Feature location matrix

| Feature | Workspace (local `main`) | GitHub `main` | Railway (live) | Evidence |
|---|---|---|---|---|
| Root `/` blank-page fix (wouter chained redirect) | ✅ | ✅ (#89) | ✅ | live `/` serves SPA; E1 Playwright `/`→`/login` [VERIFIED-PRIOR] |
| Branded boot screen (`index.html`, `app-boot-screen`) | ✅ | ✅ | ✅ | `curl https://foot-production-9784.up.railway.app/` contains `app-boot-screen` (1 hit) [VERIFIED] |
| `JWT_SECRET` fail-fast at startup (`index.ts:6-10`) | ✅ | ✅ | ✅ | source [VERIFIED]; Railway crash log then successful boot [VERIFIED-PRIOR]; live `/api/healthz` → `200 {"status":"ok"}` [VERIFIED] |
| `/admin/system` page + `GET /api/admin/system-status` | ✅ | ❌ | **❌ NOT DEPLOYED** | **[CORRECTED]** see below |
| Demo-data summary/purge API + UI section | ✅ | ❌ | ❌ NOT DEPLOYED | same bundle evidence |
| `scripts/apply-frozen-migrations.py` | ✅ | ❌ | n/a | diffstat [VERIFIED] |
| Verification queue, pilot dashboard, provider portal, bookings, reschedule, cancellation, support APIs | ✅ | ✅ (pre-existing) | ✅ (bundle contains `/admin/verification`, `/admin/pilot`) | live bundle grep [VERIFIED]; behaviour regression-tested **in preview only** (`test_reports/iteration_1-4.json`) |

**[CORRECTED] How "is `/admin/system` live?" was decided.** Earlier reports
called `/admin/system` "live" — that referred to the **Emergent preview URL**,
not Railway. The first draft of this handoff then cited a live `404` on
`/api/admin/system-status` as proof it was not deployed. That evidence is
**invalid**: `routes/admin.ts` line 22 mounts `requireAuth, requireRole("admin")`
on the whole router, so **every** unauthenticated `/api/admin/<anything>`
returns `401 {"error":"Authentication required."}` on Railway — including
`/api/admin/nonexistent-xyz-123` [VERIFIED]. A 401 says nothing about
deployment. The valid evidence is the built JS bundle:

| Bundle | `/admin/system` | `system-status` | `demo-data` | `DELETE DEMO DATA` |
|---|---|---|---|---|
| Railway live `assets/index-C2Z5U7C7.js` (729,228 bytes) | 0 | 0 | 0 | 0 |
| Preview `assets/index-CVNSPxq3.js` (742,998 bytes) | 1 | 1 | 2 | 1 |

`grep -c` on both bundles, 2026-09-26 [VERIFIED]. Conclusion: **`/admin/system`
and the demo-data tooling exist only in this workspace (local commits) and are
not on GitHub or Railway.** Phase 0 must repeat this bundle check, because a
Railway redeploy would change the hash.

### 1.3 Railway deployment & the `JWT_SECRET` / login blocker

Live URL: `https://foot-production-9784.up.railway.app` (from `memory/PRD.md`).

| Item | Status | Evidence |
|---|---|---|
| Service | project `bountiful-adaptation` / env `production` / service `foot`, deploys branch `main` | Railway GraphQL with a user-supplied project token [VERIFIED-PRIOR]; not re-verifiable read-only |
| Crash after PR #89 | `Error: JWT_SECRET environment variable is required…` at `index.ts`, repeated restarts | user-uploaded `logs.1790437463878.log` [VERIFIED-PRIOR] |
| Root cause | Variable existed under the wrong name **`JWT`**; `JWT_SECRET` absent. Before #89 this made every *valid* login return 500 (token signing threw) | Railway `variables` query (names/lengths only) [VERIFIED-PRIOR] |
| Remediation | With explicit user approval: `JWT_SECRET` (fresh `openssl rand -hex 32`, **value never recorded**), `NODE_ENV=production`, `JWT_EXPIRES_IN=7d` set via `variableUpsert`; Railway auto-redeployed → `SUCCESS` | [VERIFIED-PRIOR] |
| Live health now | `GET /api/healthz` → 200; `GET /api/providers` → 200 with provider list; SPA served with boot screen | curl 2026-09-26 [VERIFIED] |
| Live login | `orbitetech12@gmail.com` login 200 + token; `/api/auth/me` 200; `/api/providers/me/dashboard` 200; browser `/`→`/login`→dashboard | E1 session curl + Playwright [VERIFIED-PRIOR]. **Not re-run by this pass** (would require using the user's credentials) |
| Not verified on Railway at all | `/admin/system` (not deployed), admin approve/verify UI, reschedule/cancellation flows (preview-tested only) | [UNVERIFIED on Railway] |
| Follow-ups for user | Revoke the Railway project token used on 2026-09-26; optionally delete the stale `JWT` variable | — |

### 1.4 Supabase (managed production database)

No secrets or records are copied here. `memory/` is workspace-only (not in
the repo, not on GitHub).

| Claim | Status | Evidence location |
|---|---|---|
| Railway and preview both use the same Supabase DB (`aws-0-us-west-2` session pooler, PG 17.x) | [VERIFIED-PRIOR] | identical provider lists on both origins; system-status output in preview |
| 8 of 10 frozen artifacts in `docs/migrations/*.sql` were unapplied; all 8 applied 2026-09-26 with user approval, one transaction each, SHA-256 recorded | Ledger file exists with 8 hash lines + `APPLIED …` lines [VERIFIED]; the DB-side effect [VERIFIED-PRIOR] | `memory/migration-apply-2026-06.txt` (hashes only). Runner: `scripts/apply-frozen-migrations.py` (local commit) |
| Drizzle schema ↔ DB: 260/260 columns match | [VERIFIED-PRIOR at apply time] | ad-hoc `drizzle-kit generate` → catalog diff (not stored) |
| Preview `/admin/system` shows "All checks passing", 10/10 migrations applied, env vars `isSet` without value leakage | [VERIFIED-PRIOR] | `test_reports/iteration_3.json` summary |
| Gate-B ledger entry per `docs/managed-db-release-gate.md` | **NOT written into the repo** — hashes exist only in workspace `memory/`. Phase 0 should copy them into the repo ledger the gate expects (docs-only) | [VERIFIED gap] |
| Seed (`artifacts/api-server/src/seed.ts`) run against Supabase: users `admin/sarah/mike/jane/tom@oncallfoot.com`, Sarah/Mike profiles + approved applications, 5 services, availability, travel zones, 4 bookings, 1 review; plus `qa.provider@oncallfoot.test` | [VERIFIED-PRIOR] | seed stdout; preview `GET /api/admin/demo-data` → users=5, providerProfiles=3, services=5, bookings=4, reviews=1 |
| `orbitetech12@gmail.com` (user 25 / profile 8 / application 6) approved via real admin endpoints (`POST /admin/provider-applications/6/approve` + `PATCH /admin/verification/docs/3` with `updateProviderStatus=approved`) | [VERIFIED-PRIOR] | `test_reports/iteration_4.json`; `provider_application_events` row |
| Demo purge executed | **NO.** A dry-run inside a rolled-back transaction only. The purge button/API has never been run | [VERIFIED-PRIOR]; live bundle proves the UI is not even deployed [VERIFIED] |
| `admin@oncallfoot.com` is the only admin and still uses the seed password | [VERIFIED-PRIOR] — security follow-up | |
| Demo identification | Interim **email allowlist** `DEMO_EMAILS` (5 emails, `role <> 'admin'`) in `lib/demo-data.ts` | source [VERIFIED]; must not become permanent (Phase 4, Hard stops) |

**Security follow-up found by this pass [VERIFIED]:** plaintext passwords for
a real user account (`orbitetech12@gmail.com`) and for seed/QA accounts appear
in files that are **tracked in Git**: `backend/tests/test_orbitetech_login.py`
(2 literals) and `backend/tests/backend_test.py` (2) — both on GitHub `main`
via PR #89 — and `backend/tests/test_orbite_approved_endpoints.py` (1) and
`backend/tests/test_system_status_and_providers.py` (5) — in the local
unpushed commits. (`git ls-files backend/tests` lists all four; grep for
password literals, values not copied here.) `memory/` and `test_reports/`
also contain them but are gitignored (`.gitignore` lines 58, 77) and untracked
[VERIFIED]. **Phase 0 must ask the user to rotate the real account password
and decide whether to redact/remove these preview-only test files before the
local commits are published.** Do not copy the values anywhere.

### 1.5 Where things are (paths verified to exist 2026-09-26)

- **Mandatory read order (`AGENTS.md`):** `docs/roadmap/NEO_EAGLE_VIEW.md`
  (§5 "Admin / Operations Portal — implemented vs roadmap": verification
  queue and reviewer decisions COMPLETE; booking oversight, support admin
  side, invoices admin view **NOT STARTED**; analytics reporting BLOCKED
  Gate B) → `.agents/AGENT-RULES.md` → `.agents/SETUP.md` →
  `.agents/NEXT_TASK.md` → latest `.agents/LOG.md` entries.
- Admin API: `artifacts/api-server/src/routes/admin.ts` (router-wide
  `requireAuth, requireRole("admin")` line 22; `GET /system-status`,
  `GET /demo-data`, `POST /demo-data/purge` (typed confirmation), `GET
  /verification/queue`, `PATCH /verification/docs/:docId`, `POST
  /provider-applications/:id/approve|reject` with `decideProviderApplication`
  transaction, self-review 403, non-`under_review` 409, event + notification
  + activation events in the same transaction), `admin-pilot.ts`,
  `support.ts` (admin section after line 169: `GET
  /support/bookings/:bookingId/escalations`, `PATCH /support/escalations/:ticketId`).
- Auth/permissions: `artifacts/api-server/src/middlewares/auth.ts`
  (`requireAuth`, `requireRole`, `requireApprovedProvider`,
  `requireApprovedProviderIfProvider`, `requireSelf`); policy
  `docs/roles-and-permissions.md`.
- Provider API: `routes/providers.ts` (4,354 lines; `requireProviderOperation`
  = auth + provider role + approved application **and** approved
  `provider_profiles.verification_status`). Earnings: lines 3451-3478.
- Schema: `lib/db/src/schema/*.ts`. Events enum:
  `lib/db/src/schema/marketplace-events.ts` (16 types: 7 provider-activation
  + 9 discovery/booking). Emitter:
  `artifacts/api-server/src/lib/marketplace-events.ts` — emits **only** the 7
  activation types; `booking_started/submitted/confirmed`, `provider_search`,
  `provider_viewed`, `availability_slot_selected` have **zero** occurrences in
  `routes/bookings.ts`, `booking-pages.ts`, `providers.ts`, `reschedule.ts`
  [VERIFIED by grep].
- Web admin pages: `artifacts/web/src/pages/admin/{verification,pilot,system}.tsx`;
  routes `lib/routes.ts` (`ROUTES.admin.{verification,pilot,system}`),
  `App.tsx` lines 121-123; admin login lands on `ROUTES.admin.verification`
  (`pages/login.tsx` line 29) — **there is no `/admin` landing page**.
- Provider dashboard: `pages/portal/dashboard.tsx`, `components/dashboard/`,
  `lib/provider-readiness.ts`; capability docs
  `docs/provider-dashboard-capability-inventory.md`,
  `docs/provider-dashboard-conversion-playbook.md`.
- Tests: `artifacts/api-server/src/__tests__/*.test.ts` (node:test; includes
  `reviewer-decisions`, `authorization-hardening`, `marketplace-events`,
  `pilot-metrics`, `support-contact`), `artifacts/web/src/**/*.test.tsx`
  (vitest). CI: `.github/workflows/ci.yml`. Preview-only reports:
  `test_reports/iteration_{1..4}.json` (Emergent testing agent, not CI).
- Scripts: `package.json` → `typecheck`, `build:deploy`, `git:check`
  (`scripts/check-github-sync.sh`), `publish:gate`
  (`scripts/verify-publication.sh`), `scripts/secret-scan.sh`.
- Continuity/handoffs: `docs/neo/2026-08-21-client-retention-handoff.md`,
  `docs/neo-handoff-scope.md`, `docs/github-continuation.md`,
  `docs/commit-strategy.md`, `docs/checkpoint-notes-guide.md`,
  `docs/graphify-continuity-workflow.md`, `docs/NEXT-STEPS.md`,
  `docs/TODO-LEDGER.md`, `AGENTS.md`, `replit.md`.
- Deployment/DB governance: `docs/deployment-notes.md`,
  `docs/managed-db-release-gate.md`, `docs/backup-restore-runbook.md`,
  `docs/gate-b-backup-rehearsal-checklist.md`, `docs/pilot/*` (support
  workflow, incident runbook, pilot metrics dashboard).
- Workspace-only memory (not in repo): `memory/PRD.md`,
  `memory/test_credentials.md`, `memory/migration-apply-2026-06.txt`.
- The **Google Analytics transcript** referenced by the user was **not found**
  in `attached_assets/` (25 files, none analytics-related) [VERIFIED]. Treat
  it as inspiration only; it is not a specification and nothing here installs
  tracking. `artifacts/web/index.html` contains no `gtag`/GTM code [VERIFIED].

Graphify status (format per `docs/graphify-continuity-workflow.md`):
```text
Graphify status:
- Graph files present: graphify-out/graph.json, GRAPH_REPORT.md, graph.html, manifest.json [VERIFIED]
- Main graph artifact baseline: 96b7102694d656112d9e486205d4850333040918 (refreshed 2026-08-28) [VERIFIED-PRIOR] — NOT refreshed on 2026-09-26
- Extraction mode: CODE-ONLY LOCAL
- HEAD differs materially from baseline (PR #89 + 27 local files): graph potentially stale; refresh recommended, non-blocking
- Safety: no external APIs, no managed DB introspection, no hooks, no CI gate
```

---

## 2. Admin–provider collaboration model

### 2.1 Roles as implemented [VERIFIED in code]

| Actor | Identity in code | What they own |
|---|---|---|
| Platform admin | `users.role = 'admin'`, `account_roles.role = 'admin'`; `requireRole("admin")` | Provider application decisions; credential (verification doc) review; provider `verification_status`; pilot retention notes; support escalation resolution; system health; demo-data lifecycle |
| Provider (vendor) | `users.role = 'provider'` + `provider_profiles` + `provider_applications` | Own profile, credential submission, services, availability (weekly, blocked ranges, emergency openings), travel zones / service area, public booking page, responding to booking requests, reschedule proposals, cancellations / no-show marking, own earnings & metrics |
| Client | `users.role = 'client'` | Discovery, service-area check, booking requests, reschedule accept/decline, cancellation, reviews, support escalations |
| Public | — | `GET /providers`, `/providers/:id`, `/booking-pages/:slug`, slots, reviews |

### 2.2 Hand-offs between roles (existing flows, with UI status)

```
Provider registers → drafts application (profile, services, availability, docs)
  → POST /providers/application/submit                          [provider]   UI ✅
  → admin reviews docs: PATCH /admin/verification/docs/:id       [admin]      UI ✅ (/admin/verification)
  → admin decides: POST /admin/provider-applications/:id/approve|reject
                                                                 [admin]      API ✅, UI ❌ (none)
  → provider is operable only when application.status='approved'
    AND provider_profiles.verification_status='approved'         [system gate — two-part; confused this session]
  → readiness checklist GET /providers/me/readiness              [provider]   UI ✅
  → publish booking page POST /providers/me/booking-page/publish [provider]   UI ✅
Client finds provider → service-area check → slots → POST /bookings (requested) [client]
  → provider PATCH /bookings/:id/status (confirmed/…)            [provider]   UI ✅
  → reschedule proposals, accept/decline                         [either]     UI ✅
  → cancellation / no-show with policy preview + outcome history [either; audit table]
  → completed → client review                                    [client]
  → support escalation POST /support/escalations                 [client/provider]
  → admin resolves PATCH /support/escalations/:id                [admin]      API ✅, UI ❌ (none)
  → improvement recommendation                                   [FUTURE — Phase 6, exact data only]
```

### 2.3 Boundaries

**Admin may see:** all applications, doc metadata, verification status,
reviewer notes, all bookings and outcome history, support tickets, pilot
metrics, system health (env *presence* only — values are never sent), demo-data
inventory.

**Provider may see only their own:** profile, services, availability, bookings
where `provider_id` = own profile, reschedule/outcome history for those
bookings, own reviews, own earnings, own readiness, own application status
with the provider-visible `rejection_reason` only (`routes/providers.ts`
~line 230: "only public fields, never reviewerNotes" [VERIFIED]). Every new
provider endpoint must scope by the caller's profile id (`getOwnProfile(req.user.sub)`),
never by a client-supplied id.

**Clients see:** public listing data, own bookings, own reviews, own tickets.

**Must NEVER appear in a provider dashboard, client payload, log line or
analytics event:** `reviewerNotes` / rejection internals beyond
`rejection_reason`; other providers' bookings, ratings breakdown or revenue;
verification document contents or file names of other providers; client
email, phone, address, `bookings.care_notes` (health-adjacent); password
hashes, JWTs; env var values, DB hosts, stack traces; platform-wide counts
that reveal competitor activity; internally computed "risk"/"quality" scores
unless the definition is published to providers.

**Audit today vs needed:** admin decisions write `provider_application_events`
(submitted/reset/approved/rejected) and booking changes write
`booking_outcome_history`; pino logs capture admin reads; demo purge logs a
`warn` with admin id and counts. There is **no general admin audit table**
for verification-doc decisions, retention notes, support resolutions or demo
purge. Phase 4 proposes one (additive; SQL shown before apply).

---

## 3. Phased roadmap

Each phase is independently finishable and ends with a **STOP** for user
review. No phase authorizes the next.

### Phase 0 — Recover & reconcile (no product code)

- **Value:** admin/provider/client all benefit from knowing exactly what is
  live; protects the production DB and deploy branch.
- **Reuse:** this document; `docs/managed-db-release-gate.md`;
  `docs/github-continuation.md`; `memory/migration-apply-2026-06.txt`;
  `pnpm run git:check`, `pnpm run typecheck`, `pnpm run build:deploy`.
- **Smallest change (docs-only):** (a) reproduce §1 evidence: local SHAs, live
  bundle hash + grep, `git status`; (b) with the user, confirm the publication
  path for the 27 local files (expected: Save to Github → `conflict_*` branch →
  user opens PR → merge, as with #89) — **no push from the agent**; (c) copy
  the migration hashes into the repo ledger the gate expects (new dated file
  under `docs/`); (d) append the missing 2026-09-26 entry to `.agents/LOG.md`
  and update its Current Build State; (e) ask the owner to explicitly lift or
  amend the "do not build admin portals yet" constraint in
  `docs/commit-strategy.md`; (f) report the credential-in-tracked-tests finding (§1.4) and get the
  user's rotation/redaction decision; (g) record the decision on `backend/`/`frontend/` preview shims and
  `frontend/yarn.lock`.
- **Data deps:** none. **Permissions:** read-only; docs edits only.
- **Acceptance:** an evidence table (SHAs, bundle hash, grep counts, `git
  status`) presented to the user; only files under `docs/` and `.agents/`
  touched; typecheck and `build:deploy` pass on the local 27-file work.
- **Exclusions:** no merges, pushes, PRs, deploys, DB reads/writes, purges,
  Railway changes.
- **STOP:** user confirms publication path, constraint lift, and whether
  `/admin/system` + demo-data ship as-is.

### Phase 1 — Protected `/admin` landing page + small action queue

- **Value (admin):** one entry point answering "what needs me now?";
  (provider): faster approvals; (client): faster access to verified providers.
- **Reuse:** `pages/admin/{verification,pilot,system}.tsx` (header/nav and
  401/403 state pattern from `system.tsx`), `useGetAdminVerificationQueue`,
  `getAdminSystemStatus`, pilot metrics hooks, `ROUTES.admin.*`, login
  redirect (`pages/login.tsx` line 29 → change to `/admin`).
- **Smallest change:** new `pages/admin/index.tsx` at `/admin` with (1) queue
  cards computed **client-side from existing APIs**: pending verification docs
  (count + oldest age), system-status `degraded` warnings; (2) links to
  Verification / Pilot / System; (3) **one** new read-only endpoint
  `GET /admin/provider-applications?status=under_review` (spec first in
  `lib/api-spec/openapi.yaml`, codegen, then route; reuses
  `providerApplicationsTable` + `usersTable` under the existing router gate);
  (4) "Recent decisions" from `provider_application_events` (read-only).
  Every card states: what, why it matters, owner, age, next-action link,
  source record link.
- **Data deps:** existing tables only. **Permissions:** router-wide admin gate;
  page shows 401/403 states like `system.tsx`.
- **Acceptance:** unauthenticated and provider tokens get 401/403 from the new
  API (curl); admin sees queue; counts equal direct API calls; existing pages
  unchanged; `typecheck` + `pnpm test` + `build:deploy` pass; demo-owned
  items carry a "Demo" badge computed from `GET /admin/demo-data` user ids
  (interim only, see Phase 4); mobile 390px verified.
- **Exclusions:** no approve/reject UI yet, no new tables, no metrics beyond
  counts/ages, no funnel or revenue numbers.
- **STOP:** user reviews the landing page in preview before any publication.

### Phase 2 — Fill missing admin workflows with auditability

- **Value:** approval and support resolution no longer require raw API calls;
  decisions are traceable; providers get faster, clearer outcomes.
- **Reuse:** `POST /admin/provider-applications/:id/approve|reject`
  (`reviewerNotes`, required `rejectionReason`), `PATCH /support/escalations/:id`,
  `GET /support/bookings/:id/escalations`, `decideProviderApplication`,
  `createApplicationNotification`, `emitProviderActivationEvents`;
  `docs/pilot/support-workflow.md`.
- **Smallest change:** application detail drawer on `/admin` (profile summary,
  docs status, submission history, approve/reject with notes) and a support
  escalation list + resolve action. Make explicit in the UI that provider
  activation needs **both** application approval and verification-status
  approval.
- **Data deps:** existing. **Permissions:** admin only; provider-visible
  fields limited to `rejection_reason`.
- **Acceptance:** approving via UI writes a `provider_application_events` row
  and the provider's `GET /auth/me` flips; rejected provider sees only the
  provider-visible reason; ticket status changes are logged;
  `reviewer-decisions`, `provider-application*`, `authorization-hardening`
  tests still pass.
- **Exclusions:** no new audit table yet (Phase 4), no bulk actions.
- **STOP.**

### Phase 3 — Provider scorecard & practical next actions

- **Value (provider):** honest view of readiness and booking outcomes with
  concrete next steps; (client): better-prepared providers.
- **Reuse:** `GET /providers/me/dashboard`, `/me/metrics`, `/me/readiness`,
  `components/dashboard/*`, `components/readiness-checklist.tsx`,
  `lib/provider-readiness.ts`, `bookings` status enum, `reviews`.
- **Smallest change:** one scorecard card on `/provider/dashboard` with exact
  counts over a fixed window (requested → confirmed → completed; cancellations;
  no-shows; reviews count/avg; repeat clients = distinct `client_id` with ≥2
  completed), "insufficient data (< N)" states, and one suggestion per gap
  drawn from readiness **only if computable from own bookings**.
  **Correct the misleading earnings figures [VERIFIED `routes/providers.ts`
  3451-3478]:** `GET /providers/me/earnings` (a) sums `invoices.amount_cents`
  regardless of `status` — relabel "Booking value (invoiced, not confirmed
  paid)" or filter `status='paid'` and show "Paid" separately; (b) returns
  `completedBookings = profile.reviewCount` (an approximation, per code
  comment) — replace with a real count of `bookings.status='completed'`;
  (c) `pendingPayoutCents` is hard-coded 0. There are 0 invoices and no
  payment backend wired.
- **Data deps:** own rows only. **Permissions:** `requireProviderOperation`;
  all queries filtered by own `provider_profiles.id`.
- **Acceptance:** fixture-based unit test per metric definition; Vendor A token
  cannot fetch Vendor B's scorecard; demo providers show a "Demo account"
  banner; copy contains no causal or revenue-uplift claims.
- **Exclusions:** no cross-provider benchmarks; no response-time metric until
  request/response timestamps in `bookings` are verified.
- **STOP.**

### Phase 4 — Data quality: demo identification, metric definitions, admin audit

- **Value:** every number has a definition; demo data can never masquerade as
  real; admin actions are reviewable.
- **Reuse:** `DEMO_EMAILS` (interim), `provider_application_events`,
  `booking_outcome_history`, `docs/managed-db-release-gate.md`,
  `docs/migrations/*.sql` style, `scripts/apply-frozen-migrations.py`.
- **Smallest change:** propose (show SQL, do **not** apply) two additive
  artifacts: `users.is_demo boolean default false` (backfill for seed emails as
  a separate reviewed step) and `admin_audit_log` (actor, action, target
  type/id, before/after summary, created_at). Write `docs/metrics-definitions.md`
  covering every displayed metric with SQL and a fixture. Update seed to set
  `is_demo`.
- **Data deps:** Gate B authorization for DDL. **Permissions:** admin.
- **Acceptance:** artifacts hash-recorded; apply tested on a local scratch DB
  only; metric tests reference the definitions; `GET /admin/demo-data` switches
  from the email allowlist to `is_demo` once applied.
- **Exclusions:** no apply to Supabase without separate approval; no deletion.
- **STOP:** user authorizes (or declines) the migration.

### Phase 5 — Booking/discovery event contract

- **Value:** enables truthful funnel and demand insight later; drop-off points
  become fixable.
- **Reuse:** `marketplace_events` table + enum already declare
  `provider_search`, `provider_viewed`, `service_viewed`,
  `availability_slot_selected`, `booking_started/submitted/confirmed/cancelled/no_show`
  with `correlation_id`, `source`, `reason_code`, `metadata` — **declared,
  never emitted** [VERIFIED]; emitter `lib/marketplace-events.ts`;
  `prevented_booking_records` idempotency pattern;
  `docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md`.
- **Smallest change:** write `docs/analytics-event-contract-v1.md` (owner,
  server-side trigger on existing routes, IDs — never emails, permitted
  properties, dedupe key, `environment` label prod/preview/test, retention),
  privacy review, then emit server-side for the booking journey only, behind
  tests. **No funnel UI until events exist for a full window and reconcile
  against `bookings`.**
- **Data deps:** existing table. **Permissions:** server-side only.
- **Acceptance:** each event fires exactly once per step (integration test);
  payload schema test rejects PII keys; preview-vs-DB reconciliation script.
- **Exclusions:** no GA4/GTM/pixels; no client-side tracking; no full URLs
  with query strings.
- **STOP.**

### Phase 6 — Demand/supply insights & recommendations (conditional)

- **Value:** admin sees unmet demand by service/area/time; providers get
  evidence-based availability/service suggestions.
- **Reuse:** Phase 5 events, `provider_service_areas`,
  `provider_coverage_areas`, `availability`, `prevented_booking_records`,
  `components/admin-pilot/*`, `docs/pilot/pilot-metrics-dashboard.md`.
- **Smallest change:** one admin insight ("requests by service × area prefix vs
  providers covering it") and one provider recommendation type, each with
  minimum-sample thresholds and "estimate vs exact" labels.
- **Data deps:** Phases 4 + 5 complete. **GA4/GTM is optional and requires
  separate privacy review, consent design and deployment approval.**
- **Acceptance:** insight hidden below threshold; recommendation copy never
  promises outcomes; demo data excluded.
- **STOP.**

---

## 4. Immediate next-Neo task

Do **only** this, in order:

1. Follow the `AGENTS.md` read order (Eagle View → AGENT-RULES → SETUP →
   NEXT_TASK → LOG tail), then read this document, `docs/managed-db-release-gate.md`,
   `docs/github-continuation.md`, `docs/checkpoint-notes-guide.md`.
2. Run **Phase 0 reconciliation**: reproduce §1 (local SHAs, `git status`,
   `git remote -v`, live bundle hash + grep counts, `/api/healthz`). Confirm
   the 27 locally committed files still exist and pass `pnpm run typecheck`
   and `pnpm run build:deploy`. **Inspect before coding; do not rewrite or
   duplicate the workspace-only `/admin/system` and demo-data work.**
3. Present the user with (a) the reconciliation evidence, (b) the publication
   question (ship `/admin/system` + demo-data as-is via Save to Github → PR?),
   (c) the constraint-lift question for `docs/commit-strategy.md`, (d) the
   credential-in-repo finding, and (e) a one-page proposal for the **smallest
   Phase 1 slice** (landing page + read-only queue + one new read endpoint)
   with acceptance tests.
4. **Stop and wait.** Implement Phase 1 only after explicit approval.

This document is a plan and an evidence record. It is **not** approval to
execute Phases 1–6.

---

## 5. Hard stops (apply to every future session on this repo)

- Do **not** purge demo data (`POST /api/admin/demo-data/purge` or the UI
  button). The user will decide and press it themselves.
- Do **not** apply SQL/migrations, run the seed against Supabase, alter
  secrets or Railway variables, change the Railway deploy branch, install
  GA4/GTM/pixels, or merge/PR/push/deploy based on this handoff. Each requires
  separate, explicit authorization in that session (Gate B for DDL).
- Do **not** claim `invoices.amount_cents` sums or booking prices are paid
  revenue. No payment backend is evidenced (0 invoices; `stripe_payment_intent_id`
  unused; `pendingPayoutCents` hard-coded 0).
- Do **not** make the email allowlist (`DEMO_EMAILS`) the permanent demo
  identification design; it is interim pending Phase 4.
- Do **not** reset/clean the worktree, force-push, rebase `main`, or commit
  unrelated generated files (`backend/__pycache__`, `frontend/yarn.lock`,
  `/tmp` outputs, `dist/`, `node_modules/`). Preview shims `backend/server.py`,
  `frontend/package.json` exist for the Emergent environment only.
- Do **not** expose env var values, DB hosts beyond what `/admin/system`
  shows to admins, verification document contents, client contact or care
  notes in any client payload, log line, or analytics event. Do not copy
  credentials from `memory/` or `test_reports/` into any document.
- Any production, database, or release-changing operation requires separate
  review and the user's explicit "yes" in that session.

---

## Appendix A — Known security/operational follow-ups for the user

- Revoke the Railway project token used on 2026-09-26.
- Delete the stale `JWT` variable on Railway (left as-is to avoid touching
  more than approved).
- Change `admin@oncallfoot.com`'s seed password (the only admin account).
- Rotate the real-user password that appears in tracked `backend/tests/*.py`
  files (see §1.4); decide whether those preview-only test files are redacted
  or removed before the local commits are published.
- Decide whether `backend/` and `frontend/` preview shims stay in the repo.
- Append the missing 2026-09-26 session entry to `.agents/LOG.md`.

## Appendix B — Inventory claims from the 2026-09-26 session and their status

| Claim | Status |
|---|---|
| No `/admin` landing page; admin login lands on `/admin/verification` | [VERIFIED] `pages/login.tsx` line 29; `App.tsx` has only three admin routes |
| Application approve/reject has no UI | [VERIFIED] `pages/admin/` contains only `verification`, `pilot`, `system`; Eagle View §5 lists reviewer decisions as API-complete |
| Support escalation admin handling has no UI | [VERIFIED] same; Eagle View: "Support (admin side) NOT STARTED" |
| Booking/discovery funnel events declared but not emitted | [VERIFIED] enum has 16 types; emitter + all booking routes contain 0 booking/discovery emits; DB rows all activation types [VERIFIED-PRIOR] |
| No GA4/GTM/consent code anywhere | [VERIFIED] `index.html` grep 0; E1 grep of `artifacts/web` [VERIFIED-PRIOR] |
| `/me/earnings` sums invoices regardless of paid status; `completedBookings` = review count | [VERIFIED] `routes/providers.ts` 3451-3478 |
| `invoices` = 0 rows, `support_tickets` = 0 rows | [VERIFIED-PRIOR] catalog counts 2026-09-26 |
| `/admin/system` "live" | [CORRECTED] live only on the Emergent preview; **not on GitHub or Railway** (bundle grep) |
| Live 404 on `/api/admin/system-status` as deployment evidence | [CORRECTED] invalid — router gate returns 401 for any unauthenticated admin path |
| Preview regression: approval, verification, bookings pages, reschedule cards render | [VERIFIED-PRIOR, preview only] `test_reports/iteration_3.json`, `iteration_4.json`; not re-run on Railway |
| All 10 migration artifacts applied; schema parity 260/260 | [VERIFIED-PRIOR at apply time]; re-verify in Phase 0 via `/admin/system` in preview (read-only) |
| Remote branch `docs/admin-handoff-2026-09-26` identical to `origin/main` | [VERIFIED-PRIOR]; not inspectable from this workspace (no remote) |

## Appendix C — Phase 0 result (2026-09-26, E2 session)

| Item | Result |
|---|---|
| Live Railway `/api/healthz` | 200 at 2026-09-26T17:28Z [VERIFIED] |
| Live bundle | `index-C2Z5U7C7.js`; grep hits: `/admin/system` 0, `system-status` 0, `demo-data` 0, `/admin/verification` 1, `/admin/pilot` 1 [VERIFIED] — `/admin/system` still not deployed |
| Local build bundle | `index-CVNSPxq3.js` (contains the admin/system work) |
| Migration ledger | copied to `docs/migrations/APPLIED_LEDGER_2026-09-26.md`; 8/8 hashes match checkout [VERIFIED] |
| Credentials in tracked tests | redacted in commit `7e41646` (`backend/tests/_creds.py`); history unchanged → owner rotates the real password |
| `docs/commit-strategy.md` constraint | lifted by owner decision 2026-09-26 (admin work scoped to this plan) |
| `.agents/LOG.md` | 2026-09-26 entry back-filled; Current Build State rows added |
| Workspace | transferred to a new Emergent workspace; `origin` = GitHub; local `main` ahead of `origin/main` (squash divergence); no push |
| Owner decisions recorded | ship `/admin/system` + demo-data as-is via Save to Github → PR; proceed with Phase 1 smallest slice |

## Appendix D — Phase 1 result (2026-09-26, E2 session; owner-authorized)

| Item | Result |
|---|---|
| Delivered | `/admin` landing page (`artifacts/web/src/pages/admin/index.tsx`, `components/admin-home/queue-card.tsx`): cards for credentials awaiting review, applications under review (with Demo tags), system health, demo data; recent application activity; nav + Home links on the three existing admin pages; admin login now lands on `/admin` |
| New read-only APIs (contract first) | `GET /admin/provider-applications?status&limit&offset` and `GET /admin/provider-applications/events?limit` in `routes/admin.ts`; `openapi.yaml` + orval codegen; both behind the router-wide admin gate; 400 on bad input; no `reviewerNotes`/`rejectionReason`/email in list/event payloads. Deviation from the plan's "one endpoint": two, both read-only |
| Tests | `admin-overview.integration.test.ts` (node:test; run only against a scratch/test DB — NOT run against Supabase), `time-ago.test.ts`; full typecheck; api unit 132/132; web 246/246; `build:deploy` pass; preview pytest 41/41 read-only incl. `test_admin_provider_applications.py`; independent testing agent 100% (`test_reports/iteration_1.json`, workspace-only) |
| Observed on live data | 2 real applications under review since 2026-08-14 and 2026-08-27 (43 and 30 days) — the queue is working as intended; owner action needed |
| Exclusions held | no approve/reject UI, no new tables, no funnel/revenue figures, no DB writes by the agent |
| Commits (local, unpushed) | `7e41646` redaction · `7885cc9` Phase 0 docs · `957623d` Phase 1 · `cb765d3` regression test |
| STOP | Phase 2 (approve/reject drawer, support escalation list) requires a fresh owner go-ahead |

## Appendix E — Phase 2, slice 1 result (2026-09-26, E2 session; owner-authorized)

| Item | Result |
|---|---|
| Delivered | Approve/reject from `/admin`: tapping an applicant opens `components/admin-home/application-decision-dialog.tsx` (applicant facts, pending-doc count, explicit two-part activation gate, Approve with private notes / Reject with required provider-visible reason + private notes, plain-language 409/403/404/401 handling, in-flight lock). Queue, events and verification feeds refresh after a decision; success toast names the next step (credentials) when verification is still pending. "Show all" toggle for long queues |
| APIs | none new — reuses `POST /admin/provider-applications/:id/approve|reject` (transactional event + notification + activation events, self-review 403, non-`under_review` 409) |
| Tests | `application-decision-dialog.test.tsx` 5/5 (facts/gate/axe, approve payload, reject validation + payload, 409 message, in-flight lock); web suite 251/251; typecheck; `build:deploy`; browser check on live data at 390px/1920px with **no decision submitted** (Cancel/Esc only) |
| Exclusions held | no support-escalation UI yet (next slice), no bulk actions, no new audit table (Phase 4), no DB writes by the agent |
| Finished (E1, new workspace, same day) | Live end-to-end run on the QA account only (application #9): reject in browser (reason + private note) → event 6, provider sees reason but never notes → reset/resubmit (events 7, 8) → approve in browser → event 9; stale-state 409, 401/403 gates, list/events payloads free of `reviewerNotes`/emails; non-admin `/admin` shows access-denied. Independent testing agent 12/12 (`test_reports/iteration_2.json`). Fixed 390px horizontal overflow (`queue-card.tsx` `min-w-0`). Real applications #1/#5 left undecided for the owner |
| STOP | Support escalation list + resolve action requires a fresh go-ahead |

## Appendix F — Phase 2, slices 2 + 3 result (2026-09-27, E1 sessions; owner-authorized)

| Item | Result |
|---|---|
| Delivered (slice 2 — credentials) | Tapping a document on the `/admin` credentials card opens `components/admin-home/credential-decision-dialog.tsx`: document facts (type, file reference, provider upload note), Approve/Reject, an explicit labelled checkbox for the profile-level verification flip (defaults on; hidden when the profile is already approved; warns when other documents are still pending), reviewer notes stored on the document. Reuses `PATCH /admin/verification/docs/:docId`. New read-only feed `GET /admin/verification/events?limit` (documents carrying a decision, newest first; no notes/emails) drives the "Recent credential decisions" section |
| Delivered (slice 2 — support) | New "Support requests open" card fed by `GET /admin/support/escalations?status&limit` (default `unresolved` = open + in_progress, oldest first; latest message truncated to 280 chars, `fromAdmin` flag, message count). Tapping a request opens `components/admin-home/escalation-resolve-dialog.tsx`: In progress (optional working note) or Resolve (required outcome note, stored as an admin support message). Reuses `PATCH /support/escalations/:ticketId`. Booking corrections/suspensions deliberately not offered |
| Delivered (slice 3 — decision email) | `lib/decision-emails.ts`: applicant email on approve/reject via the managed email proxy; recipient/body from server records + fixed templates; structural guardrail gate on every send (no forms/inputs, no credential asks, https-only own-app links, no shorteners); never throws — approve/reject responses now carry `email: { sent, id | reason }` and the dialog toast states honestly whether the applicant was emailed (`not_configured` when `EMERGENT_EMAIL_KEY`/`EMAIL_FROM_NAME` are unset). `/admin/system` lists the three email env vars (presence only) |
| Contract | `openapi.yaml` + orval regeneration for the two feeds and the `email` outcome; typecheck clean |
| Tests | `credential-decision-dialog.test.tsx` 7/7, `escalation-resolve-dialog.test.tsx` 5/5 (facts/axe, payloads, flip semantics, required note, 404 copy, in-flight lock); web suite 263/263; api unit 137/137 incl. new `decision-emails.test.ts` (gate, escaping, no-notes, not-configured/invalid-recipient/provider-error outcomes); preview pytest `backend/tests/test_admin_phase2_feeds.py` 14/14 read-only (401/403 gates, shapes, ordering, 400s, env presence-only) |
| Live run (QA/demo data only) | Credential #5 (QA Provider) approved in browser with the flip unticked → event listed, profile stayed `under_review`; demo ticket #1 → in progress with note; demo ticket #2 → resolved with outcome note (admin message recorded, `fromAdmin=true`); card counts and lists refreshed without reload. No real account touched |
| Exclusions held | no bulk actions, no new audit table (Phase 4), no email on credential decisions (only application decisions), no DDL |
| STOP | Phase 3 (provider scorecard) and Phase 4 (demo flag / audit log artifacts) require a fresh owner go-ahead |

## Appendix G — Phase 3 result: provider scorecard + earnings correction (2026-09-27, E1 session; owner-authorized)

| Item | Result |
|---|---|
| Delivered | `GET /providers/me/scorecard` (contract-first, `requireProviderOperation`, own `provider_profiles.id` only) — exact counts over two windows: visits scheduled in the last 30 days and all time (completed, cancelled, no-show, awaiting outcome, resolved, distinct/repeat clients, reviews count + one-decimal average). Rates (`completion`/`cancellation`/`noShow`) are `null` until 5 resolved visits. At most one suggestion per gap, computed only from own bookings/reviews: `unresolved_past_visits`, `no_recent_visits`, `no_shows`, `cancellations` (≥20 %), `no_repeat_clients` (≥3 clients, 0 repeats), `no_reviews` (≥3 completed, 0 reviews). `isDemo` flag for seed accounts. Pure computation in `lib/provider-scorecard.ts` |
| UI | `components/dashboard/scorecard-card.tsx` on `/provider/dashboard` below performance metrics: two count columns, "Rates appear after 5 resolved visits (n of 5 so far)" note, Next steps list or "Nothing stands out", honest empty state before the first booking, "Demo account" badge. Verified at 390 px, no horizontal overflow |
| Earnings correction (plan Phase 3 items a–c) | `GET /providers/me/earnings` now returns `totalCents` = pending + paid invoices (cancelled excluded, labelled "Invoiced value" — not confirmed paid), `paidCents` (invoices marked paid), `pendingPayoutCents` = pending invoices (was hard-coded 0), `completedBookings` = real count of `bookings.status = 'completed'` (was `reviewCount`), `invoiceCount`. `/provider/earnings` relabelled: Invoiced value · Marked paid · Unpaid invoices · Completed visits, with the "payments are not processed by the platform" note |
| Tests | api unit `provider-scorecard.test.ts` 6/6 (exact counts, min-for-rates, window by scheduled time excl. future, one-per-gap, no revenue words, empty provider) → api 143/143; web `scorecard-card.test.tsx` 4/4 incl. axe → web 267/267 (dashboard tests mock the new card); preview pytest `backend/tests/test_provider_scorecard.py` 7/7 read-only (401, admin not a provider, count invariants, owner `isDemo=false`, earnings identity `total = paid + pending`, `completedBookings` matches scorecard) |
| Exclusions held | no cross-provider benchmark, no response-time metric, no forecast, no new tables, no DB writes by the agent |
| Also this session | Railway `foot` service: `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `PUBLIC_APP_URL=https://foot-production-9784.up.railway.app` upserted with the owner's project token (`scripts/railway-set-email-vars.py`, values read from `.env`, never printed); auto-redeploy `SUCCESS`, `/api/healthz` 200. Owner should revoke that token. Decision emails go live in production once `main` contains the Phase 2 code (Save to GitHub → PR → merge) |
| STOP | Phase 4 (`users.is_demo`, `admin_audit_log` artifacts, metric definitions doc) requires a fresh owner go-ahead |

## Appendix H — Phase 4 proposal: demo flag + admin audit log (2026-09-27, E1 session; owner-authorized to PROPOSE only)

| Item | Result |
|---|---|
| Proposed (NOT applied) | `docs/migrations/USERS_IS_DEMO_V1.sql` (sha256 `0c4c6097…818f28`), `USERS_IS_DEMO_BACKFILL_V1.sql` (DML, idempotent, fixed 6-address allowlist; `e4e840ce…f714a9`), `ADMIN_AUDIT_LOG_V1.sql` (`6d015f1d…8c43a9`). Full hashes, design notes and the 6-step post-approval sequence in `docs/migrations/PROPOSED_2026-09-27_DEMO_FLAG_AUDIT_LOG.md` |
| Validation | libpg_query grammar parse of every statement — syntax only. No scratch PostgreSQL in this workspace; disposable-DB rehearsal remains a precondition to any managed apply |
| Metric definitions | `docs/metrics-definitions.md` — every displayed figure (scorecard, performance metrics, earnings, admin cards) with rule, SQL and the fixture test that pins it; "not shown by decision" list |
| Deliberately deferred | Drizzle mirror declarations (would break `select()` on `users` before the column exists), seed `is_demo`, switching `DEMO_EMAILS` consumers to the flag, audit write path + `GET /admin/audit-log`, `system-status` probes — each after the managed apply, as separate reviewed steps |
| Boundaries held | no DDL, no DML, no DB connection opened, no push |
| STOP | Applying any artifact requires a fresh operator approval quoting the SHA-256 |
