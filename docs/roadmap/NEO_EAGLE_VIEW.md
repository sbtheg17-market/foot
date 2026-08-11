# NEO EAGLE VIEW — OnCall Foot Permanent Source of Truth

**Location:** `docs/roadmap/NEO_EAGLE_VIEW.md` (canonical copy = the one on `origin/main`)
**First published:** 2026-08-11 (Session 068)
**Purpose:** Make the complete OnCall Foot marketplace vision permanently visible to every
future Neo, Replit, Fable, and coding agent, regardless of which branch or workspace is
opened. Read this file from `origin/main` BEFORE inspecting or changing any branch.

Status vocabulary used everywhere in this document (exactly one per capability):
`COMPLETE` · `PARTIAL` · `SCAFFOLDED` · `DESIGN ONLY` · `BLOCKED` · `NOT STARTED` ·
`SEPARATE PROJECT` · `UNKNOWN`

> No capability may be marked COMPLETE because a summary says so. COMPLETE requires code,
> route, test, or deployment evidence in this repository. Statuses below were verified
> against the code surface of `origin/main` `b20087d13eb77ad3da0b60efc88d4e768f68134d`
> (2026-08-11). When you change reality, update this file in the same reviewed commit.

---

## 1. Product vision

OnCall Foot — *“The right care. At your door. Right now.”* — is a **three-portal
marketplace**, not a booking site and not a solo scheduling tool:

1. **Provider Portal** — a mobile business OS: services, availability, travel, bookings,
   clients, trust status, earnings.
2. **Client Portal** — trusted discovery and easy in-home booking with lifecycle visibility.
3. **Admin / Operations Portal** — trust, verification, moderation, oversight, and future
   monetization.

One shared lifecycle underneath all three:
`provider joins → verified → publishes services + availability + coverage → client
discovers → requests booking → provider confirms/completes → invoice → review → admin
observes, moderates, monetizes`.

**Comfort-Wiring is a separate reference project** (FastAPI/MongoDB consent-first comfort
profile). It must NEVER be merged directly into OnCall Foot — see §5 and the branch
inventory. Its behavior arrives only via a stack-native port.

Canonical stack: pnpm workspace · Node 24 · Express 5 · TypeScript 5.9 · PostgreSQL +
Drizzle · OpenAPI 3.1 + Orval codegen · React 19 + Vite · Expo. Monetary values are
always integer cents. Booking transitions are strict (`docs/booking-statuses.md`).

---

## 2. Provider Portal — capability status (evidence-based)

