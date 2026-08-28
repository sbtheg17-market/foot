# Provider Onboarding & Return-Path Reliability — Conversion Blueprint

> **Status:** READ-ONLY PLANNING ARTIFACT. Uncommitted. No runtime code, schema,
> migration, API contract, deployment config, or provider data was changed to
> produce this document. The managed production database was **not** accessed.
>
> **Author task:** Diagnose and plan a safe fix for the provider return-path
> failure: a newly signed-up provider reaching the Approval Status & Activation
> Hub after logout/re-login and seeing *"We couldn't load your application
> status. Please try again in a moment."*

---

## A. Executive summary

A real, newly signed-up provider signed up successfully, logged out, logged back
in, reached the provider Approval Status & Activation Hub, and was shown a
generic dead-end error instead of their true status and next step.

This is the single highest-leverage reliability problem in the product right now
because it fails at the **exact moment a provider converts from "signed up" to
"committed to setting up."** A provider who cannot see their status on return
cannot: complete their profile, add a service, set a service area, set
availability, publish a booking page, or share a link. Every downstream value —
bookings, retention, the Southern Ontario pilot, and any client-side conversion —
is gated behind this screen loading truthfully.

**This is a conversion and trust problem, not merely an error-handling problem.**
The generic error does two kinds of damage:

1. It blocks the journey (functional failure).
2. It teaches the provider that the product is unreliable *at the first moment
   they came back to invest effort* (trust failure). A provider who hits this on
   their first return is the most likely provider to never return again.

**Why this takes precedence** over handout styling, marketing assets, a Graphify
refresh, advanced analytics, payments/payouts, reminders, organization/workspace
features, or marketplace/discovery expansion: none of those are reachable or
worth funding until a provider can reliably re-enter the funnel and see the
truth. Marketing spend against a leaky first-return experience amplifies the
loss. The onboarding/return path is the foundation the rest of the roadmap
stands on.

---

## B. Verified baseline

All values below were read directly from the workspace at planning time.

| Item | Value |
|---|---|
| Workspace root | `/app` (git toplevel `/app`) |
| Current branch | `main` |
| Current HEAD SHA | `05295f471507aedea52957b6d02a557520d2677b` |
| `origin/main` SHA | `05295f471507aedea52957b6d02a557520d2677b` (HEAD == origin/main) |
| Working tree | Clean (`git status --short` empty). No uncommitted changes; no in-progress local work to overwrite. |

### Feature / PR status (verified from `git log` + code + `docs/TODO-LEDGER.md`)

| Feature | Status | Evidence |
|---|---|---|
| **Vacation Ranges / blocked ranges** | **MERGED into `main`** | PR **#68** = HEAD commit `05295f4` "feat: add vacation ranges (blocked time off) for providers". Code: `artifacts/web/src/components/blocked-ranges-section.tsx`, `artifacts/api-server/src/__tests__/vacation-ranges.integration.test.ts`, `docs/migrations/PROVIDER_BLOCKED_RANGES_V1.sql`. Branches `feat/vacation-ranges`, `conflict_280826_1051` also point here. |
| **Emergency Openings** | **MERGED into `main`** | PR **#67** = commit `0baae91` (HEAD's parent) "feat: add emergency openings for providers (one-off extra slots)". Code: `artifacts/web/src/components/emergency-openings-section.tsx`, `emergency-openings.integration.test.ts`, `docs/migrations/PROVIDER_EMERGENCY_OPENINGS_V1.sql`. Branches `feat/emergency-openings`, `conflict_280826_0016` also point here. |
| **Approval Status & Activation Hub** | **MERGED** | PR **#64** = commit `d273d5f` "feat: add provider approval status and activation hub". Endpoint `GET /providers/me/activation-status`; page `artifacts/web/src/pages/provider-application-status.tsx`; doc `docs/provider-approval-status-hub.md`. |
| **Provider Dashboard Phase A** (Next Best Action + Pending Reschedule) | **MERGED** | PR **#66** = commit `9398bf4` "feat: surface provider actions and reschedule work on dashboard". Code: `artifacts/web/src/components/dashboard/next-best-action.tsx`, `dashboard/pending-reschedules.tsx`. |
| **Reschedule navigation badge** | **MERGED** | Part of PR #66 (`?tab=rescheduled` deep link + pending count badge). |
| **Printable QR handout** | **MERGED** | `BookingPageCard` share/QR section, surfaced in the hub and dashboard (`feat/provider-conversion-sharing`). |

