# OnCall Foot — Complete Marketplace Vision, Branch Reconciliation, Roadmap, and Current-State Report

**Neo Entry Report — 2026-08-11**
**Prepared by:** Neo (E2 Agent)
**Method:** Live verification against GitHub (`sbtheg17-market/foot`), full branch enumeration, code-surface inspection of `origin/main`, ledger reconstruction (`.agents/LOG.md` Sessions 001–067), docs corpus (17 files), Comfort Wiring workspace state (`/app`), and testing-agent evidence.
**Mode:** Reconnaissance and synthesis only. Nothing merged, pushed, rewritten, deleted, or modified in the target repo during this task.

---

## 1. Executive Overview

OnCall Foot is a three-portal, mobile-first marketplace OS for in-home foot care ("The right care. At your door. Right now."). The canonical implementation lives on `origin/main` of `sbtheg17-market/foot` as a **pnpm/Node 24/Express 5/PostgreSQL(Drizzle)/React 19(Vite)/Expo monorepo** at **~85% MVP**: provider portal and client booking journey are live and heavily tested; the admin surface is limited to verification + application review; payments/monetization are deliberately deferred.

The repository's 25 `conflict_*` branches are **not** OnCall Foot work-in-progress: 24 are snapshots of a **separate project family — Comfort Wiring** (FastAPI/MongoDB/React-CRA consent-first comfort-profile app), and 1 (`conflict_070826_mc2`) is superseded OnCall Foot history whose only production commit is already patch-equivalent on main. **No unique unrecovered OnCall Foot application code exists on any conflict branch.**

Comfort Wiring itself is healthy and advanced in its own workspace: 11 recorded one-task→one-patch deliverables, 27/27 backend checks green, the full consent lifecycle (versioned grant/withdraw, scope picker, history, provider projection, provider auth, bypass confinement) proven end-to-end. It is the **reference implementation** for OnCall Foot's gated Phase 4C comfort/preferences checkpoint — to be **ported stack-natively**, never merged.

---

## 2. Repository Identity (verified live at task start)

| Field | Value |
|---|---|
| Repository | `github.com/sbtheg17-market/foot` |
| Canonical branch | `main` |
| **Current HEAD SHA** | `b20087d13eb77ad3da0b60efc88d4e768f68134d` |
| HEAD date | 2026-08-11 16:29:48 +0000 |
| HEAD author | Neo Connector <neo-connector@oncallfoot.local> |
| HEAD message | "conflict-branch inventory v6: all 25 archival branches classified…" (docs-only: Session 067 + `docs/conflict-branch-inventory-2026-08-11.md`) |
| Parent | `401a9d7` ("Add new index asset file") |
| Worktree sync | Local clone `/root/foot` == `origin/main` (fetched + reset at task start) |
| Stack | pnpm workspace · Node 24 · TypeScript 5.9 · Express 5 · PostgreSQL + Drizzle · React 19 + Vite · Expo · Replit/Railway/Nixpacks deploy config |

Note: the prior handoff's "current main must be verified" instruction was honored — the HEAD moved from `401a9d7` to `b20087d` via the gate-verified Session 067 fast-forward publication earlier today; no older SHA (`3e76114`, `c02a308`, `184833b`) is current.

## 3. Full Branch Inventory