| Capability | Status | Evidence (routes / pages / tests / ledger) |
|---|---|---|
| Provider signup | COMPLETE | `POST /api/auth/register` with additive `roleIntent` (transactional provider membership + profile + application); `pages/register.tsx`; `/register`→`/signup` redirect |
| Provider signin | COMPLETE | `POST /api/auth/login`; server-confirmed role-aware redirects; `pages/login.tsx` |
| Provider logout | COMPLETE | `POST /api/auth/logout` + shared logout mutation, token removal, login redirect (failed-logout cleanup edge documented, unimplemented — B-prime caveat) |
| Provider sessions | COMPLETE | JWT HS256 bearer; `requireAuth` re-validates the user against PostgreSQL each request |
| Provider RBAC | COMPLETE | DB-backed `account_roles`; `requireRole`; approved-provider gate = application AND verification both approved |
| Onboarding | COMPLETE | `pages/onboarding/provider.tsx` (+ Expo `app/onboarding/provider.tsx`); client “Become a provider” entry point |
| Application lifecycle | COMPLETE | draft→submit→review→approve/reject→reset→resubmit; `POST /providers/application/reset`; suites: provider-application 8/8, resubmission 11/11, onboarding 23/23 |
| Application status API | COMPLETE | `GET /providers/application/status` (server-derived `nextAction`, `canEdit/canReset/canResubmit`); 9/9 |
| Application history | COMPLETE | `GET /providers/application/submissions` keyset-paginated; web + mobile `SubmissionHistoryTimeline`; 11/11 |
| Provider profile | COMPLETE | `pages/portal/profile.tsx`, `portal/credentials.tsx`; public profile parity web+mobile |
| Verification status | COMPLETE | `verificationStatus` gates public discoverability (unapproved providers’ services never publicly listed — regression-tested) |
| Submit-for-review workflow | COMPLETE | application submit + admin reviewer decisions (14/14) |
| Profile completion | COMPLETE | trust checklist + completion progress; readiness checklist C1–C7 |
| Services CRUD | COMPLETE | `pages/portal/services.tsx`; list/create/edit/soft-delete |
| Service price | COMPLETE | `price_cents` integer (schema `services.ts`) |
| Service duration | COMPLETE | `duration_minutes` (schema) |
| Service description | COMPLETE | `description` (schema) |
| Service category | PARTIAL | `category` text column exists (default `foot_care`); no admin-managed taxonomy |
| Active/inactive services | COMPLETE | `is_active` toggle |
| Availability grid | COMPLETE | weekly grid, `pages/portal/availability.tsx` |
| 9–5 weekday preset | COMPLETE | `applyWeekdayPreset`; test:availability 3/3 |
| Travel zones | COMPLETE | `pages/portal/travel-zones.tsx`; list/add/remove (no update endpoint, by contract) |
| Bookings inbox | COMPLETE | `pages/portal/bookings.tsx`; status-chip filters + counts |
| Booking filters | COMPLETE | Session 018 checkpoint (commit `9730a7f` era); tested |
| Booking state machine | COMPLETE | `lib/booking-state-machine.ts`; 63 unit + 16 concurrency + 13 pressure tests; strict matrix; admin override only |
| — statuses | COMPLETE | `requested`, `confirmed`, `completed`, `cancelled`, `rescheduled`, `no_show` (“pending/accepted” map to requested/confirmed) |
| — no-show | PARTIAL | transition exists + tested; dedicated UI affordance UNKNOWN (not evidenced in page inventory) |
| Today timeline | COMPLETE | today section in provider bookings |
| Tap-to-call | COMPLETE | `tel:` links on booking detail |
| Tap-to-map | COMPLETE | map links on booking detail |
| Private care notes | COMPLETE | `careNotes` never rendered to clients (privacy regression-tested) |
| Earnings | COMPLETE | `pages/portal/earnings.tsx`; derived from completed bookings only (today/week/month) |
| Printable statements | COMPLETE | `pages/portal/earnings-statement.tsx` (print-to-PDF) |
| Invoices | COMPLETE (records) | auto-created on confirm; `GET /invoices`, `GET /invoices/:id`; `pending→paid` reserved for future payments |
| Notification feed | COMPLETE (web) | `pages/portal/notifications.tsx` on MC8-lite APIs; 12/12 |
| Unread badge | COMPLETE (web) | ProviderLayout “Alerts” badge, 99+ cap, hidden at 0 |
| Readiness checklist | COMPLETE | `GET /providers/me/readiness` C1–C7; `pages/portal/readiness.tsx` + dashboard card + nav badge; 14/14 |
| Mobile parity (Expo) | PARTIAL | discover/bookings/account/provider/auth/onboarding/application-status present; mobile notification feed GATED, not started |
| Future payouts | DESIGN ONLY | `docs/future-monetization.md` |
| Future monetization | DESIGN ONLY | commissions/subscriptions/featured slots named only |

## 3. Client Portal — capability status (evidence-based)