> **Deviation vs. old handoffs:** The mission brief suggested Emergency Openings /
> Vacation Ranges "may be in progress, pending, or merged." **Both are merged and
> are the two most recent commits on `main`.** No availability-exception work is
> currently open or local. This changes Approval Gate J.1: there is effectively
> no in-progress availability work left to "finish/merge" before the reliability
> fix — the reliability fix is the immediate next build.

### Files / routes / components actually verified

- **API:** `artifacts/api-server/src/routes/providers.ts` (helpers `getOwnProfile`,
  `getOwnApplication`, `assertProviderMember`; routes `/application`,
  `/application/status`, `/application/completion`, `/me/readiness`,
  `/me/activation-status`), `routes/auth.ts` (`/register`, `/login`, `/me`,
  `/logout`), `middlewares/auth.ts` (`requireAuth`, `loadAuthorizationContext`,
  `requireRole`, `requireApprovedProvider`), `lib/provider-readiness.ts`
  (`loadReadinessSourceByUserId`, `computeReadiness`), `lib/role-state.ts`
  (`loadRoleState`), `app.ts` (catch-all error handler, `cors()`).
- **Web:** `pages/provider-application-status.tsx`, `App.tsx` (routing +
  `setAuthTokenGetter`), `main.tsx`, `lib/routes.ts`, `pages/register.tsx`,
  `pages/login.tsx`, activation-hub components.
- **Mobile:** `artifacts/mobile/app/provider/application-status.tsx`.
- **Client:** `lib/api-client-react/src/custom-fetch.ts` (`ApiError`,
  `ResponseParseError`).
- **DB:** `lib/db/src/schema/provider-applications.ts`, `.../providers.ts`;
  `docs/migrations/*.sql`; `docs/deployment-notes.md`, `docs/TODO-LEDGER.md`.

### Known deviations between earlier handoffs and current code

1. `custom-fetch.ts` comments claim the **web** relies on "session token cookies …
   automatically associated by the browser." **The server has no cookie auth.**
   `requireAuth` accepts a **Bearer token only** (`middlewares/auth.ts:101-105`),
   and the web attaches it from `localStorage['oncallfoot_token']`
   (`App.tsx:36`). The cookie comment is **stale/inaccurate documentation drift**;
   functionally web is bearer-token based. (Does not itself cause the bug, but it
   is a documented-behavior vs. actual-behavior mismatch to correct.)
2. The mission brief lists `loadRoleState`, `loadReadinessSourceByUserId`,
   `computeReadiness`, `nextAction` as expected building blocks — **all verified
   present and current** with the exact names.

---

## C. Provider route & data-flow map

### Web (React + wouter), the surface where the error was reported

```text
Register (pages/register.tsx)
  POST /api/auth/register {roleIntent:"provider"}
    → tx: insert users → insert account_roles(provider)
         → RAW SQL insert provider_profiles(user_id)
         → RAW SQL insert provider_applications(user_id, provider_profile_id)
    → 201 { token, user: {...roleState} }
  → localStorage['oncallfoot_token'] = token
  → redirect into onboarding / activation hub

Login (pages/login.tsx)
  POST /api/auth/login → 200 { token, user }
  → localStorage['oncallfoot_token'] = token

Every authenticated request:
  App.tsx: setAuthTokenGetter(() => localStorage.getItem('oncallfoot_token'))
  custom-fetch attaches: Authorization: Bearer <token>

Activation Hub route  /provider/application-status  (App.tsx:75)
  page = pages/provider-application-status.tsx
    useGetMe()                              → GET /api/auth/me
    useGetMyProviderActivationStatus()      → GET /api/providers/me/activation-status   (retry:false)
    useGetProviderApplicationStatus()       → GET /api/providers/application/status     (retry:false)

Server GET /providers/me/activation-status  (providers.ts:1942)
  requireAuth (Bearer → verifyToken → loadAuthorizationContext; 401 on any failure)
  assertProviderMember (403 if not a provider member)
  application = getOwnApplication(userId)   ← innerJoin applications×profiles; SELECTS rejection_reason
  profile     = getOwnProfile(userId)
  source      = loadReadinessSourceByUserId(userId)
  if (!application || !profile || !source) → 404 "Provider application not found."
  computeReadiness + serviceArea + docs + firstBooking probes
  buildStatusView(application)              ← reads application.rejectionReason
  → 200 { activation: { applicationStatus, ..., milestones, nextAction } }

Web renders:
  meQuery.isLoading || activationQuery.isLoading         → spinner
  meQuery.error || !me.user                              → redirect to /login
  activationQuery.isError || !activation:
      status === 404  → "Start your provider application" + Start onboarding CTA
      status === 403  → "no provider application on this account" + Continue as client
      otherwise (401/409/422/500/network/malformed-200)  → *** GENERIC ERROR ***
                        "We couldn't load your application status. Please try again in a moment." + Try again
  else                                                   → full hub
```