27 remote refs: `main`, `HEAD→main`, and 25 `conflict_*`. **No** `feature/*`, `phase/*`, `patch/*`, or `recovery/*` branches exist. Every conflict branch was inspected (merge-base test, tip metadata, root tree, stack fingerprint). All 24 foreign branches carry tip subject "Auto-generated changes" (automated workspace snapshots) and `.emergent/` markers; classification signals include `backend/requirements.txt` (fastapi/pymongo), `recovery/COMFORT_WIRING_PLAN.md` (branch #23), `patches/` + `docs/comfort-profile/` (branches #24–25).

## 4. Branch Chronology (by actual tip commit date, newest first)

| # | Branch | Tip | Tip date (UTC) | Unique commits vs main | Merge base | Classification |
|---|--------|-----|----------------|------------------------|------------|----------------|
| 1 | conflict_110826_1134 | 0fa8ffc | 08-11 15:35 | full history (no base) | **none** | 3 — Comfort-Wiring (canonical CW snapshot: patches/, docs/comfort-profile/) |
| 2 | conflict_110826_1112 | c687c8f | 08-11 15:12 | full history | **none** | 3 — Comfort-Wiring |
| 3 | conflict_110826_0846 | 39965b0 | 08-11 12:47 | full history | **none** | 3 — Comfort-Wiring (recovery/COMFORT_WIRING_PLAN.md — definitive) |
| 4 | conflict_100826_2258 | 12c8863 | 08-11 02:58 | full history | **none** | 3 — Comfort-Wiring (audit/, handoff/) |
| 5 | conflict_100826_2113 | b9d2722 | 08-11 01:14 | full history | **none** | 3 — Comfort-Wiring |
| 6 | conflict_100826_1941 | 9a752ae | 08-10 23:41 | full history | **none** | 3 — Comfort-Wiring (repo_audit/) |
| 7 | conflict_100826_1738 | 1eefbfd | 08-10 21:39 | full history | **none** | 3 — Comfort-Wiring |
| 8 | conflict_100826_1543 | 9e9a3ee | 08-10 19:44 | full history | **none** | 3 — Comfort-Wiring (Session 063 recovery source; nested foot/ dir) |
| 9 | conflict_100826_1415 | 27a5ada | 08-10 18:15 | full history | **none** | 3 — Comfort-Wiring |
| 10 | conflict_100826_1234 | f9d0b7e | 08-10 16:34 | full history | **none** | 3 — Comfort-Wiring |
| 11 | conflict_100826_0906 | 018e69b | 08-10 13:07 | full history | **none** | 3 — Comfort-Wiring |
| 12 | conflict_100826_0813 | 8cc0028 | 08-10 12:14 | full history | **none** | 3 — Comfort-Wiring |
| 13 | conflict_090826_2326 | 73bdad6 | 08-10 03:26 | full history | **none** | 3 — Comfort-Wiring |
| 14 | conflict_090826_2136 | 7f7cfaa | 08-10 01:36 | full history | **none** | 3 — Comfort-Wiring |
| 15 | conflict_090826_1916 | 81014b0 | 08-09 23:16 | full history | **none** | 3 — Comfort-Wiring (HANDOFF-README, SHA256SUMS) |
| 16 | conflict_090826_1718 | c3589b1 | 08-09 21:18 | full history | **none** | 3 — Comfort-Wiring |
| 17 | conflict_090826_1405 | 60979db | 08-09 18:05 | full history | **none** | 3 — Comfort-Wiring (marketplace-events/notification patches — CW copies) |
| 18 | conflict_090826_0856 | 7110dc9 | 08-09 12:56 | full history | **none** | 3 — Comfort-Wiring |
| 19 | **conflict_070826_mc2** | **bed2e06** | **08-08 13:28** | **5 (4 artifacts + 1 already-equivalent)** | **54534b0b** | **2 — OnCall Foot, historical reference only (superseded)** |
| 20 | conflict_080826_1307 | 305fd86 | 08-08 17:08 | full history | **none** | 3 — Comfort-Wiring |
| 21 | conflict_060826_2025 | 058cf6e | 08-07 00:26 | full history | **none** | 3 — Comfort-Wiring |
| 22 | conflict_010826_0036 | 0c7bd7b | 08-01 04:36 | full history | **none** | 3 — Comfort-Wiring lineage (early Emergent FARM) |
| 23 | conflict_010826_0008 | a5638c5 | 08-01 04:09 | full history | **none** | 3 — Comfort-Wiring lineage |
| 24 | conflict_310726_2216 | 5e85263 | 08-01 02:17 | full history | **none** | 3 — Comfort-Wiring lineage |
| 25 | conflict_310726_1942 | ffe8515 | 07-31 23:43 | full history | **none** | 3 — Comfort-Wiring lineage |

Recommended action for all class-3 branches: export to a dedicated Comfort-Wiring repository, then delete refs under a fresh, explicitly approved cleanup (prior 9-branch authorization is stale — see `docs/conflict-branch-inventory-2026-08-11.md`). For #19: optional docs-only salvage of `docs/phase1-mc2-handoff.md`; everything else superseded.

## 5. Conflict Classification Summary

- **OnCall Foot — safe candidate for review:** none (nothing on any branch is ahead of main in a usable way)
- **OnCall Foot — historical reference only:** `conflict_070826_mc2` (feature commit `5f9992e` is `git cherry`-equivalent on main; main's `providers.ts` has evolved ~790 lines beyond it)
- **Comfort-Wiring — separate project:** the other 24 branches
- **Unrelated / Unknown:** none

## 6. Handoff & Log Chronology (Sessions 001–067, condensed by era)

| Era | Sessions | Dates | What happened |
|---|---|---|---|
| **Genesis (pre-repo)** | — | Feb 2026 | PRD authored during the original **FastAPI/MongoDB phase** of OnCall Foot (provider auth, services CRUD, onboarding built on FARM stack). That implementation was later **fully rebuilt** on the current TS/Postgres stack; PRD retained with a stack note. |
| **Replit bring-up** | 001–005 | 07-28 | GitHub import; pnpm install; Drizzle schema → PostgreSQL (10 tables); portability hardening (removed @replit lock-ins); agent handbook + rules established. |
| **Core build-out** | 006–018 | 08-04 → 08-06 | Auth/JWT/RBAC, providers, services, availability, travel zones, bookings + strict state machine (63 unit tests), reviews, invoices, notifications (SSE + Expo push), seed, single-service deploy. Session 018 (4 checkpoints): availability preset, booking filters, tap-to-reach, earnings export. |
| **Client activation** | 019–041 | 08-06 → 08-07 | Provider profile depth/trust checklist; client portal activation checkpoint 1 (role-gated booking); client booking list/detail slice; role-aware migration (`account_roles`, `provider_applications`) Phases 1–3 (DB-backed authorization). |
| **Onboarding lifecycle (MC-series)** | 042–052 | 08-08 → 08-09 | Provider application submit/approve/reject/reset/resubmit; status API (MC checkpoint 2); submission history API + web + mobile timelines (MC5–MC7); reviewer decisions + transactional notifications (MC9, 14/14); provider notifications APIs (MC8-lite, 12/12); web in-app notification feed + unread badge (MC10). |
| **Activation track + governance** | 053–062 | 08-09 → 08-10 | Provider Activation & First Booking: Phase 1 `marketplace_events` schema, Phase 2 readiness API (`4bb0e00`), Phase 3 event emission (`cf689b5`, six-file scope). Publication review gate `scripts/verify-publication.sh` (`5853768`) + `--approve-web-ui` flag (`47df77e`). Phase 4B readiness web UI published (`b3937a7`). MCP deploy-key publication channel established, key revoked after window. |
| **Takeover + mismatch record** | 063–066 | 08-10 → 08-11 | New lineage verified from `3e76114`; lost candidates recovered from snapshot; Comfort-Wiring Neo-report mismatch documented (`docs/neo-handoff-scope.md`); Phase 4C contract/shell confirmed ABSENT from this repo; B-prime logout audit; baseline drift reconciled to `184833b`, then `401a9d7`. |
| **Current** | 067 | 08-11 | Conflict-branch inventory v6 (25 branches) published via authenticated deploy-key channel; gate 12/12 PASS; fast-forward to `b20087d`. |

Parallel Comfort Wiring ledger (its own `.agents/LOG.md`, ENTRY-001–019, 2026-08-11): Phase 4C contract+shell restoration → comfort-profile API (12/12) → provider projection card → patient auth + hardened logout → patch index page → operator approvals (ENTRY-012, incl. the AUTH dev/staging caveat) → repo-separation decision (ENTRY-013) → **Neo cycle 2** (ENTRY-014–019): provider auth, bypass confinement (production hard-stop), consent scope picker, consent history + contract V3.1 addendum, patch approval filters — 27/27 checks.

## 7. Approved-Build Synopsis

**OnCall Foot (all on main; belong there; no port needed):**

| Build | Commit(s) | Evidence | Status |
|---|---|---|---|
| Booking state machine + concurrency + pressure | (core era) | 63+16+13 tests | on main, green |
| Role-aware authorization Phases 1–3 | published chain | test:role-state, test:authorization | on main |
| Provider application lifecycle MC1–MC7 | `0afb3ff`+`92d001f`, `917361d`, etc. | 8/8, 11/11, 9/9, 11/11 suites | on main |
| MC9 reviewer decisions + notifications | split-published, tree-verified | 14/14 | on main |
| MC10 web notification feed + badge | published | 12/12 + manual screenshots | on main |
| Activation Phase 1–3 (`marketplace_events`, readiness API, event emission) | `d7a5999`→`4bb0e00`→`cf689b5` | readiness 14/14, events 12/12 | on main; **Phases 4–7 gated on Gate B** |
| Publication gate + web-UI approval flag | `5853768`, `47df77e` | functional re-verification | on main |
| Phase 4B readiness web UI | `b3937a7` | 9 files, patch sha recorded | on main |
| Session 067 inventory v6 | `b20087d` | gate 12/12 | on main (HEAD) |

**Comfort Wiring (separate project — NONE of these may be applied to OnCall Foot main; stack-native port only):**

| Patch | Approval | Status |
|---|---|---|
| PHASE_4C_restoration / comfort-profile-api / provider-projection-card / C3_patch-index-page | Approved (ENTRY-012) | done, tested |
| AUTH_patient-signin-logout | Approved **dev/staging, CAVEAT** (bypass) | done; caveat closed in code by AUTH_bypass-removal |
| PROCESS_patch-approvals | Recorded | done |
| AUTH_provider-signin, AUTH_bypass-removal, C4_consent-scope-picker, C5_consent-history, C6_patch-approval-filters | **Pending operator review** (ENTRY-015–019) | done, 27/27 backend + browser-verified |

## 8. Provider Portal — Current Status (evidence: routes/, pages/, tests, ledger)

| Area | Status | Evidence / notes |
|---|---|---|
| Sign-up / sign-in / logout / sessions | **COMPLETE** | JWT HS256 + bcrypt; shared role-intent signup; server-confirmed redirects; hardened logout (shared mutation + token removal); failed-logout cleanup edge case documented, unimplemented (B-prime caveat) |
| Onboarding & application lifecycle | **COMPLETE** | 3-step onboarding pages (web+mobile); application draft→submit→review→approve/reject→reset→resubmit; status API with `nextAction` + capability flags; submission-history timelines web+mobile |
| Verification state & trust | **COMPLETE (core)** | `verificationStatus` gates public discoverability; admin verification queue; readiness checklist C1–C7 (`/provider/readiness`, dashboard card, nav badge) |
| Profile (bio, photo, service notes, availability-for-new-clients) | **COMPLETE** | trust checklist + completion progress; public profile parity web+mobile |
| Services CRUD | **COMPLETE** | list/create/edit/toggle/soft-delete, prices in cents |
| Availability + preset | **COMPLETE** | weekly grid + one-tap 9–5 weekday preset (test:availability 3/3) |
| Travel zones | **COMPLETE (list/add/remove)** | `/provider/travel-zones`; no update endpoint (by contract) |
| Bookings inbox | **COMPLETE** | status-chip filters + counts; strict transitions; tap-to-call (`tel:`) + tap-to-map links; booking detail |
| Private post-visit notes | **COMPLETE (privacy-verified)** | `careNotes` never rendered to clients (regression-tested) |
| Earnings + statement | **COMPLETE (no payments)** | completed-bookings-derived; printable HTML statement (print-to-PDF); no Stripe by design |
| Invoices | **COMPLETE (records)** | auto-created on `confirmed`; status pending→paid reserved for future Stripe |
| Notifications | **COMPLETE (in-app web)** | MC8-lite APIs; `/provider/notifications` feed + unread badge; SSE + Expo push infra; email outbox **gated/not built** |
| Mobile parity | **PARTIAL** | Expo: discover/bookings/account/provider/auth/onboarding/application-status; mobile notification feed **gated, not started** |

## 9. Client Portal — Current Status

| Area | Status | Notes |
|---|---|---|
| Sign-up / sign-in / logout / role enforcement | **COMPLETE** | shared signup with roleIntent; client-only booking access enforced |
| Discovery (browse/search providers) | **COMPLETE (core)** | public browse + provider profiles without account; verified-only surfacing; no geo-distance sort yet |
| Provider profile view + service catalog | **COMPLETE** | avatars, credentials, availability-for-new-clients, service notes |
| Booking flow (choose provider/service/time → request) | **COMPLETE** | unauthenticated → sign-in routing; provider/admin directed away |
| Booking status / history / detail | **COMPLETE (first slice)** | upcoming/past/cancelled separation; role-safe detail; server-owned status labels |
| Cancel / reschedule | **PARTIAL** | cancel exists; duplicate-submit protection + confirmation flow queued (NEXT-STEPS); reschedule state exists in machine, client UI not confirmed |
| Reviews | **PARTIAL** | backend POST/GET with completed-booking + one-per-booking validation (review.integration green); client review UI slice queued ("allow one review after eligible completed booking") |
| Care history | **COMPLETE (bounded)** | client-safe bounded history (test:care-history) |
| Comfort & consent preferences | **NOT STARTED on OnCall Foot** — SEPARATE PROJECT | full reference implementation lives in Comfort Wiring (see §12); OnCall Foot Phase 4C contract approved but artifacts absent from this repo; port required |
| Notifications (client-facing) | SCAFFOLDED | infra exists (SSE/push); client feed not built |
| Support / report-block / account deletion | NOT STARTED (support schema exists) | `support.ts` schema + ticket routes per role matrix; no client UI |

## 10. Admin / Operations Portal — Current Status

Actual code found (do-not-overclaim rule applied):
- **Admin auth/role:** COMPLETE — `requireRole('admin')` DB-backed via `account_roles`; demo admin seeded.
- **Provider verification queue:** COMPLETE — `GET /api/admin/...` queue + `PATCH` verification status; web page `pages/admin/verification.tsx`.
- **Reviewer decisions (application approve/reject):** COMPLETE — 2 admin POST endpoints, transactional decision notifications, 14/14 tests, admin-only + self-review prevention.
- **Everything else** (client management, booking oversight dashboards, disputes, support responses, taxonomy, commissions, subscriptions, payouts, analytics dashboards, audit-log UI): **NOT STARTED** — roadmap only. `marketplace_events` (append-only, Phase 1–3) is the audit/event substrate; funnel-report API is gated Phase 4G.

## 11. Shared Auth / RBAC Status

- Roles implemented: `client`, `provider`, `admin` (DB-backed membership in `account_roles`; `users.role` = compatibility context). Future roles (`support_agent`, `compliance_reviewer`, `finance_admin`, `marketplace_manager`) named in PRD only — NOT scaffolded in the TS code.
- Guards: `requireAuth` (validates user still exists/active vs DB), `requireRole`, `requireSelf`; approved-provider gate requires application AND verification both approved; signup `roleIntent` is never an authorization claim.
- Sessions: JWT (claims unchanged by role migration), bearer; login lockout documented in PRD era; logout present.
- **Bypass audit (main):** grep for X-Patient-Id / X-Provider-Id / test bypass / mock|demo user / auth override / skip|dev auth / impersonation → **zero auth bypasses in application code**. Only hit: a seed-script comment about demo users (seed inserts demo accounts `*@oncallfoot.com` / `demo1234` — dev/demo data, not an auth path).
- **Bypass audit (Comfort Wiring):** `X-Patient-Id`/`X-Provider-Id` exist by design as a DOCUMENTED test bypass — now confined: `ALLOW_TEST_IDENTITY_HEADERS` (default false) AND hard-refused when `APP_ENV/ENVIRONMENT=production` (AUTH_bypass-removal.patch). Meets the "non-production build condition" requirement; keep flag unset in prod.

## 12. Comfort / Consent Status

**SEPARATE PROJECT — complete for its slice, in `/app` (Comfort Wiring):** six contract operations (grant 201/400, withdraw/delete separate with 404, GET profile, PUT 409-on-inactive, projection 404-only/no-403) + V3.1 seventh owner-scoped operation `getConsentHistory`; versioned+hashed append-only consent rows; per-category scope picker (notes free-text OFF by default); provider projection filtered to granted scope only; patient+provider real auth; 27/27 node:test + browser-verified; one known MEDIUM frontend bug (patient registration redirect on /signin — provider path works; fix queued).

**On OnCall Foot main: NOT STARTED / DESIGN ONLY** — Phase 4C contract v3 (sha `1fa0eec…`) has standing approval as *contract only*; the contract/shell artifacts are absent from this repo (Session 065 finding). **Correct path = stack-native port** (new Drizzle models mirroring the two-store rule, Express routes preserving 201/400/404/409/404-only semantics, React/Vite shell + timeline, node:test suites) using Comfort Wiring as the executable reference. Booking-only projection maps naturally onto OnCall Foot's real bookings (`ACTIVE booking` allow-list becomes literal).

## 13. Booking & Marketplace Status

State machine centralized + hardened (6 statuses, strict transition matrix, admin override; 63 unit + 16 concurrency + 13 pressure tests). Auto-invoice on confirm. Marketplace events substrate published (Phases 1–3); **Phases 4–7 (booking enforcement → flagged discovery gating → funnel-report API → validation) BLOCKED on Gate B** (managed `DATABASE_URL` verification). Discovery is browsable pre-auth; readiness gates provider surfacing.

## 14. Earnings / Invoice / Payment Status

Earnings: COMPLETE (derived, completed-only; printable statement). Invoices: COMPLETE as records (pending→paid reserved). Payments/payouts/commissions/subscriptions/featured slots: **DESIGN ONLY** (`docs/future-monetization.md`) — explicitly out of scope until requested. Prices in cents everywhere (locked convention).

## 15. Test & Deployment Status

- **OnCall Foot:** 17 test suites in `artifacts/api-server/src/__tests__/`; last full validation evidence (Session 065): Corepack-pinned frozen install, typecheck, build, 63/63 booking units, four managed workflows, API/web HTTP 200, 390px preview — all green. Historic full-matrix runs: 63/63, 8/8, 9/9, 23/23, 7/7, 14/14, 12/12, 14/14, 11/11, 12/12.
- **Deploy:** single Node service (Express serves `/api/*` + built SPA); Railway/Nixpacks/Procfile present; Replit-only files documented as ignorable. **Gate B (managed database) remains UNVERIFIED — the standing deployment blocker for activation phases.**
- **Comfort Wiring:** 27/27 backend (4 suites) + testing-agent E2E (iteration_3): backend clean, frontend one MEDIUM bug (patient registration redirect), everything else passing.

## 16. Roadmap Completion Matrix

| Product area | Provider | Client | Admin | Backend | Frontend | DB | Tests | Roadmap | Next action |
|---|---|---|---|---|---|---|---|---|---|
| Authentication | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | logout-failure cleanup edge (doc'd) |
| RBAC | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | future roles remain PRD-only |
| Provider profile | COMPLETE | n/a | read | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | — |
| Client profile | n/a | PARTIAL | NOT STARTED | PARTIAL | PARTIAL | COMPLETE | PARTIAL | queued | client settings surface |
| Services | COMPLETE | read | read | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | service templates (future) |
| Categories/taxonomy | PARTIAL | PARTIAL | NOT STARTED | PARTIAL | PARTIAL | PARTIAL | UNKNOWN | future | admin taxonomy mgmt |
| Availability | COMPLETE | visibility | n/a | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | booking-slot compatibility (future) |
| Travel zones | COMPLETE | n/a | n/a | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | no update endpoint (by contract) |
| Bookings | COMPLETE | COMPLETE (slice) | oversight NOT STARTED | COMPLETE | COMPLETE | COMPLETE | COMPLETE | active | client cancel-confirm + dup-protect |
| Booking state machine | COMPLETE | COMPLETE | override | COMPLETE | n/a | COMPLETE | COMPLETE (92) | locked | do not regress |
| Notifications | COMPLETE (web) | SCAFFOLDED | NOT STARTED | COMPLETE | PARTIAL | COMPLETE | COMPLETE | gated | mobile feed → email outbox → push |
| Invoices | COMPLETE | view | NOT STARTED | COMPLETE | COMPLETE | COMPLETE | PARTIAL | done | paid-status w/ Stripe (future) |
| Earnings | COMPLETE | n/a | NOT STARTED | COMPLETE | COMPLETE | COMPLETE | PARTIAL | done | — |
| Payments | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | reserved | NOT STARTED | future | explicitly deferred |
| Comfort profile | SEPARATE PROJECT | SEPARATE PROJECT | n/a | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | stack-native port |
| Consent | SEPARATE PROJECT | SEPARATE PROJECT | boundary rules | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | port w/ contract semantics intact |
| Provider projection | SEPARATE PROJECT | n/a | n/a | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | tie to ACTIVE booking on port |
| Reviews | read (list) | PARTIAL | moderation NOT STARTED | COMPLETE | PARTIAL | COMPLETE | COMPLETE | queued | client review UI slice |
| Admin moderation | n/a | n/a | PARTIAL | PARTIAL (verification+decisions) | PARTIAL (1 page) | COMPLETE | COMPLETE (14/14) | future | ops dashboard |
| Support | NOT STARTED | NOT STARTED | NOT STARTED | SCAFFOLDED (schema) | NOT STARTED | COMPLETE | NOT STARTED | future | — |
| Analytics | n/a | n/a | NOT STARTED | PARTIAL (events 1–3) | NOT STARTED | COMPLETE | COMPLETE (12/12) | **BLOCKED (Gate B)** | Phases 4–7 + 4G |
| Monetization | DESIGN ONLY | DESIGN ONLY | DESIGN ONLY | NOT STARTED | NOT STARTED | reserved names | NOT STARTED | future | — |
| Patch index | n/a | n/a | n/a | SEPARATE PROJECT (CW /patches) | SEPARATE PROJECT | n/a | verified | CW-only | optional OCF port |
| Deployment | COMPLETE (single-service) | — | — | COMPLETE | COMPLETE | **BLOCKED (Gate B managed DB)** | PARTIAL | active | verify managed DATABASE_URL |

## 17. Contradictions & Missing Evidence

1. **PRD internal duplication:** checkpoints 5/6 appear twice with conflicting statuses (✅ Built AND Planned) — the ✅ rows are current truth; the "Planned" rows are stale leftovers.
2. **PRD stack anachronism:** authored in the FastAPI/Mongo phase; explicitly annotated as historical — but §3 "Current Truth" is the OLD FastAPI truth, superseded by `replit.md`/LOG (which are current).
3. **LOG session numbering:** duplicates (011, 018×4, 021–023×2, 036×2) and non-monotonic ordering; Session 056 header carries "LOCAL DRAFT, AWAITING REVIEW" wording published as final (recorded discrepancy). The publication gate now grandfathers these and enforces uniqueness going forward.
4. **Stale baselines:** NEXT_TASK still centers Session 063/066 state (`3e76114`/`c02a308`/`184833b` references marked HISTORICAL); the 18-branch inventory and 9-branch cleanup authorization are superseded by inventory v6 (25 branches) — cleanup must be re-authorized.
5. **Phase 4C artifacts absent from OnCall Foot main** despite standing contract approval (sha recorded) — the artifacts exist in the Comfort Wiring workspace instead; do not reconstruct from prose (Session 065/066 rule); port from the live CW reference under fresh scope approval.
6. **Gate B (managed DB) UNVERIFIED** — blocks activation Phases 4–7, production event writes, and any migration execution.
7. **`test_result.md`/`test_reports` at OCF root:** absent from main (they belong to the CW workspaces) — no contradiction, but naming overlap invites confusion.
8. **Founding-provider status / no-show UI / reschedule client UI:** state machine supports `no_show`/`rescheduled`; dedicated provider/client UI affordances for these transitions are not evidenced in page inventory — mark UNKNOWN pending UI-level inspection.

## 18. Safe Integration Recommendations

1. **Nothing from any conflict branch may be merged.** Zero merge bases (24 branches) or superseded (1 branch). This is now triple-recorded (Session 058 inventory, Session 067 inventory v6, this report).
2. **Optional docs salvage** from `conflict_070826_mc2`: fresh docs-only commit checking out `docs/phase1-mc2-handoff.md` onto a branch → gate → fast-forward. Never cherry-pick f6df78e/bce9735 (LOG.md conflicts).
3. **Comfort Wiring → OnCall Foot = stack-native port only** (Drizzle two-store additive models, Express routes with exact status-code semantics incl. 404-only projection, React/Vite shell + scope picker + history timeline, node:test suites, one-task→one-patch, gate + Gate B before any migration).
4. **Branch hygiene sequence (requires fresh named approval):** (a) tag `archive/conflict_070826_mc2` @ `bed2e06`; (b) export the 24 CW branches to `sbtheg17-market/comfort-wiring` (newest three carry the richest state: 1134/1112/0846); (c) delete refs only after export verification; (d) confirm main untouched. The authenticated deploy-key channel (verified read/write today) removes the Session 059–060 "no authenticated channel" blocker.
5. All future publications: dedicated branch → `pnpm publish:gate` → reviewed fast-forward; never force-push; never rewrite.

## 19. Next Three Implementation Tasks (recommended order)

1. **Gate B clearance — verify the managed PostgreSQL** (`DATABASE_URL` catalog check + schema-as-migration dry run). Single blocker releasing: activation Phases 4–7, production event writes, and future 4C migrations. Smallest task, largest unblock.
2. **Client booking lifecycle completion slice** (already user-approved direction in NEXT-STEPS): cancellation confirmation + duplicate-submit protection + provider status updates surfaced through existing notification paths; then the one-review-per-completed-booking client UI. Pure reuse of existing APIs; no schema changes.
3. **Phase 4C stack-native port — comfort/preferences intake for OnCall Foot**, using the now-proven Comfort Wiring implementation as the executable contract reference (V3 + V3.1 addendum semantics: six ops + owner-scoped history, versioned+hashed consent, scope picker with notes-off default, booking-only 404-only projection tied to real ACTIVE bookings). Requires its own scope approval + Gate B first per standing policy.

(Parallel non-code task: re-authorize and execute conflict-branch export/cleanup against inventory v6.)

## 20. Final Source-of-Truth Statement

1. Actual current main SHA: **`b20087d13eb77ad3da0b60efc88d4e768f68134d`**
2. Actual current main date: **2026-08-11 16:29:48 +0000**
3. Worktree/branch synchronized: **YES** (`/root/foot` fetched, hard-reset to `origin/main` at task start)
4. All conflict branches inspected: **YES — all 25** (merge-base, tip metadata, tree, stack fingerprint)
5. OnCall Foot conflict branches: **1** — `conflict_070826_mc2` (historical, superseded)
6. Comfort-Wiring conflict branches: **24** (all others)
7. Branches with no merge base: **24** (every branch except `conflict_070826_mc2`)
8. Approved patches safe to apply to OnCall Foot main: **none pending** — every approved OnCall Foot build is already on main; the five pending Comfort Wiring patches belong ONLY to Comfort Wiring
9. Functionality to port (never merge): **the Comfort Wiring consent/comfort stack** (Phase 4C for OnCall Foot)
10. Next three tasks: **Gate B clearance → client booking-lifecycle completion → Phase 4C stack-native port** (branch export/cleanup in parallel as a non-code operation)

`origin/main` of `https://github.com/sbtheg17-market/foot` remains the ONLY canonical source of truth for OnCall Foot. The Comfort Wiring workspace ledger (`/app/.agents/LOG.md`, ENTRY-001–019) is the canonical record for Comfort Wiring. No merges, pushes, rewrites, deletions, or file modifications were performed in the target repository during this reconnaissance.