| Capability | Status | Evidence |
|---|---|---|
| Client signup | COMPLETE | shared `/signup`; `POST /api/auth/register` |
| Role intent | COMPLETE | additive `roleIntent` — an onboarding request, NEVER an authorization claim |
| Client signin | COMPLETE | `POST /api/auth/login` |
| Client logout | COMPLETE | shared logout path |
| Client sessions | COMPLETE | JWT bearer + DB re-validation |
| Client RBAC | COMPLETE | client-only booking access enforced; providers/admins directed away |
| Client profile | PARTIAL | account basics exist; no client settings surface |
| Discovery | COMPLETE (core) | public `GET /providers`; `pages/discover.tsx`; browsable without an account; verified-only surfacing |
| Provider search | PARTIAL | browse + basics; no geo-distance sort/filter yet |
| Provider profile (public) | COMPLETE | `pages/provider-profile.tsx`; `GET /providers/:id` |
| Provider services (public) | COMPLETE | `GET /providers/:id/services` (gated on approved verification) |
| Service categories | PARTIAL | category field surfaces; no taxonomy UX |
| Verification indicators | COMPLETE | verified-only discovery + trust display |
| Booking request | COMPLETE | `POST /bookings`; unauthenticated → sign-in routing |
| Booking status | COMPLETE | server-owned status labels; refresh on mount/focus/reconnect |
| Booking history | COMPLETE (bounded) | `GET /bookings/history` client-safe bounded (test:care-history) |
| Cancellation | PARTIAL | cancel works; **cancellation confirmation + duplicate-submit protection are the queued next slice (Priority 2)** |
| Duplicate-submit protection | NOT STARTED | queued in Priority 2 |
| Rescheduling | PARTIAL | `rescheduled` exists in the state machine + transitions tested; no client UI |
| Completed bookings | COMPLETE | history separation upcoming/past/cancelled |
| Reviews | PARTIAL | backend COMPLETE (`POST/GET /reviews`, completed-booking + one-per-booking validation, green); client review UI NOT STARTED (queued) |
| One-review-per-completed-booking rule | COMPLETE (API) | duplicate races return safe conflicts (review.integration) |
| Notifications (client-facing) | SCAFFOLDED | SSE + push infra exists; no client feed |
| Account deletion | NOT STARTED | no route/UI |
| Support | NOT STARTED | `support.ts` schema exists (SCAFFOLDED at DB layer); no routes/UI |

## 4. Client comfort & consent — planned stack-native capability

Status on OnCall Foot main: **NOT STARTED (DESIGN ONLY)** — Phase 4C has a standing
contract-only approval; implementation is gated (own scope approval + Gate B).
The recovered Comfort-Wiring contract V3 (+V3.1 history addendum) and its working
FastAPI/Mongo implementation are preserved on `conflict_110826_1322` — **reference
material only**.

Binding product rules for the eventual port:

| Rule | Requirement |
|---|---|
| Optional comfort profile | client-owned, entirely optional |
| Consent-first collection | nothing stored without explicit consent |
| Versioned consent | append-only, versioned (+hashed) consent rows |
| Grant consent | explicit action; scoped at grant time |
| Withdraw consent | separate action; **withdraw hides, never deletes** |
| Delete profile | separate explicit operation from withdraw |
| Per-category visibility | client picks exactly which categories are shared (notes OFF by default) |
| Consent history | owner-scoped, append-only timeline of every grant/withdrawal |
| Booking-only provider projection | provider sees a filtered projection ONLY with an eligible (active-booking) relationship |
| Projection eligibility | server-derived; **404-only** semantics — no 403 path ever |
| No discovery exposure | preference data never appears in discovery |
| No search exposure | never indexed/searchable |
| No access without relationship | no eligible relationship → 404, indistinguishable from absence |
| Language | no medical or diagnostic language; no “medically suitable” claims |

Port target: PostgreSQL + Drizzle (additive models), Express + TypeScript routes with the
exact status-code semantics (grant 201/400, PUT 409-on-inactive-consent, withdraw/delete
separate each 404-capable, projection 404-only), existing OnCall Foot auth/RBAC,
React/Vite UI, `node:test` suites. **Do not apply FastAPI/Mongo patches directly.**

## 5. Admin / Operations Portal — implemented vs roadmap

**Actually implemented (evidence):**

| Capability | Status | Evidence |
|---|---|---|
| Admin signin | COMPLETE | shared auth; demo admin seeded |
| Admin RBAC | COMPLETE | `requireRole("admin")` DB-backed |
| Provider verification queue | COMPLETE | `GET /api/admin/verification/queue` + `PATCH /api/admin/verification/docs/:docId`; `pages/admin/verification.tsx` |
| Reviewer decisions | COMPLETE | `POST /api/admin/provider-applications/:id/approve\|reject`; transactional notifications; self-review prevention; 14/14 |
| Provider approval/rejection | COMPLETE | same endpoints; application state machine |

**Roadmap only — do NOT mark implemented:**