### Mobile (Expo) — same copy string, different endpoint

`artifacts/mobile/app/provider/application-status.tsx` consumes
**`GET /providers/application/status`** (not `/me/activation-status`), authed via
a Bearer token from `setAuthTokenGetter`. Its error branching is identical in
shape: `404 → start`, `403 → forbidden`, otherwise the same generic string
(line 209). So the *same* class of server failure produces the *same* message on
both platforms, but through two different endpoints that **share the
`getOwnApplication` read path** on the server.

> **Key structural fact for diagnosis:** the generic error is the *else* branch —
> it fires for **any** status that is **not 404 and not 403**, and also when the
> request returns **200 with a body that lacks `activation`**. A 404 does *not*
> produce the generic error (it produces the "Start your provider application"
> empty state). Therefore the reported message is **not** a "no application row"
> case; it is 401 / 409 / 422 / **500** / network / malformed-200.

---

## D. Failure analysis and evidence

### D.1 Exact UI component and fallback copy

- **Web:** `artifacts/web/src/pages/provider-application-status.tsx:141-155`,
  `data-testid="activation-hub-error"`, copy *"We couldn't load your application
  status. Please try again in a moment."*, with `data-testid="activation-hub-retry"`.
- **Mobile:** `artifacts/mobile/app/provider/application-status.tsx:203-222`,
  `testID="application-status-error"`, identical copy.

### D.2 Exact query/hook and endpoints

- Web generic error is driven by `useGetMyProviderActivationStatus` →
  `GET /api/providers/me/activation-status` (`retry:false`), with a secondary
  `useGetProviderApplicationStatus` → `GET /api/providers/application/status`.
- Mobile generic error is driven by `useGetProviderApplicationStatus` →
  `GET /api/providers/application/status` (`retry:false`).
- Both server routes read through `getOwnApplication(userId)`
  (`providers.ts:113`), whose `select({... rejectionReason:
  providerApplicationsTable.rejectionReason ...})` names the additive column
  `provider_applications.rejection_reason`.

### D.3 HTTP-status categories and their meaning here

| Status | What it means in this flow | Client result |
|---|---|---|
| **401** | Bearer missing/expired/invalid, OR `loadAuthorizationContext` returns null (user missing/`isActive=false`) OR `authz.activeRole !== jwt.role` (`middlewares/auth.ts:116`). | Web: `me` also 401 → redirected to `/login` before the generic error normally shows. If only the activation call 401s while `/me` succeeded (token race / partial header), → **generic error**. |
| **403** | Authenticated but `authz.roles` has no `provider` membership (`assertProviderMember`). | Dedicated "no provider application on this account" state (NOT generic). |
| **404** | `application` OR `profile` OR readiness `source` is null — no provider profile/application row for this user (true empty, or a **partial account** missing one side). | "Start your provider application" empty state (NOT generic). |
| **409** | Not produced by these read routes. | (n/a) |
| **422** | Not produced by these read routes (no input to validate). | (n/a) |
| **500** | Any unhandled server exception inside the route → catch-all handler returns `{error:"Internal server error"}` (`app.ts:116-118`). **A Postgres `42703 column does not exist` on `rejection_reason` (or another Gate-B-pending column) lands here.** | **Generic error.** |
| **200 malformed** | Response shape lacks `activation` (client/contract drift). `!activation` is true, `status` undefined → not 404/403. | **Generic error.** |

### D.4 Server-side loaders/tables/conditions that could fail

- `getOwnApplication` — `provider_applications ⋈ provider_profiles`, **selects
  `provider_applications.rejection_reason`** and profile columns
  `service_area_notes`, `profile_complete`, `verification_status`.
- `getOwnProfile` — `select()` (all columns) from `provider_profiles`; a `select
  *` equivalent will emit **every** schema column including
  `public_slug`, `booking_page_published`, `booking_page_published_at` — all
  additive, all Gate-B-gated.
- `loadReadinessSourceByUserId` — `provider_profiles ⟕ provider_applications`.
- `computeReadiness` — probes `services`, `availability`, `travel_zones`,
  `verification_docs`.
- `buildStatusView` — reads `application.rejectionReason`.

### D.5 The decisive documentary evidence (schema drift)

The repository **already documents this exact failure class**:

- `docs/migrations/PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` header (verbatim):
  > *"provider_applications.rejection_reason is defined in
  > lib/db/src/schema/provider-applications.ts and selected by the
  > /providers/application* routes, but no frozen migration artifact captured it
  > (recorded OPEN in docs/TODO-LEDGER.md on 2026-08-28). On a database without
  > it, the owner application/status/completion reads fail 42703 → 500."*
- `docs/deployment-notes.md` → *"Deployment startup must never push schema … Startup-time schema push (`drizzle-kit push` in any start command) is prohibited."* Migrations apply **only** through the manual Gate B `psql` procedure. Branch `origin/fix/deploy-remove-startup-db-push` confirms startup push was removed.
- `docs/TODO-LEDGER.md`:
  - `Gate B reminder | OPEN | Full provider features (#11 booking pages, rejection reasons) still require the frozen migrations to be applied to the managed DB under Gate B. Signup no longer blocks on them.`
  - `Frozen artifact: rejection_reason | DONE 2026-08-28 | … Disposable-PG … PASS. **Managed DB NOT accessed — Gate B-pending.**`
  - A prior, already-fixed twin: `/providers/me/verification` once selected Gate-B-pending `provider_profiles` booking-page columns → `42703 → unhandled 500`.
- `routes/auth.ts:93-114` provisions the provider profile/application with **raw
  SQL naming only `user_id`/`provider_profile_id`** *precisely so signup does not
  depend on Gate-B-pending additive columns.* **The read path was not given the
  same treatment** — `getOwnApplication`/`getOwnProfile` still select the additive
  columns.

**Synthesis:** signup succeeds (raw SQL avoids the un-migrated columns), but the
return-path read (`/me/activation-status` and `/application/status`, both via
`getOwnApplication`) selects `rejection_reason` (and `getOwnProfile` selects
`public_slug` / `booking_page_published`). If the deployed Railway database has
not had the corresponding Gate-B migrations applied, those reads throw
`42703 → 500 → {error:"Internal server error"}`, which the client renders as the
generic *"We couldn't load your application status."* — an exact, mechanism-level
match for the observed report and the "signed up fine, broke on return" timing.

> **Honesty / boundary:** This is the **most-evidenced hypothesis**, supported by
> source + migration headers + the ledger, but it is **LIKELY, not CONFIRMED.** It
> cannot be confirmed without runtime evidence from the deployed environment (the
> sanitized HTTP status + server log category for that request), which is out of
> scope for this read-only task and requires an approval gate (J.3). Do not treat
> the generic screen as proof of any single backend cause.

### D.6 Evidence-ranked root-cause matrix