| Capability | Status |
|---|---|
| Provider suspension | NOT STARTED |
| Client management | NOT STARTED |
| Booking oversight | NOT STARTED (admin override exists in the state machine only) |
| Disputes | NOT STARTED |
| Support (admin side) | NOT STARTED (DB schema SCAFFOLDED) |
| Taxonomy / categories mgmt | NOT STARTED |
| Commissions | DESIGN ONLY |
| Payouts | DESIGN ONLY |
| Subscriptions | DESIGN ONLY |
| Invoices (admin view) | NOT STARTED |
| Analytics | PARTIAL substrate (`marketplace_events` Phases 1–3, 12/12) — reporting BLOCKED (Gate B); dashboards NOT STARTED |
| Audit logs | PARTIAL substrate (append-only `marketplace_events`); no UI |
| Operations dashboards | NOT STARTED |

---

## 6. Branch & conflict handling (permanent rules)

Current inventory: **`docs/roadmap/BRANCH_INVENTORY_V7.md`** (26 conflict branches,
supersedes `docs/conflict-branch-inventory-2026-08-11.md` v6).

A merge is NEVER allowed merely because a branch is newer, has a later timestamp in its
name, contains a useful feature, was called “approved” by an agent, or carries a passing
test report. Before ANY integration verify: project identity, stack identity, merge base,
parent commit, files changed, test evidence, roadmap relevance, and whether the
functionality already exists on main.

For no-merge-base branches: do not merge; do not cherry-pick blindly; do not copy whole
trees; classify and preserve as reference; port only specific behavior in a new
stack-native task.

## 7. Current roadmap priorities (recorded 2026-08-11, Session 068)

**Priority 1 — Gate B clearance.** Verify the managed PostgreSQL environment and required
`DATABASE_URL`. Managed database ONLY — never substitute local PostgreSQL, never fabricate
a PASS. If `DATABASE_URL` is unavailable, Gate B is **BLOCKED**; record exactly which
checks ran and which did not. No migrations or production event writes activate before
Gate B clears. (Status now: **BLOCKED/UNVERIFIED** — no managed `DATABASE_URL` has ever
been verified.)

**Priority 2 — Client booking lifecycle completion.** Cancellation confirmation,
duplicate-submit protection, one-review-per-completed-booking UI, existing API reuse,
client booking-history update, notification behavior, tests for repeat submissions and
invalid states. This is the next product feature slice after Gate B (or while Gate B
access is being arranged).

**Priority 3 — Phase 4C stack-native port PLAN (plan only, no implementation).** Define:
Drizzle schema additions, Express routes, authorization boundaries, consent status model,
visibility model, provider projection conditions, exact status codes, test strategy,
React/Vite UI changes, one-task → one-commit → one-patch sequence. Cite the recovered
Comfort-Wiring contract as reference; never apply its FastAPI/Mongo code.

**Priority 4 — Inventory V7 governance + branch export.** Inventory V7 must be published
before any branch cleanup. Comfort-Wiring branches must be exported to a separate
repository/archive before cleanup is even considered. **No branch deletion is authorized
by this document.**

## 8. Future agent logic flow (mandatory, every session)

1. Identify the repository. 2. Fetch origin. 3. Verify `origin/main` (full SHA + date).
4. Read `AGENTS.md`. 5. Read `docs/roadmap/NEO_EAGLE_VIEW.md`. 6. Read
`.agents/AGENT-RULES.md`. 7. Read `.agents/SETUP.md`. 8. Read `.agents/NEXT_TASK.md`.
9. Read recent `.agents/LOG.md` entries. 10. Identify the portal affected. 11. Identify
the layer affected. 12. Identify the project and stack. 13. Classify the current branch.
14. Check the merge-base relationship. 15. Search for existing implementation. 16. Check
whether the task is already complete. 17. Check whether the requested behavior is
roadmap-approved. 18. Produce a task plan. 19. Implement only ONE scoped task. 20. Run
targeted tests. 21. Run typecheck/build. 22. Create one commit. 23. Create one patch.
24. Update `.agents/LOG.md`. 25. Update `.agents/NEXT_TASK.md`. 26. Update the patch
index/records. 27. Leave the worktree clean. 28. Push only the correct feature branch.
29. Use a pull request / reviewed fast-forward for `main`. 30. Never force-push or
rewrite history.