| Rank | Hypothesis | Evidence for | Evidence against | Safe reproduce / verify | Likely remedy |
|---|---|---|---|---|---|
| **1** | **Schema drift: `provider_applications.rejection_reason` (and/or `provider_profiles.public_slug`, `booking_page_published`) not applied on the deployed DB → `42703` in `getOwnApplication`/`getOwnProfile` → 500.** | Migration header + `deployment-notes` Gate B + ledger "Managed DB NOT accessed — Gate B-pending" + raw-SQL signup workaround only on the write path + prior identical twin on `/me/verification`. Explains signup-OK / return-broken timing. | Not runtime-confirmed; the migration may have been applied to prod out of band. If applied, this is fully excluded. | Local disposable PG **without** `rejection_reason`; sign up (raw SQL → 201), then `GET /providers/me/activation-status` → expect 500 + server log `42703`. Prod: sanitized HTTP status + `information_schema.columns` presence check under Gate B only. | Apply the frozen Gate-B migration(s) to the managed DB **and** make the owner read path resilient (select only guaranteed columns, or coalesce/guard optional additive columns) so an un-migrated column can never 500 a status read. |
| **2** | **200-but-malformed / generated-client contract drift** — response lacks `activation`. | Web `!activation` → generic error with `status` undefined; `ResponseParseError` for invalid JSON also lands here. | `orval`-generated client + zod types are in-repo and versioned; no evidence of a shape mismatch on `main`. | Contract test: server 200 shape ↔ `lib/api-zod` schema for activation-status; force a truncated/invalid JSON and assert the client surfaces a typed error. | Add a response-contract regression test; ensure client distinguishes parse/transport errors from empty state. |
| **3** | **Auth/session failure after re-login** (401 on the activation call while `/me` succeeded). | `requireAuth` 401 paths incl. `activeRole !== jwt.role` and `isActive=false`; token stored in `localStorage`. | If token were simply absent/expired, `/me` would also 401 → redirect to login, not the generic error. Requires a *partial* 401. | Local: valid `/me`, then tamper role/isActive between calls; assert activation 401 → confirm current UI behavior. | Preserve 401 semantics; on activation-specific 401 with a valid session, route to a truthful re-auth path (never mask as empty success). |
| **4** | **Partially-created provider account** (profile without application, or vice-versa; historical rows from pre-#56/#59 bugs). | `getOwnApplication` innerJoin + the triple-null 404 guard; history of signup-provisioning fixes (#55, #56, #59). | For *current* signups the register tx is atomic (both rows or neither), so new partial accounts should not occur. A partial account yields **404 → "Start your provider application"**, not the generic error. | Local: create user with profile but no application; hit both routes; observe 404 empty state (misleading, but not the generic error). | Add an idempotent, transactional self-heal for the specific recoverable invariant, or a truthful recovery path — only if evidence shows real partial rows. |
| **5** | **Unhandled server exception in a readiness/probe helper** (non-drift), e.g. a null/þrown in `computeReadiness` or `hasActiveServiceAreaCoverage`. | Any throw → catch-all 500 → generic error. | Helpers are `LIMIT 1` guarded and covered by integration tests on `main`. | Local integration run of `provider-activation-status.integration.test.ts` + fault injection. | Targeted guard + regression test for the specific throw. |
| **6** | **Client query/cache/redirect race** (activation query fires before token is readable, or a stale cache). | `enabled: Boolean(me?.user)`; token read synchronously from `localStorage`. | Token getter is synchronous; `retry:false` means a transient race would persist rather than self-recover, which is not typical of a race. | Playwright: logout→login→hub with throttling; inspect request ordering/headers. | Only if reproduced: gate the query on token presence / add a bounded retry for transport-only errors. |
| **7** | **API route / deployment mismatch** (`/api` prefix, base URL, build not shipping the route). | Single-service deploy serves API+web on one port. | Route is mounted (`routes/index.ts:18`) and exercised by tests; a mismatch would 404 the *route* → "Start your provider application", not generic. | Verify built bundle exposes the path; sanitized prod probe of the endpoint path. | Fix routing/build only if verified. |
| **8** | **CORS** | — | `app.use(cors())` allows all origins; single-origin deploy. **Excluded.** | — | None. |

---

## E. Proposed implementation plan (for a future build agent)

### Phase 1 — Reproduction & instrumentation (no prod writes, no PII)

1. Stand up **disposable local PostgreSQL** (the repo's existing scratch flow;
   `pnpm run db:push` is explicitly a local-scratch-only tool). Seed isolated
   test users only.
2. Reproduce the full path with fresh accounts:
   signup → logout → re-login → browser refresh → `GET /me/activation-status`.
3. Run the **drift simulation**: create a scratch DB **without**
   `provider_applications.rejection_reason` (and/or the `provider_profiles`
   Gate-B columns), sign up (expect 201 via raw SQL), then call the status routes
   and confirm `42703 → 500 → generic error`. This deterministically proves or
   disproves Rank-1 locally without touching prod.
4. For the **production** signal, under Approval J.3 only, collect **sanitized**
   metadata for the failing request: HTTP status, whether the body is
   `{error:"Internal server error"}`, the server-side pino `req.id` correlation
   id, and the **error category** (e.g. Postgres error `code`), plus a Gate-B
   `information_schema.columns` presence check for the suspect columns. **Never**
   capture secrets, cookies, full tokens, reviewer notes, document references, or
   real provider/client data. Add **no** production logging that exposes secrets
   or PII.

### Phase 2 — Narrow, minimal-risk root-cause fix

Apply only what the Phase-1 evidence supports. Candidate-specific minimal fixes:

- **Rank-1 (drift) — two complementary, both additive/safe:**
  1. **Apply the frozen Gate-B migration(s)** (`PROVIDER_APPLICATION_REJECTION_REASON_V1.sql`,
     and the `provider_profiles` booking-page/public-slug migrations) to the
     managed DB via the documented preflight → SHA-256-verify → apply-once `psql`
     procedure. Additive, no backfill, restore-based rollback.
  2. **Harden the owner read path** so a status read can *never* 500 on a missing
     optional additive column: have `getOwnApplication`/`getOwnProfile` select the
     minimal guaranteed column set (mirroring the signup raw-SQL discipline), or
     coalesce/guard `rejection_reason`, `public_slug`, `booking_page_published` as
     nullable. Optional/missing fields must degrade to valid readiness/next-action
     states, **never** a 500.
- **Signup provisioning:** already transactional; only add idempotency/self-heal
  if Phase-1 shows real partial rows (Rank-4). Do not add speculative machinery.
- **Missing required persisted state:** self-heal **only** when it is a valid,
  recoverable signup invariant achievable transactionally and idempotently;
  otherwise surface a truthful recovery/support path that **does not bypass
  approval**.
- **Auth:** preserve correct **401/403** semantics. Never convert an auth failure
  into an empty successful response or a fake "start onboarding" state.
- **Contract/route/deploy drift:** address only when verified by Phase 1.

### Phase 3 — UX recovery & conversion (mobile 390×844 + desktop)

Every state must satisfy: *I know where I am. I know what to do next. I can
recover if something went wrong. I am not being asked to guess.* Copy below is
**PROPOSED** until implemented.

| State | Server signal | Mobile + desktop behavior | Primary CTA | Proposed copy |
|---|---|---|---|---|
| Loading | queries pending | Spinner with accessible label; skeleton on desktop | — | "Loading your application status…" |
| Draft | `applicationStatus=draft`, `nextAction=continue_onboarding` | Resume banner; deep-link into onboarding step | Continue onboarding | "Pick up where you left off." |
| Under review | `under_review` / `wait_for_review` | Calm, no false ETA | (secondary) Contact support | "Your application is with our review team. We'll update this page when there's a decision." |
| Approved / not ready | `approved` + a `nextAction` (complete_profile / configure_service_area / add_service / set_availability / publish_booking_page) | Milestone checklist + exactly one highlighted next action | The single next action | "You're approved. Next: {action} so clients can book." |
| Ready | `all_set` / `share_booking_page` | Share section (link, copy, QR) prominent | Share booking link | "Your booking page is live — share it to get your first booking." |
| Rejected | `rejected` / `review_update_needed` | Provider-visible reason only (never reviewer notes) + reset/resubmit when `canReset`/`canResubmit` | Reset to draft / Resubmit | "We need a small update before we can finish your review." |
| Suspended | `suspended` / `contact_support` | Truthful, non-punitive; support path | Contact support | "Your provider access is paused. Contact support and we'll help." |
| Network/server failure | transport error / 500 | **Retry** + a truthful, non-blaming message + a support path so it is not a dead end; preserve any last-known state where safe | Try again | "We couldn't reach your status just now. Retry — and if it keeps happening, contact support." |
| Partial-account recovery | verified partial invariant | Truthful recovery/support path (not a misleading "start onboarding") | Recover / Contact support | "Something didn't finish setting up your provider account. We can fix this — {recover / contact support}." |

Guardrails: no fake urgency, no invented demand or approval claims, one primary
action per state, keyboard-reachable, screen-reader labelled, works at 390×844.

### Phase 4 — Regression coverage (must-have list)

**API / integration** (extend existing `provider-activation-status.integration.test.ts`,
`provider-application-status.integration.test.ts`, `registration.test.ts`):

- Fresh provider signup creates the expected persistent state (user + account_role
  + profile + application) atomically.
- **Drift guard:** with a Gate-B-pending column absent, the status/activation read
  **does not 500** (post-fix) — the single most important new test.
- Logout → re-login → activation-status → 200 truthful payload.
- Browser-refresh equivalent (fresh request with same token) → 200.
- Draft / under_review / approved-not-ready / approved-ready / rejected /
  suspended each yield the correct `nextAction`.
- Optional profile data missing → valid readiness, never 500.
- Required-state inconsistency (partial account) → deterministic, truthful result.
- Client-only account → 403 branch.
- Unauthorized caller (no/invalid/expired Bearer) → 401 (not masked).
- Cross-provider isolation: provider A can never read provider B's application.
- **Response contract:** server 200 shape ↔ `lib/api-zod` activation schema.
- **Leak checks:** no raw SQL, stack, token, reviewer notes, document references,
  or PII in any response (extend `secret-scan.sh` / assertions).

**Web + mobile + browser:**

- Playwright (desktop + 390×844): logout→login→hub renders true state; error
  fallback shows Retry and recovers on a healthy retry; 404 shows "Start" not the
  generic error; 403 shows the client path.
- Accessibility: keyboard traversal of every CTA; screen-reader labels on
  loading/error/retry; focus management on state change.

---

## F. Cross-vertical adaptability

Initial vertical is **mobile foot care**, but the reliability fix must stay
vertical-neutral so later provider service verticals reuse it. Keep these
concepts abstract — **do not** build multi-vertical architecture now; only avoid
hardcoding:

| Concept | Keep neutral as | Avoid hardcoding |
|---|---|---|
| Profile completeness | Generic required-field rule (currently title + city + bio) | Foot-care-specific fields baked into readiness |
| Service offering | Generic "active service" | Treatment/service names in core logic |
| Service territory / travel | Generic "service area / travel rule" | City/region literals in the readiness gate |
| Availability | Generic recurring + exception windows | Foot-care scheduling assumptions |
| Booking page publication | Generic "publish flag + public slug" | Vertical wording in the publish gate |
| Verification / approval | Generic application state machine + mandated-doc set (`MANDATED_DOC_TYPES` already empty/configurable) | A fixed foot-care credential list in code |
| Readiness criteria | The C1–C7 criteria as data-driven rules | Vertical-specific pass/fail literals |
| Status / next action | Server-derived `nextAction` enum (journey-ordered) | UI-only or vertical-specific ordering |
| Exception time | Generic blocked ranges + emergency openings | Foot-care-only exception semantics |

Naming guidance for the fix: keep new columns/fields/enums named for the
*capability* (e.g. `serviceArea`, `bookingPage`, `nextAction`), never for the
foot-care domain.

---

## G. Client journey implications (future — NOT in this implementation scope)

```text
Provider completes setup
→ provider publishes a trustworthy booking page
→ client discovers / receives the booking link
→ client sees accurate services, territory, and slots
→ client books confidently
→ client can request reschedule / cancel with clear rules
→ provider responds without confusion
```

- **Client-journey work is explicitly out of the immediate implementation scope.**
- When it is built, it must use the **same principles** proven here: truthful
  states, no dead ends, exactly one clear next step, mobile-first, privacy-safe,
  no fake urgency, and public pages that stay crawlable/performant (SEO-safe SSR
  or equivalent, not client-render-only critical content).

---

## H. SEO & marketing guardrails (future, non-blocking)

- Do **not** change public booking URLs, slugs, canonical tags, title/meta
  description, or Open Graph behavior without an explicit, separate SEO task.
  (Note: `provider_profiles.public_slug` is one of the Gate-B-pending columns in
  the Rank-1 hypothesis; migrating it must not alter existing public URLs.)
- Critical public content — provider name, services, territory/location context,
  availability messaging — must remain crawlable and must **not** depend solely on
  client-side rendering.
- Future marketing/demo videos must use **seeded demo accounts**, never real
  provider/client data.
- Do not invest in paid social or content distribution until the
  onboarding/status return path is reliable (this work).

---

## I. Explicit non-goals

This priority does **not** include:

- Rebuilding the provider dashboard, the Activation Hub, or booking/scheduling.
- Changing Emergency Openings or Vacation Ranges **unless** this work uncovers a
  direct regression in them.
- Printable handout styling variants.
- Payments, payouts, refunds, fee logic, or subscriptions.
- Automated email/SMS/push reminders.
- Provider ranking or marketplace discovery changes.
- Organization/workspace features.
- Managed production database access **as part of this planning task**.
- Production deployment.

---

## J. Approval gates (decision request for the product owner)

1. **Priority ordering.** Confirm:
   *(a)* there is **no** in-progress availability work left to merge (Emergency
   Openings #67 and Vacation Ranges #68 are already on `main`) → so
   *(b)* **fix provider first-login/status reliability next**, then
   *(c)* run pilot usability / release-readiness, then
   *(d)* SEO/marketing, and later monetization.
2. **Scope of the first reliability build.** Choose one:
   *(i)* bug fix + tests only; or
   *(ii)* bug fix + narrow, truthful recovery UX for the partial-persisted-state
   case (recommended if Phase-1 finds any real partial rows).
3. **Production investigation.** Confirm the Railway issue may be investigated via
   **sanitized logs + HTTP metadata + a Gate-B `information_schema` column-presence
   check only** — no secrets, tokens, PII, or DB writes.
4. **Deploy vs. merge separation.** Confirm production deployment (and any Gate-B
   migration application) remains an **explicitly separate, authorized step** from
   merging the code fix.

---

## Recommended next build (one paragraph)

Apply the already-frozen Gate-B additive migration(s) to the managed database
under the documented Gate-B procedure **and** harden the owner status/activation
read path (`getOwnApplication` / `getOwnProfile`) so an un-migrated optional
additive column can never 500 a status read — mirroring the raw-SQL column
discipline already used on the signup write path. Ship with the Phase-4
drift-guard test as the centerpiece so this class of failure cannot regress.

---

## Implementation outcome (2026-08-28, `fix/provider-first-login-status`)

**Root cause: CONFIRMED by local drift simulation** (production metadata
verification remains BLOCKED — this environment has no Railway access, so
the deployed database was never touched). On a disposable PostgreSQL 15
database with the frozen Gate B artifacts *not* applied
(`rejection_reason`, `public_slug`, `booking_page_published`,
`booking_page_published_at` dropped; `provider_service_areas` /
`provider_coverage_areas` absent), the pre-fix build reproduced the exact
reported journey: signup 201 → re-login 200 →
`GET /providers/me/activation-status` and
`GET /providers/application/status` both **500** with
`42703 column provider_applications.rejection_reason does not exist`
(swallowed by the generic error handler), i.e. the "We couldn't load your
application status." screen.

**Remedy shipped (Phase 2 of this plan; Phase 1 evidence gathered locally):**

- `isSchemaDriftError` walks the Drizzle `cause` chain for `42703`
  (undefined_column) / `42P01` (undefined_table) — same convention as
  `isUniqueViolation` in `routes/auth.ts`.
- `getOwnApplication` now selects the signup-era stable column set eagerly
  and retries without `rejection_reason` on drift (degrades to `null` — the
  migrated column's backfill-free default, never fabricated state). The
  submission-history read degrades to an empty list only when its relation
  is absent (an absent relation can hold no rows).
- The activation hub uses a new `getOwnActivationProfile` (narrow
  booking-page select with a signup-era fallback: `publicSlug: null`,
  `bookingPagePublished: false` — the truthful pre-#11 state) instead of the
  bare-select `getOwnProfile`, and the service-area probe degrades to
  `serviceAreaConfigured: false` (truthful pre-#12 state) when the Gate B
  tables are absent.
- Healthy-schema behavior is byte-identical: the eager select is attempted
  first, so migrated databases never pay the fallback and `rejectionReason`
  passes through unchanged (regression-tested).

**Proof:** `test:return-path-drift` (11 tests, CI scripted loop) simulates
the pre-Gate-B database and proves signup → re-login → both status reads →
refresh stay truthful 200s, 401/403/ownership boundaries hold, and no SQL /
pg error internals leak; a second describe proves the migrated path still
surfaces `rejectionReason`. Full regression: scripted loop 27 suites green,
authz/concurrency suites green, unscripted suites green, web 237/237 +
a11y 33/33 + tz 10/10, workspace typecheck, `build`, `build:deploy`,
secret scan — all PASS. Live browser check on the drifted database: login →
`/provider/application-status` renders the truthful draft hub on desktop and
390×844.

**Unchanged, still required (separate release gates):** applying the frozen
Gate B artifacts to the managed database (Phase 1 remedy — this fix makes
drift survivable, not desirable) and production deployment/verification.
Neither was performed here (NOT AUTHORIZED / no access).
