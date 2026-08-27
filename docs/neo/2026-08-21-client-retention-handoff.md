# Neo Continuity — Client Retention → Rescheduling Enforcement

This file is the session-continuity record referenced by the Neo continuation
protocol. Append new dated sections; never rewrite or delete prior records.

---

## 2026-08-21 — Client Retention (Book Again) — record reconstructed 2026-08-22

The original continuity file for the Book Again session was never committed to
`main` (the session ended on a conflict snapshot branch). This section records
the verified outcome from the authoritative repository.

- Feature branch: `feat/client-retention-book-again`
- Branch tip commit: `5fcddbc3f28426d982e333204d4136485a2dea75`
  (`feat: add client book-again flow`)
- PR: #25 — MERGED into `main` (squash) as
  `5f22526280ed8c31cf3d5f13f9d30d51a40177a7`
  (`feat: add client book-again flow (#25)`)
- Prior slices verified present on `main`:
  - Provider first-booking conversion — merged (PR #24,
    `24c6a5a feat: improve provider first-booking conversion`).
  - Client reviews — complete (`review.integration.test.ts`, 7 scenarios).
- Session end state: work continued on `conflict_210826_2128` (auto-generated
  environment snapshot). That branch is PRESERVED, NON-AUTHORITATIVE, and must
  never be merged, rebased, force-pushed, deleted, or used as a base. Its
  history is unrelated to the application repository (workspace snapshot with
  its own root commit); it contains no unmerged product work that survives
  revalidation against `main`.

## 2026-08-22 — Rescheduling Enforcement (this session)

### Baseline verification

- Repository: `sbtheg17-market/foot` (verified via `origin` remote,
  `git@github.com:sbtheg17-market/foot.git`).
- Local path: `/app/repos/foot` (fresh clone; previous environment was reset).
- Pre-work authoritative `origin/main` SHA:
  `5f22526280ed8c31cf3d5f13f9d30d51a40177a7` — Book Again already merged; no
  Book Again or review regression found (suites re-run green, see below).
- Last-session branch `conflict_210826_2128`: present on the remote, tip
  `f82a81cf35e131834aad705b64e13681a6c8d6c1` ("Auto-generated changes").
  Inspected read-only; left untouched.
- Working tree at start: clean; no staged or untracked files; no secrets,
  database URIs, or production configuration present.

### Slice decision

Next slice per protocol: **Rescheduling enforcement audit and implementation.**

Audit of `PATCH /api/bookings/:bookingId/status` (`status="rescheduled"`)
found real enforcement gaps relative to booking creation:

1. Malformed `scheduledAt` produced an unhandled 500 (Invalid Date reached the
   database layer).
2. Past datetimes were accepted.
3. No availability-window check — reschedules could land outside the
   provider's windows.
4. No provider-overlap check — a reschedule could double-book on top of
   another client's active booking.
5. No friendly duplicate handling — landing on an exact active duplicate
   tuple hit the live partial unique index raw (500 with PG internals).
6. No service-availability check — bookings for deactivated services could be
   freely rescheduled.
7. No serialization with `POST /bookings` inserts (provider advisory lock was
   not taken), leaving a reschedule/new-booking race window.

Already correct before this session (verified, unchanged): authentication,
ownership checks, state-machine transitions under `SELECT … FOR UPDATE`,
`scheduledAt` required when rescheduling.

### Implementation (branch `feat/rescheduling-enforcement`, based on verified `origin/main`)

Changed files:

- `artifacts/api-server/src/routes/bookings.ts` — reschedule enforcement
  inside the existing status-transition transaction: valid future instant
  (same wording as creation), active-service check, availability-window fit
  via `isWithinAvailability` + `getMarketplaceTimezone`, provider advisory
  lock `pg_advisory_xact_lock(42001, providerId)` (same key as creation),
  same-client exact-duplicate preflight (friendly duplicate 409), provider
  overlap vs other clients' active bookings (friendly provider-unavailable
  409, identical interval rule to creation), and a race safety net mapping a
  partial-unique-index violation on the UPDATE to the same friendly 409.
  Existing response shape (`{ error }`) preserved; no analytics calls added
  to reschedule paths (analytics are out of scope for this slice).
- `artifacts/api-server/src/__tests__/rescheduling-enforcement.integration.test.ts`
  — new focused suite (12 scenarios), rerun-safe on a shared scratch DB.
- `artifacts/api-server/src/__tests__/booking-concurrency.test.ts` — one
  fixture updated: the reschedule step now takes its new time from the
  availability-backed slot pool instead of an arbitrary `now + 14 days`
  instant (which the new enforcement correctly rejects).
- `artifacts/api-server/package.json` — added `test:rescheduling` script.
- `docs/neo/2026-08-21-client-retention-handoff.md` — this record.

Not changed (boundaries respected): schema, migrations, OpenAPI contract,
payments, ledger, analytics, deployment configuration, conflict branches.
Known pre-existing spec drift (not introduced here): the OpenAPI entry for
`updateBookingStatus` does not declare 409, but the implementation already
returned 409 for invalid transitions before this session.

### Validation (local scratch PostgreSQL only; no managed DB access)

- Focused rescheduling suite: 12/12 (re-run twice; rerun-safe).
- Booking state machine unit suite: 63/63.
- Booking lifecycle regression: 14/14.
- Booking concurrency regression: 16/16 (after the fixture update above).
- Availability-enforced booking regression: 6/6.
- Review regression: 7/7.
- Book Again retention regression: 8/8.
- Typecheck: workspace-wide pass.
- Web build: not required (no frontend files changed).
- `git diff --check`: clean.
- Secret scan of changed files: clean (only the seeded demo password used by
  every existing integration suite).

### Known limitations / notes for the next operator

- Cross-provider client-overlap is not enforced for new bookings and is
  therefore (deliberately, for consistency) not enforced for reschedules.
  If this policy should change, change it for both paths in one slice.
- The web and mobile clients currently expose no reschedule UI (cancel only);
  rescheduling is API-level. A client-facing reschedule flow using the real
  slots endpoint is a natural next slice.
- `conflict_210826_2128` and all other conflict branches remain preserved and
  untouched.

### Session output

- New branch: `feat/rescheduling-enforcement` (base
  `5f22526280ed8c31cf3d5f13f9d30d51a40177a7`).
- Commit: `feat: enforce safe rescheduling` — exact SHA recorded in the final
  session handoff (single commit containing implementation, tests, and this
  continuity record).
- PR: not created automatically; branch pushed for review per protocol.

## 2026-08-22 — Client-facing reschedule flow (stacked branch)

### Baseline and stacked-base authorization

- Repository re-verified: `sbtheg17-market/foot`; `origin/main` still at
  `5f22526280ed8c31cf3d5f13f9d30d51a40177a7` (Book Again, PR #25).
- Prerequisite `feat/rescheduling-enforcement` is pushed at
  `f8f6ba64447a79626fd0be0eba0cf956ee2066c2` but has NO PR and is NOT merged
  into `main` (verified via git ancestry and the GitHub PR API).
- Per protocol the session stopped and reported; the operator then EXPLICITLY
  AUTHORIZED a stacked branch.
- New branch: `feat/client-reschedule-ui`, based on
  `feat/rescheduling-enforcement` (`f8f6ba6…`) — a STACKED branch, not based
  on `origin/main`. It contains the enforcement commit. REQUIRED MERGE ORDER:
  merge `feat/rescheduling-enforcement` into `main` first, then this branch.
- `conflict_210826_2128` untouched at `f82a81c…`.

### UI scope (web SPA only; server untouched in this slice)

Changed files:

- `artifacts/web/src/components/ui/reschedule-modal.tsx` (new) — bottom-sheet
  reschedule dialog mirroring the canonical BookingModal slot-selection
  pattern: date picker + REAL slots from the existing
  `GET /providers/:id/slots` endpoint (no arbitrary datetime entry), the
  current appointment slot disabled and labeled "current" (old datetime never
  reusable, with a submit-time guard as well), occupied slots disabled,
  submission disabled until a slot is chosen, duplicate-submit protection via
  the mutation pending state, loading/empty states, explicit handling for
  overlap / duplicate / outside-availability / inactive-service / invalid
  state / forbidden / generic errors (friendly recovery, grid refresh, no
  PostgreSQL internals), `role="dialog"` + `aria-modal` + labels + Escape
  close + initial focus, mobile bottom-sheet layout.
- `artifacts/web/src/pages/booking-detail.tsx` — "Need a different time?"
  section shown only for CONFIRMED bookings (the only state the server's
  state machine lets a client reschedule); skeleton while provider/services
  load; explanatory unavailable note when the original service is no longer
  offered (action hidden — server stays authoritative); on success the
  status-feedback toast is suppressed (client initiated it) and the booking
  refetches to "Rescheduled". Review, Book Again, cancel, and provider
  actions unchanged.
- No API, schema, migration, analytics, payment, or ledger changes. Uses the
  existing `PATCH /bookings/:id/status` contract and generated client hooks.

### Validation (local scratch PostgreSQL; SPA served by the API server)

- Backend regressions on a clean scratch DB: state machine 63/63, rescheduling
  12/12, lifecycle 14/14, concurrency 16/16, availability 6/6, reviews 7/7,
  Book Again retention 8/8 (126/126). An initial re-run on a dirty DB showed
  3 failures that were confirmed as rerun-collisions of pre-existing suites
  (fixed far-future fixture dates), not regressions.
- Browser verification (Playwright, mobile viewport 390×800, real server):
  10/10 scenarios — eligibility shown/hidden, real slots load, current slot
  disabled + labeled, occupied slot disabled, no submit without slot, happy
  path (success toast, status → Rescheduled), post-reschedule ineligibility,
  Escape/aria behavior, Book Again + review sections intact on a completed
  booking, reschedule section absent on completed bookings.
- The repository has NO web unit-test framework; focused UI coverage is
  therefore browser-automation verification (documented above), not committed
  test files.
- Workspace typecheck: pass. Web build: pass. `git diff --check`: clean.
  Secret scan of changed files: clean.

### Known limitations

- Client may reschedule only CONFIRMED bookings (server state machine);
  bookings already in `rescheduled` state need provider confirmation first.
- Provider-facing reschedule UI intentionally excluded from this slice.
- Slot grid marks the client's other own-booking times as unavailable via the
  slots endpoint's occupancy view; server-side duplicate/overlap rules remain
  the authority.
- Mobile app (Expo) reschedule UI not in scope.

### Session output

- Branch: `feat/client-reschedule-ui` (STACKED on `f8f6ba6…`).
- Commit: `feat: add client reschedule flow` — exact SHA in the final session
  handoff (single commit: modal, booking-detail integration, this record).
- PR: not created automatically; branch pushed and stopped for review.
- Merge prerequisites: `feat/rescheduling-enforcement` must merge first.

## 2026-08-22 — PR preparation record (no product changes)

### Verified state

- Repository: `sbtheg17-market/foot` (public), remote
  `git@github.com:sbtheg17-market/foot.git`.
- `origin/main`: `5f22526280ed8c31cf3d5f13f9d30d51a40177a7` — unchanged.
- `feat/rescheduling-enforcement`: `f8f6ba64447a79626fd0be0eba0cf956ee2066c2`
  — pushed; `origin/main` is its ancestor; NOT merged; NO PR exists
  (verified via the GitHub PR list; the newest PR is #25, merged).
- `feat/client-reschedule-ui`: `bf99bd2281e0b8081184d9030c4f107182d0c6a5`
  — pushed; STACKED (enforcement tip is its ancestor); NOT merged; NO PR.
- Full stacked diff re-inspected: enforcement adds 5 files (route
  enforcement, focused suite, one concurrency fixture, test script,
  continuity doc); the UI increment adds exactly
  `artifacts/web/src/components/ui/reschedule-modal.tsx`,
  `artifacts/web/src/pages/booking-detail.tsx`, and this continuity doc.
- `git diff --check` clean across the whole stack; targeted secret scan
  clean (only benign identifiers and the seeded demo password used by all
  integration suites).
- `conflict_210826_2128` untouched at `f82a81c…`; working tree clean.

### PR creation status — operator action required

PR creation is NOT POSSIBLE from this environment: GitHub pull requests can
only be created via the REST/GraphQL API or the web UI, this environment
authenticates by SSH deploy key only (git push/pull), no `gh` CLI or GitHub
token exists here, and accepting a token from chat is prohibited by the
session boundaries. Both branches are pushed and ready; the operator creates
the PRs with one click each:

1. FIRST — enforcement PR (base `main`, head `feat/rescheduling-enforcement`):
   https://github.com/sbtheg17-market/foot/compare/main...feat/rescheduling-enforcement
   Title: `feat: enforce safe rescheduling`
   Body: prepared in the session handoff (summary/validation/scope/known
   limitation as specified in the PR-preparation prompt).
2. SECOND — after the enforcement PR is MERGED: update this UI branch onto
   the new main (merge `origin/main` into `feat/client-reschedule-ui`, or
   rebase locally WITHOUT force-push only if the platform requires), verify
   the PR diff shows only the three UI-slice files above, then open:
   https://github.com/sbtheg17-market/foot/compare/main...feat/client-reschedule-ui
   Title: `feat: add client reschedule flow` (disclose the stacked history).
   NOTE: if the enforcement PR is squash-merged, a plain merge of updated
   main into this branch keeps history append-only (no force-push); GitHub
   will then show only the UI increment in the PR diff.

Required merge order remains: enforcement first, client UI second. Merging
is operator-authorized only; no merges were performed in this session.

### Status flags

- Managed database: never accessed. Analytics: deferred, unchanged.
- Deployment: none; not authorized. Ledger: unchanged.
- Conflict branches: all preserved and untouched.

## 2026-08-22 — Enforcement merged; UI branch aligned for its PR

- Enforcement PR #26 (`feat: enforce safe rescheduling`) was reviewed and
  squash-merged by the operator:
  https://github.com/sbtheg17-market/foot/pull/26
- Verified post-merge `origin/main`:
  `efade0e70415197ff0d5c7421dde8fb171890ca0`
  (`feat: enforce safe rescheduling (#26)`); enforcement content confirmed
  present on main.
- `feat/client-reschedule-ui` updated by MERGING the new main into it
  (merge commit `a4d8e0b56271f0c076788e435fd969dbc3700732`; append-only, no
  force-push, feature commits unmodified). The expected add/add conflict on
  this continuity file was resolved by keeping the branch's version — a
  verified strict superset of main's version (0 deletions).
- PR diff vs new main now contains EXACTLY the UI slice:
  `artifacts/web/src/components/ui/reschedule-modal.tsx`,
  `artifacts/web/src/pages/booking-detail.tsx`, and this continuity doc.
- Post-merge validation: workspace typecheck pass; web build pass;
  rescheduling regression 12/12 on local scratch PostgreSQL;
  `git diff --check` clean vs main; secret scan previously clean and no new
  code introduced by the merge.
- Ready for the operator: open the UI PR (base `main`, head
  `feat/client-reschedule-ui`) —
  https://github.com/sbtheg17-market/foot/compare/main...feat/client-reschedule-ui
  Title: `feat: add client reschedule flow`. Merge remains
  operator-authorized only.
- Boundaries held: no managed DB access, no analytics, no deployment, ledger
  unchanged, `conflict_210826_2128` and all conflict branches untouched.

## 2026-08-22 — Client reschedule slice CLOSED; verified baseline for the next session

- UI PR #27 (`Feat/client reschedule UI`) was reviewed and squash-merged by
  the operator: https://github.com/sbtheg17-market/foot/pull/27
- VERIFIED POST-MERGE AUTHORITATIVE `origin/main`:
  `e2066aac2f6b4de67b8f15fa3cad9a6d36f8f3b1`
  (`Feat/client reschedule UI (#27)`).
  Verified on main: `artifacts/web/src/components/ui/reschedule-modal.tsx`
  present, booking-detail reschedule section present, and this continuity
  document with its full dated history.
- Slice ledger, all verified merged into main:
  - Rescheduling enforcement — branch `feat/rescheduling-enforcement`
    (`f8f6ba64447a79626fd0be0eba0cf956ee2066c2`), PR #26, merged as
    `efade0e70415197ff0d5c7421dde8fb171890ca0`.
  - Client reschedule UI — branch `feat/client-reschedule-ui`
    (`18644c501d694717a4d0b84bf3ae1c4a20f41093`), PR #27, merged as
    `e2066aac2f6b4de67b8f15fa3cad9a6d36f8f3b1`.
  Both feature branches remain on the remote, unmodified, available for
  archival or deletion at the operator's discretion (no deletion performed).
- NEXT SESSION BASELINE: branch new work only from the verified
  `origin/main` @ `e2066aa…` (or newer, re-verified). The stacked-branch
  workaround is over; no stacking is needed for future slices.
- Next recommended slice: MOBILE (EXPO) RESCHEDULING — the web client can
  now reschedule while the mobile app (`artifacts/mobile/app/booking/[id].tsx`)
  still offers cancel only. The server enforcement is shared, so the mobile
  slice is UI-only: reuse the slots endpoint and `updateBookingStatus`
  contract, mirror the web eligibility rule (CONFIRMED bookings only), never
  reuse the old datetime, and keep the server authoritative.
- Known limitations carried forward: booking-detail page renders times in
  the browser/device timezone (pre-existing) while slot pickers use the
  marketplace timezone; cross-provider client-overlap policy unchanged;
  provider-facing reschedule UI not built.
- Statuses: managed DB never accessed; analytics deferred, migration
  unapplied; no deployment; ledger unchanged; `conflict_210826_2128` and all
  conflict branches preserved and untouched.

## 2026-08-22 — Mobile Expo rescheduling (this session)

### Baseline

- Verified `origin/main`: `e2066aac2f6b4de67b8f15fa3cad9a6d36f8f3b1`
  (PR #27 squash-merge; PRs #25/#26/#27 all confirmed merged).
- `docs/reschedule-closure-record` (`362b009…`): pushed, PR pending, NOT
  merged, left untouched. Its closure section is INCORPORATED into this
  branch's copy of this file (strict superset) so the two branches merge
  cleanly in either order without losing history.
- Branch `feat/mobile-reschedule` created from verified `origin/main` only.
- `conflict_210826_2128` and all conflict branches untouched.

### Implementation (mobile UI only; no server changes)

Changed files:

- `artifacts/mobile/components/reschedule-modal.tsx` (new) — formSheet modal
  following the app's existing modal conventions: 90-day horizontal date
  strip, REAL slots from the existing `GET /providers/:id/slots` endpoint
  (no free datetime entry — deliberately stricter than the legacy mobile
  create-booking form), marketplace-timezone labels, current appointment
  slot disabled and tagged "current" (old datetime never reusable, plus a
  submit-time equality guard), occupied slots disabled with clear visual
  state, submission disabled until a slot is chosen, duplicate-tap
  protection via the pending mutation state and a re-entry guard, loading
  and empty states, and friendly Alert-based recovery for overlap /
  duplicate / outside-availability / inactive-service / invalid-state /
  forbidden / generic errors (grid refresh + re-pick where recoverable;
  no PostgreSQL internals ever shown). Accessibility: roles, states,
  labels, ≥44pt touch targets, safe-area-aware footer.
- `artifacts/mobile/app/booking/[id].tsx` — "Reschedule appointment"
  primary action shown only for client CONFIRMED bookings with a known
  active service (hidden when eligibility cannot be determined; server
  remains the final authority); an explanatory note when the service is no
  longer offered; on success the duplicate status toast is suppressed and
  the booking refetches. Cancel, review, and provider actions unchanged.

No web, API, schema, migration, analytics, payment, ledger, or deployment
changes.

### Validation (local scratch PostgreSQL; Expo web export for browser checks)

- Mobile typecheck: pass. Expo web export (`expo export -p web`): pass.
  The repo's `mobile build` script targets a Replit/Expo Go deployment and
  requires a deployment domain env — unavailable here; reported honestly.
  No mobile unit-test framework exists in the repo.
- Browser verification of the exported mobile web bundle against the real
  local API (static server + /api proxy):
  confirmed booking shows Reschedule; requested (#12) and rescheduled (#17)
  bookings hide it; real slots load with timezone label and Saturday
  empty-state; occupied slots disabled; current slot disabled + "current"
  tag + accessible label; submit disabled before a pick and enabled after;
  happy path submitted a fresh real slot and the booking was verified
  rescheduled via the API; the action is gone from rescheduled bookings.
- Server rescheduling regression (shared contract): 12/12.
- Workspace typecheck pass; web build pass (web untouched);
  `git diff --check` clean; secret scan clean.

### Known limitations

- React Native Web's `Alert` is a no-op, so success/error alerts are
  native-only; this affects only the verification web export, not the
  shipped Expo app. In-browser happy-path confirmation was therefore
  verified via API state + reload instead of the alert.
- The date strip covers the next 90 days; appointments cannot be
  rescheduled to a later date from mobile (web's date input is unbounded).
- Pre-existing (not introduced here): hard deep-link reloads of the web
  export can show "Booking unavailable" before auth hydration; native
  in-app navigation is unaffected.
- Detail screens render times in the device timezone (pre-existing),
  while slot pickers use the marketplace timezone.

### Session output

- Branch: `feat/mobile-reschedule` (base `e2066aa…`).
- Commit: `feat: add mobile reschedule flow` — exact SHA in the final
  session handoff (single commit: modal, booking-detail wiring, this
  record).
- PR: not created automatically; branch pushed and stopped for review.
- Next recommended slice: provider-facing reschedule flow, or the
  booking-detail timezone display fix (marketplace-timezone rendering).

## 2026-08-22 — New-session baseline verification; mobile slice confirmed pushed (Path A)

### Previous session status

- The prior session implemented and pushed the mobile Expo reschedule flow
  and ended without creating a PR. Its closure summary survives in the
  history of the environment snapshot branch `conflict_220826_1342`
  (commit `c115259`, followed by auto-generated snapshot commits).

### Baseline verified this session

- Repository: `sbtheg17-market/foot` (SSH auth verified as `sbtheg17-market`).
- Authoritative `origin/main`:
  `e2066aac2f6b4de67b8f15fa3cad9a6d36f8f3b1`
  ("Feat/client reschedule UI (#27)").
- Merged milestones confirmed present on main:
  PR #25 (`5f22526` book-again), PR #26 (`efade0e` rescheduling
  enforcement), PR #27 (`e2066aa` client web rescheduling).
- Mobile branch: `feat/mobile-reschedule` @
  `8cfcefd4e719c487bc8f8d9c8598ec91227f7efb` — exactly one product commit
  (`feat: add mobile reschedule flow`) whose merge-base with main equals
  main itself (clean stack, no drift). Changed files:
  `artifacts/mobile/app/booking/[id].tsx`,
  `artifacts/mobile/components/reschedule-modal.tsx`,
  and this continuity document (3 files, +631).
- Highest PR ref on the remote is #27; no PR exists yet for
  `feat/mobile-reschedule`.

### Conflict branches

- New snapshot `conflict_220826_1342` @
  `16422ba0c505d6b008e89f2345ff050fe89563d4` — inspected read-only;
  it is an environment snapshot (578 files changed vs main, including
  workspace artifacts such as `test_reports/` and `test_result.md`),
  not a feature branch. Preserved and untouched; non-authoritative.
- Prior snapshot `conflict_210826_2128` @
  `f82a81cf35e131834aad705b64e13681a6c8d6c1` — preserved and untouched,
  as are all earlier `conflict_*` branches.

### Validation

- No product code changed this session; the prior session's validation
  evidence is REUSED as recorded in the section above (mobile typecheck,
  Expo web export, in-browser flow verification against the real local
  API, server rescheduling regression 12/12, workspace typecheck,
  web build).
- Re-run this session on the pushed branch: `git diff --check` clean;
  secret scan of the full branch diff clean (no credentials, database
  URIs, or production configuration).
- Working tree clean; no staged or untracked files.

### Session output

- Duplicate feature work avoided; no product code written.
- This dated section is the only change; committed as
  `docs: record mobile reschedule continuity` on
  `feat/mobile-reschedule` (appended commit; no amend, no force-push).
- Next recommended slice: open and review the
  `main...feat/mobile-reschedule` PR; after merge, provider-facing
  reschedule flow or the booking-detail marketplace-timezone display fix.

## 2026-08-22 — Marketplace-timezone display on booking detail (this session)

### Baseline

- Verified post-mobile-merge `origin/main`:
  `a8c009b2506db8a50fc439b512b90cc030275bb3`
  ("Feat/mobile reschedule (#28)" — squash merge of `feat/mobile-reschedule`).
- All prior milestones confirmed on main (PR #24–#28). Conflict branches
  (`conflict_220826_1342` @ `16422ba…`, `conflict_210826_2128` @ `f82a81c…`,
  and all earlier) preserved and untouched.
- Branch: `feat/marketplace-timezone-display`, based only on verified main.

### Problem and source of truth

- Booking-detail screens (web `booking-detail.tsx`, mobile `booking/[id].tsx`)
  formatted `scheduledAt` with device-timezone `toLocale*` calls, so a
  traveller could misread their visit time.
- Authoritative timezone source: the existing public endpoint
  `GET /providers/:id/availability` (already generated as
  `useGetProviderAvailability`), which returns the same
  `getMarketplaceTimezone()` value that drives slot generation — so the
  detail view now matches booking/reschedule slot times by construction.
  No API, schema, or server change was needed or made.

### Changes (exact files)

- `artifacts/web/src/pages/booking-detail.tsx` — timezone-aware
  `formatDate(value, timeZone?)` (adds `timeZone` + `timeZoneName: 'short'`
  abbreviation, e.g. "2:26 p.m. EDT"); fetches the provider's availability
  timezone; caption "Times shown in <IANA zone>"
  (`booking-timezone-label`); explicit fallback caption
  "Shown in your device's timezone" (`booking-timezone-fallback`) only when
  the timezone query definitively fails — never a silent fallback.
- `artifacts/mobile/app/booking/[id].tsx` — identical pattern with an
  accessible caption under the calendar row (same testIDs).
- This continuity document.

### Fallback behavior

- Timezone known → marketplace-timezone rendering with abbreviation + label.
- Timezone query failed → previous device-timezone rendering is preserved
  and explicitly labelled; no device-location guessing; no new policy.
- DST is handled by Intl's timezone-aware formatting (verified across the
  2026-03-08 spring-forward boundary and EDT/EST winter/summer instants).

### Validation (local scratch infrastructure only)

- No client unit-test framework exists in the repo (unchanged); focused
  verification was performed at runtime instead:
- Formatter check (node, exact option set): summer 18:30Z → "2:30 p.m. EDT",
  winter 18:30Z → "1:30 p.m. EST"; 06:59Z/07:00Z on 2026-03-08 →
  "1:59 a.m. EST"/"3:00 a.m. EDT"; missing tz → device time (fallback).
- Live local stack (scratch Postgres + seeded API, container device tz UTC,
  marketplace tz America/Toronto): web booking detail for the confirmed
  booking rendered "2:26 p.m. EDT" + "Times shown in America/Toronto"
  (device would show 6:26 p.m.); no fallback caption when tz present.
- Mobile Expo web export against the same live API via in-app navigation
  (login → Bookings → detail): same correct rendering and captions;
  Reschedule/Cancel actions intact.
- Workspace libs + web + mobile typecheck: pass. Web production build: pass.
  Expo web export: pass. `git diff --check`: clean. Secret scan: clean.
  Working tree contained only the intended files.
- Server rescheduling regression not rerun — no server code changed.

### Known limitations

- List/dashboard screens (web `bookings.tsx`, portal dashboard/bookings,
  mobile bookings tab) still render device-timezone times — intentionally
  out of this focused slice; candidate follow-up.
- The fallback caption depends on the availability query settling; during
  the brief loading window the time renders without an abbreviation.
- Pre-existing: hard deep-link reloads of the mobile web export show
  "Booking unavailable" before auth hydration (in-app navigation is fine).

### Session output

- Single commit `fix: display booking times in marketplace timezone` on
  `feat/marketplace-timezone-display`; exact SHAs in the final handoff.
- PR not created; branch pushed and stopped for review.
- Next recommended slice: marketplace-timezone rendering on booking list
  and portal screens, or the provider-facing reschedule flow.

## 2026-08-22 — Marketplace timezone across booking lists (this session)

### Baseline

- Verified `origin/main`: `a8c009b2506db8a50fc439b512b90cc030275bb3`
  ("Feat/mobile reschedule (#28)").
- Detail-page slice `feat/marketplace-timezone-display` @
  `5ebddeb40218240d2cfb191a00af388c00ac77f1` verified present on the remote
  but NOT yet merged into main. This slice is therefore based on verified
  main (not stacked); the two branches share no product files — only this
  continuity document overlaps, which may produce a trivial append-only
  merge conflict (resolution: keep both dated sections).
- Conflict branches (`conflict_220826_1342` @ `16422ba…`,
  `conflict_210826_2128` @ `f82a81c…`, and all earlier) preserved untouched.
- Branch: `feat/marketplace-timezone-lists`, based only on verified main.

### Surfaces audited and updated

- Updated (device-timezone rendering fixed):
  - web client bookings list (`artifacts/web/src/pages/bookings.tsx`);
  - provider portal dashboard "Next Up"
    (`artifacts/web/src/pages/portal/dashboard.tsx` — month/day box and
    time);
  - provider portal bookings list
    (`artifacts/web/src/pages/portal/bookings.tsx`);
  - mobile bookings tab (`artifacts/mobile/app/(tabs)/bookings.tsx`).
- New shared helper: `artifacts/web/src/lib/marketplace-time.ts`
  (`useMarketplaceTimezone` + `formatBookingDate/Time/DateTime`).
- Audited, intentionally NOT changed:
  - `portal/earnings-statement.tsx` — renders a date-only value in device
    timezone on a financial-statement surface; deferred for review (a date
    could shift near midnight; statement grouping is server-side);
  - mobile `provider/[id].tsx` booking creation composes `scheduledAt`
    from free-text date/time parsed in the DEVICE timezone (web booking
    modal submits the slot's ISO `start` directly) — pre-existing booking-
    creation behavior, out of this presentation slice; flagged for review
    as a likely correctness follow-up;
  - `provider/application-status.tsx` — application timestamps, not
    appointment times.

### Timezone source and multi-provider handling

- Source: existing public `GET /providers/:id/availability`
  (`useGetProviderAvailability`) — the same server
  `getMarketplaceTimezone()` engine as slots and the detail page.
- The marketplace timezone is a single global server value, so every
  booking's provider resolves the identical zone; one cached request per
  screen (react-query key `['booking-provider-availability', providerId]`,
  shared with the detail page) is per-booking correct with no N+1 and no
  API change.

### Loading and fallback behavior

- While the timezone resolves, list times show a neutral placeholder
  (skeleton on web, em dash on mobile) — an unlabeled converted time is
  never presented as authoritative.
- On definitive failure, times render in device timezone with an explicit
  "(device time)" label (testids `booking-*-device-time`); no guessing.
- Times include the zone abbreviation (e.g. "2:26 PM EDT") when the
  timezone is known; DST handled by Intl (no manual offsets).

### Validation (local scratch infrastructure only)

- Typecheck (libs, web, mobile): pass. Web production build: pass.
  Expo web export: pass.
- Formatter DST/date-shift check (node, exact option sets): summer EDT /
  winter EST correct; 2026-03-08 spring-forward boundary correct;
  2026-08-26T03:00Z renders as Tue, Aug 25 in America/Toronto.
- Live browser verification (scratch Postgres + seeded API; device tz UTC,
  marketplace tz America/Toronto; device would show 6:26 p.m.):
  - web client list: "Tue, Aug 25, 2026 at 02:26 p.m. EDT";
  - portal dashboard: day box "AUG 25", time "02:26 PM EDT";
  - portal bookings (Upcoming tab): "Tue, Aug 25, 2:26 PM EDT";
  - mobile bookings tab (Expo web export, in-app navigation):
    "Tue, Aug 25 at 02:26 p.m. EDT";
  - no "(device time)" caption anywhere while the timezone was available.
- `git diff --check` clean; secret scan clean; no client unit-test
  framework exists in the repo (unchanged) — verification was runtime-based.
- Server rescheduling regression not rerun — no server code changed.

### Known limitations

- The "(device time)" fallback and loading placeholder paths were
  code-reviewed and typechecked but not runtime-triggered (the live
  availability endpoint always returned the timezone).
- Booking-detail pages gain marketplace timezone only once
  `feat/marketplace-timezone-display` merges; until both merge, lists and
  detail may briefly disagree depending on merge order.
- Earnings statement and mobile booking-creation findings above are
  deferred for operator review.

### Session output

- Single commit `fix: show marketplace timezone in booking lists` on
  `feat/marketplace-timezone-lists`; exact SHAs in the final handoff.
- PR not created; branch pushed and stopped for review.
- Next recommended slice: merge/review both timezone branches, then the
  mobile booking-creation device-timezone fix or provider-facing
  rescheduling.

## 2026-08-22 — Mobile booking-creation marketplace-timezone slots (this session)

### Baseline

- Verified `origin/main`: `547d92c4ec388b85b0d7868dc4a88ac5bad4ca9a`
  ("fix: show marketplace timezone in booking lists (#30)"). Detail slice
  merged as #29 (`f760421`); squash trees verified byte-identical to the
  branch tips. All 10 dated continuity sections verified present on main.
- Conflict branches (`conflict_220826_1342` @ `16422ba…`,
  `conflict_210826_2128` @ `f82a81c…`, and all earlier) preserved untouched.
- Branch: `fix/mobile-booking-slot-timezone`, based only on verified main.

### Audit (performed before any change, per handoff instruction)

- Confirmed defect in `artifacts/mobile/app/provider/[id].tsx`: booking
  creation used free-text "Date (YYYY-MM-DD)" and "Time (HH:MM)" inputs and
  submitted `new Date(`${dateStr}T${timeStr}`).toISOString()` — an ISO-8601
  local-time string parsed in the DEVICE timezone, so any device outside the
  marketplace zone submitted the wrong instant. It also bypassed the slot
  engine entirely, inviting `outside_availability` rejections.
- Web booking (`booking-modal.tsx`) and mobile reschedule
  (`reschedule-modal.tsx`) already submit exact server slot ISO instants
  from `GET /providers/:id/slots` (generated hook `useGetProviderSlots`,
  already consumed by mobile). Conclusion: NO API or contract change
  required — the handoff's stop-for-review condition was not triggered.

### Changes (exact files)

- `artifacts/mobile/app/provider/[id].tsx` — BookingModal now mirrors the
  verified web/reschedule pattern: 90-day date strip, server slot grid
  (real slots only; unavailable slots disabled/struck), timezone caption
  "Times shown in <IANA zone>" (`booking-timezone-label`), loading and
  no-slots states, submit disabled until a slot is picked, and
  `scheduledAt: selectedSlot` (exact server ISO — no client parsing).
  Error recovery gains web parity: `provider_unavailable` /
  `outside_availability` clear the pick and refetch the grid; the strict
  Session-079 duplicate 409 contract (409 + numeric `bookingId`) keeps its
  approved notice verbatim. Address/city/postal/notes fields unchanged.
- This continuity document.

### Validation

- Workspace typecheck for the mobile app: pass (recorded below in the
  session log; rerun details in the PR body).
- `git diff --check` clean; targeted secret scan clean; single-file code
  diff plus this continuity append only.

### Session output

- Single commit `fix: book mobile appointments from marketplace slots` on
  `fix/mobile-booking-slot-timezone`; exact SHAs in the final handoff.
- PR not merged by Neo (operator retains merge); branch pushed for review.
- Next recommended slice: provider-facing rescheduling.

## 2026-08-22 — Provider-facing rescheduling in the web portal (this session)

### Baseline

- Verified `origin/main`: `60f235c80abec99f46a119305c9026769f3f78d4`
  ("fix: book mobile appointments from marketplace slots (#32)"). PR #31 was
  an accidental duplicate merge of the list branch — verified content no-op
  (empty diff vs #30); no action required. 11 dated sections verified.
- Conflict branches preserved untouched. Branch: `feat/provider-reschedule`,
  based only on verified main.

### Audit (performed before any change)

- Server already fully supports provider rescheduling — NO API or contract
  change required: state machine allows provider `confirmed → rescheduled`
  (with `scheduledAt`) and `rescheduled → confirmed | cancelled`; the
  rescheduling endpoint re-runs every safety rule (future instant, active
  service, availability fit, overlap, duplicates) under the provider lock,
  and already notifies the client on provider-initiated reschedules.
- Gap was web-portal UI only: bookings in `rescheduled` status were
  invisible (no tab — providers could not confirm client reschedule
  requests), and confirmed bookings had no reschedule action.
- Note: `rescheduled → rescheduled` is NOT allowed by the state machine, so
  no "propose another" action was added from the Reschedules tab (kept
  strictly within the existing contract).

### Changes (exact files)

- `artifacts/web/src/components/ui/reschedule-modal.tsx` — optional
  `perspective?: 'client' | 'provider'` prop (default `'client'`, existing
  client usage unchanged). Copy-only switch: success toast, duplicate-slot
  notice, summary line, footer note. Slot logic, safety handling, and
  testIDs untouched.
- `artifacts/web/src/pages/portal/bookings.tsx` — new "Reschedules" tab
  (status `rescheduled`) showing the proposed time with actions
  "Confirm new time" (`booking-<id>-confirm-reschedule`) and decline
  (`booking-<id>-decline-reschedule`, cancels with reason "Reschedule
  declined by provider"); "Reschedule" button on confirmed bookings
  (`booking-<id>-reschedule`) opening the shared modal with
  `perspective="provider"`; own services fetched once via the public
  services endpoint for the slot query; on success the page refetches and
  switches to the Reschedules tab. Deactivated-service path surfaces the
  same friendly explanation the server would return.
- This continuity document.

### Validation

- Workspace libs + web typecheck: pass. Web production build (vite): pass.
- `git diff --check` clean; targeted secret scan clean; diff contains only
  the two code files above plus this continuity append.
- Full-stack runtime verification not possible in this container (no
  Postgres); the slot modal reused here is the runtime-verified client one,
  and the status-transition buttons reuse the existing verified
  `handleStatusChange` path.

### Session output

- Single commit `feat: provider rescheduling in the web portal` on
  `feat/provider-reschedule`; exact SHAs in the final handoff.
- PR not merged by Neo (operator retains merge); branch pushed for review.
- Next recommended slice: mobile parity for provider reschedule visibility,
  or reminders/notifications review (operator's choice).

## 2026-08-22 — Mobile provider rescheduling parity (this session)

### Baseline

- Verified authoritative `origin/main`:
  `8cb08d5db76cd287e828dcaa1c0d6a45573e33ce` (`feat: provider
  rescheduling in the web portal (#34)`).
- Provider web rescheduling is merged in PR #34 at that exact main SHA;
  the web implementation was inspected and left unchanged.
- `docs/duplicate-pr-reconciliation` at `fff2def9fb8951fec5d3a41badcf629f13eaf3c9`
  remains docs-only, pending operator review, and untouched.
- `feat/mobile-provider-reschedule` was created from the verified main SHA.
  All `conflict_*` branches remain preserved and untouched.

### Implementation

Changed files:

- `artifacts/mobile/app/(tabs)/bookings.tsx` — provider-role booking tabs
  (`Requests`, `Reschedules`, `Upcoming`, `Past`, `Cancelled`), proposed-time
  cards, marketplace-timezone labels, loading/empty/error behavior, and
  confirm/decline controls for client-proposed reschedules. Provider access
  remains scoped by the existing role-aware `useListBookings` contract.
- `artifacts/mobile/app/booking/[id].tsx` — provider-aware booking detail with
  client context, provider confirmation/decline actions, and provider
  “Propose a new time” action using the existing shared real-slot modal and
  `confirmed → rescheduled` contract. Client detail behavior remains intact.
- This continuity document.

No API, schema, migration, generated client, web, deployment, database,
analytics, payments, ledger, notification contract, or conflict-branch changes
were made. The existing mobile `RescheduleModal` was reused; no duplicate
slot-selection component or new endpoint was introduced.

### Client visibility audit

- Existing client booking list/detail status rendering already includes
  `rescheduled` and marketplace-timezone appointment display.
- Existing client status feedback already announces provider-initiated
  reschedules after refresh, and the server's existing notification path remains
  unchanged.
- No client-side expansion was required.

### Validation

- Mobile typecheck: PASS.
- Expo iOS/Android static build: PASS.
- Expo web export: PASS.
- Workspace library typecheck: PASS.
- `git diff --check`: PASS.
- No mobile unit-test framework exists in the repository.
- Runtime booking validation was unavailable: the API workflow starts and
  builds, but no database-backed authenticated booking fixture was available;
  the preview showed the app shell and no bundle crash. No managed database was
  accessed.
- The unrelated mockup-sandbox workflow remains failed from its pre-existing
  missing-dependency startup attempt; it is outside this mobile slice.

### Session output

- Branch: `feat/mobile-provider-reschedule`, based only on verified
  `origin/main`.
- Commit and push performed once after final scope review; exact SHAs are
  recorded below after the commit.
- PR: not created.
- Merge: not authorized and not performed.
- Known limitation: native `Alert` feedback cannot be observed in React Native
  Web; the shipped Expo native path uses the existing alert convention.
- Next recommended slice: operator review of this pushed mobile branch before
  authorizing PR creation or merge.

## 2026-08-22 — Managed database release-gate audit

### Scope and verified baseline

This is a documentation-only audit for the roadmap item “Managed database
state requires a deliberate release gate.” No managed database was accessed,
no production SQL or DDL was run, no migration was applied, no backup or
restore was initiated, no deployment was performed, and no schema,
application, package, lockfile, or Replit metadata was changed.

- Repository: `sbtheg17-market/foot`
- Checkout: `/home/runner/workspace`
- Remote: `origin` points to `https://github.com/sbtheg17-market/foot`
- Authoritative `origin/main`:
  `8d96ebe560ef8c16943d3a1e301dc596bc72a691`
- Working tree: clean
- Conflict branches: 46 remote `origin/conflict_*` refs observed; all
  preserved and untouched

### Schema fingerprint and migration inventory

- **VERIFIED from repository evidence:** canonical Drizzle schema is
  `lib/db/src/schema/index.ts`, exporting modules under `lib/db/src/schema/`;
  `lib/db/drizzle.config.ts` points Drizzle at that barrel.
- **VERIFIED from repository evidence:** 17 schema modules and two frozen SQL
  artifacts exist. SHA-256 values:
  - `PREVENTED_BOOKING_RECORDS_V1.sql` =
    `138982a19c7427044dfea167ffdbbcc72e6647130cc565f1d23621aef70e29ce`
  - `PREVENTED_BOOKINGS_DAILY_V1.sql` =
    `c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876`
- **NOT VERIFIED:** no canonical schema manifest, committed whole-schema
  fingerprint, or drift-detecting fingerprint procedure was found.
- **VERIFIED from repository evidence:** no committed Drizzle migration
  directory or migration journal exists. `db:push` remains a developer
  command; the two frozen artifacts are the only committed migration
  artifacts.
- The records artifact is additive-only (one enum, one table, two indexes);
  the daily artifact is additive-only (one table with a CHECK and
  `UNIQUE NULLS NOT DISTINCT`). Both are single-transaction, no-DOWN,
  no-`IF NOT EXISTS` artifacts. Required order is records first, projection
  second.
- **NOT VERIFIED / BLOCKED:** current managed catalog, managed migration
  history, and managed match to these artifacts. Earlier ledger entries are
  historical evidence only and were not revalidated here.

Safe future fingerprint procedure: verify the intended commit with
`git rev-parse`, enumerate and hash sorted files under `lib/db/src/schema/`,
hash each frozen SQL artifact with `sha256sum`, and compare those values with
an authorized read-only managed catalog export. Never include credentials or
the raw `DATABASE_URL` in the input or report.

### Startup mutation and required indexes

- **VERIFIED:** `Procfile`, `nixpacks.toml`, and `railway.json` start with
  `pnpm run start`; build commands only build the web and API artifacts.
- **VERIFIED:** startup does not invoke `drizzle-kit push`, `drizzle-kit
  migrate`, or another schema mutation. Deployment startup is separated from
  schema change application.
- **VERIFIED in declarations, managed status NOT VERIFIED:**
  - `bookings_active_booking_unique_idx`: unique on
    `(client_id, provider_id, service_id, scheduled_at)` with predicate
    `status IN ('requested','confirmed','rescheduled')`;
  - `prevented_booking_records_correlation_unique_idx`: unique on
    `(correlation_id)`;
  - `prevented_booking_records_marketplace_provider_occurred_idx`: on
    `(marketplace_id, provider_id, occurred_at DESC NULLS LAST)`;
  - `prevented_bookings_daily_grain_unique`: `UNIQUE NULLS NOT DISTINCT` on
    `(marketplace_id, provider_id, service_id, day_utc)`.
- **NOT VERIFIED:** no dedicated provider-overlap or availability indexes and
  no separate foreign-key-support index inventory are documented; workload
  and managed catalog review are required before deciding whether more are
  needed.
- The active-booking index must be checked by full catalog definition,
  predicate, uniqueness, and validity, not by name alone. No index was
  created, altered, or dropped.

### Prevented-bookings projection

- **VERIFIED:** source declaration, frozen source artifact, replay tooling,
  projection declaration, frozen projection artifact, rebuild script, and
  rebuild runbook all exist.
- **VERIFIED:** `prevented_bookings_daily` is a rebuildable read-side
  aggregate sourced only from `prevented_booking_records`; it is not written
  by request paths or used for authorization.
- **NOT VERIFIED / BLOCKED:** current managed presence, row count, source
  sufficiency, and projection correctness require an authorized read-only
  managed check. No rebuild was run.
- Disposition: **repository-ready, but managed application and verification
  remain separately gated**. Neither artifact may be applied through blind
  `drizzle-kit push`.

### Backup, dry-run, application, verification, and rollback

- **NOT VERIFIED:** no backup owner/provider, frequency, retention, PITR,
  pre-migration backup confirmation, backup verification, restore-test
  procedure, RPO, or RTO was found.
- **RELEASE BLOCKER:** no restore-tested managed backup procedure is evidenced.
  Before any managed schema application, those ownership and recovery details
  must be recorded and a restore rehearsal completed.
- **VERIFIED:** projection and replay runbooks provide credential-free target
  fingerprints, read-only dry-run behavior, expected counts, input/artifact
  hashes, caps, abort conditions, idempotency, and no-retry rules.
- **PARTIALLY VERIFIED:** frozen SQL comments define hash verification,
  object-existence preflight, `ON_ERROR_STOP`, one transaction, and immediate
  catalog verification, but there is no generalized schema-migration dry-run
  command or canonical migration journal.
- Required controlled sequence:
  `preflight → backup confirmation → target identity confirmation →
  fingerprint confirmation → SQL/hash review → read-only dry-run →
  explicit operator approval → one controlled psql apply → immediate
  read-only verification → release decision`.
- **NOT VERIFIED:** named authorizer, captured output location, and an
  explicit incompatible-schema application stop condition are not consolidated
  into one release procedure.
- **VERIFIED from repository evidence:** post-apply checks are described
  across the artifacts and runbooks for tables, columns, constraints, indexes,
  enums, foreign keys, projection reconciliation, health, and migration
  outcome. None ran against the managed database in this audit.
- **PARTIALLY VERIFIED:** projection recovery is available through a
  transactional rebuild; replay is idempotent but treated as irreversible and
  requires fresh authorization after failure.
- **NOT VERIFIED / BLOCKED:** schema artifacts have no automated reversal and
  no restore-tested managed rollback procedure. Recovery is backup-restore or
  reviewed forward-fix, with ownership, downtime, and compatibility
  expectations still to be documented.

### Release-gate matrix

| Gate | Required evidence | Current status | Safe next action | Owner |
|---|---|---|---|---|
| Canonical schema fingerprint | Manifest and drift-detecting procedure | NOT VERIFIED | Establish a credential-free manifest procedure | Release engineer |
| Migration inventory | Complete ordered artifact/history list | Repository VERIFIED; managed history NOT VERIFIED | Reconcile with authorized read-only catalog/history evidence | DBA / release engineer |
| Managed schema match | Read-only catalog comparison | BLOCKED | Obtain separately authorized read-only verification | DBA |
| Active-booking unique index | Exact definition, predicate, uniqueness, validity | Declaration VERIFIED; managed NOT VERIFIED | Compare full catalog definition before any push | DBA |
| Required FKs/indexes | Catalog and workload-support evidence | NOT VERIFIED | Produce checklist and inspect read-only catalog | DBA |
| Prevented-bookings projection | Declaration, artifact, rebuild safety, disposition | Repository VERIFIED; managed NOT VERIFIED | Decide and authorize staging/managed application separately | Product owner / DBA |
| Pre-migration backup | Recovery point and restore evidence | NOT VERIFIED — blocker | Establish owner, retention, RPO/RTO, and restore test | DBA / platform owner |
| Dry-run | Read-only target-specific output and SQL review | PARTIALLY VERIFIED | Run only against approved staging/non-production target | Release engineer |
| Controlled migration approval | Named approval for exact hashes and target | NOT VERIFIED | Create one-run, no-retry approval record | Product owner / DBA |
| Post-migration verification | Catalog, data, health, invariant checks | NOT VERIFIED | Execute read-only checks immediately after approved apply | DBA / on-call |
| Rollback/restore test | Tested recovery and compatibility plan | NOT VERIFIED — blocker | Complete and record restore rehearsal | DBA / platform owner |
| Application compatibility | Startup health and schema compatibility | PARTIALLY VERIFIED | Run health/smoke checks against verified target | Application owner |
| Deployment readiness | Build/start config with no startup DDL | VERIFIED | Keep `pnpm run start`; never add schema push | Release engineer |

### Checks, blockers, and next action

- `git fetch origin --prune`, status, branch, remote, and `origin/main`:
  PASS.
- Read-only inspection of schema, artifacts, scripts, startup configuration,
  deployment notes, runbooks, and continuity history: PASS.
- Frozen SQL SHA-256 calculation: PASS.
- Managed database access: **NONE**.
- Production SQL/DDL, migration, seed, backup, restore, deployment, package
  installation, lockfile, workflow, schema, application, and Replit metadata
  changes: **NOT PERFORMED**.
- Deployment: **NOT PERFORMED / NOT AUTHORIZED**.
- Analytics: source/projection/replay preparation exists; managed projection
  state and current production analytics readiness are **NOT VERIFIED**.
- Launch blockers: restore-tested backup/recovery evidence and current
  authorized read-only managed catalog verification.
- Next safe operator action: establish recovery ownership/evidence, then
  perform the separately authorized read-only managed catalog comparison
  before any migration or deployment decision.

## 2026-08-22 — Release-gate documentation closure

The audit procedures are now published in the repository without changing
their unresolved operational status:

- `docs/managed-db-release-gate.md` defines local-scratch, staging, and
  managed-production boundaries; the repository fingerprint procedure;
  migration inventory; preflight; hash-reviewed dry-run; explicit approval;
  controlled application; verification; and abort conditions.
- `docs/backup-restore-runbook.md` defines provider-agnostic backup,
  point-in-time recovery, restore rehearsal, validation, incident, and
  evidence procedures. Backup owner, provider, retention, PITR, cadence, RPO,
  and RTO remain `TBD — operator/provider decision`.
- Frozen artifacts remain additive-only and have no automated DOWN. No
  rollback SQL was added. Recovery remains backup-restore or reviewed
  forward-fix; the daily projection can be rebuilt only under its existing
  separate authorization.
- Managed catalog status remains **NOT VERIFIED**. No managed database,
  production data, migration, backup, restore, or deployment was accessed or
  changed by this documentation work.

## 2026-08-22 — Final roadmap-item-3 baseline

This final audit was based on the verified current `origin/main`
`d3a6d7dbcf707b0173617d7a01f35f7501b5f2fa`. The repository-controlled schema
source fingerprint procedure produced aggregate SHA-256
`8e69085fda8280e511483990d6c24653831252fa0541de990d7288ca238024d8`.
This is an exact source-file fingerprint, not a semantic manifest and not
evidence of managed-production parity.

### Final release-gate matrix

| Gate | Evidence required | Current status | Blocker | Next action | Owner |
|---|---|---|---|---|---|
| Schema fingerprint | Approved commit, deterministic source fingerprint, semantic-manifest decision | Repository VERIFIED; semantic manifest NOT VERIFIED | No canonical semantic manifest; managed comparison unavailable | Review whether a deterministic semantic generator is warranted; otherwise retain source fingerprint limitation | Release engineer |
| Migration inventory | Every frozen artifact, order, dependencies, rollback, and managed history | Repository VERIFIED; managed history NOT VERIFIED | No committed migration journal and no managed catalog access | Reconcile against authorized read-only catalog evidence | DBA / release engineer |
| Managed target identity | Credential-free target fingerprint and environment class | BLOCKED / NOT VERIFIED | No approved target or read-only authorization | Identify target through protected operator process | DBA |
| Managed schema match | Read-only comparison of tables, columns, enums, constraints, FKs, indexes, and predicates | BLOCKED / NOT VERIFIED | Managed database access not authorized | Run one read-only transaction only after all prerequisites exist | DBA |
| Required indexes | Exact definitions, uniqueness, predicates, validity, and workload support | Repository VERIFIED; managed NOT VERIFIED | Catalog and query-plan evidence unavailable | Compare by full definition, not name | DBA |
| Active-booking unique index | Exact partial unique definition and validity | Repository VERIFIED; managed NOT VERIFIED | Managed catalog unavailable | Verify `bookings_active_booking_unique_idx` before any schema push | DBA |
| Prevented-bookings projection | Declaration, frozen artifact, source sufficiency, rebuild safety, disposition | Repository VERIFIED; managed NOT VERIFIED | No managed presence or source-data check | Decide separately whether staging/managed application is needed | Product owner / DBA |
| Backup | Recovery point, owner, provider, retention, PITR | BLOCKED | Backup evidence unavailable | Establish and attach provider evidence | DBA / platform owner |
| Restore test | Tested non-production restore and integrity result | BLOCKED | Restore rehearsal unavailable | Complete and record rehearsal before migration | DBA / platform owner |
| RPO | Approved and achievable recovery-point target | BLOCKED | Operator/provider decision missing | Set and evidence target | Platform owner |
| RTO | Approved and achievable recovery-time target | BLOCKED | Operator/provider decision missing | Set and evidence target | Platform owner |
| Dry-run | Exact artifact/hash, target, fingerprint, destructive scan, expected impact, abort conditions | PARTIALLY VERIFIED | No target-specific managed/staging execution | Perform only against approved non-production target | Release engineer |
| Controlled application approval | Exact target, artifact, hashes, backup, restore, dry-run, order, authorization | NOT AUTHORIZED | Multiple prerequisites absent | Create one-run approval record only after gates pass | Approver / DBA |
| Post-migration verification | Read-only catalog, health, invariant, projection, and compatibility checks | READY AS PROCEDURE; NOT RUN | No migration was authorized or applied | Execute immediately after a future approved apply | DBA / on-call |
| Rollback/restore | Tested restore or reviewed forward-fix with owner and compatibility plan | BLOCKED | No restore-tested evidence; frozen artifacts have no DOWN | Complete restore rehearsal; never invent DOWN SQL | DBA / incident commander |
| Application compatibility | Startup health, smoke checks, and schema compatibility | PARTIALLY VERIFIED | No verified managed target | Run checks against the identified target only | Application owner |
| Deployment readiness | Start command with no startup DDL | Repository VERIFIED | Production release not authorized | Preserve `pnpm run start`; do not add schema push | Release engineer |

### Final audit boundaries

- Managed database access: **NONE**.
- SQL/DDL, migration, replay, projection rebuild, seed, backup, restore, and
  deployment: **NONE**.
- Application, schema, migration, package, lockfile, workflow, Replit
  configuration, and production changes: **NONE**.
- Required outcome: **No migration applied.**
- Analytics remains deferred until managed projection state is separately
  verified. Ledger remains unchanged. Conflict branches remain preserved and
  untouched.

The next operator must resolve target identity, backup/restore evidence, and
read-only managed catalog authorization before any production migration
decision. Documentation does not authorize database access.

## 2026-08-22 — Notification reliability and client-overlap policy

Verified `origin/main` at `b31835222d4c06ed247105ee7812ffe8fb4f1569`. The
payments foundation is present in the repository history but is not included
in this branch, per scope.

### Notification audit and implementation

- Audited new-booking SSE, provider/client booking status push notifications,
  provider application notification persistence, provider unread behavior,
  Expo token registration, mobile permission handling, logout, and tap routing.
- Preserved the existing rule that delivery failure cannot roll back a
  successful booking transition.
- Added a bounded retry with aggregate redacted logging for push delivery.
- Booking push payloads now deep-link to `/booking/:id`; mobile handles cold
  starts and taps while the existing server authorization remains authoritative.
- Mobile token registration failures remain non-fatal, and registered tokens
  are best-effort removed on logout using the existing endpoint.
- Existing provider in-app unread persistence remains provider-only. No client
  notification persistence or new schema was added.
- Email and SMS remain deferred.

### Overlap policy

Current cross-provider client overlap behavior is unchanged and documented in
`docs/booking-overlap-policy.md`. The recommendation is to reject overlapping
active client appointments, but operator approval is still required before
changing booking or rescheduling behavior. No overlap enforcement, schema, or
migration was added.

### Validation and boundaries

API/mobile typechecks, API build, Railway deploy build, Expo static export,
focused booking state-machine tests, and `git diff --check` passed. The
rescheduling integration suite could not run because its expected local API
server was not running on port 8080. Managed database access, production
notifications, deployment, secrets, and Replit artifacts were none.

## 2026-08-22 — Payments foundation

Roadmap item 4 was addressed with a provider-neutral design and pure,
test-covered money/status primitives. No provider is selected; Stripe Connect
is documented as a recommendation only. No payment SDK, live checkout,
webhook route, financial side effect, schema/migration, ledger mutation,
database access, workflow, or deployment change was made.

The current invoice trigger and booking state machine remain unchanged.
Cancellation/no-show fees, refunds, payouts, taxes, supported currencies,
capture timing, and provider account requirements remain operator/business
decisions. Railway build/start/health configuration remains unchanged.

## 2026-08-22 — Service-area and rescheduling-history design slice

### Verified continuation state

- Repository: `sbtheg17-market/foot`.
- Authoritative base: current merged `origin/main`
  `fbe477413d18fea601908d7d6a7bcc7762f4598d`.
- Working branch: `feat/service-area-rescheduling-history`.
- No conflict branch was used; no unrelated product changes were made.

### Design outcome

- Added `docs/service-area-travel-policy.md` for roadmap item 7. It compares
  postal allowlists, radius, polygon/geofence, city/region, and hybrid models;
  recommends a city/region model with optional postal refinement pending
  approval; and covers address handling, privacy, travel feasibility, buffers,
  operating constraints, outages, future schema, and tests.
- Added `docs/rescheduling-history-design.md` for roadmap item 8. It compares
  append-only events, request-plus-history, generic audit, and hybrid models;
  recommends request-plus-history only if proposal semantics are approved,
  otherwise an append-only accepted-event record; and covers entities, fields,
  nullability, indexes, keys, lifecycle, concurrency, API, authorization,
  privacy, retention, notification linkage, and tests.
- All recommendations remain approval-gated. The current descriptive travel-zone
  behavior and existing rescheduling enforcement remain unchanged.

### Explicit boundaries

Runtime behavior: unchanged.
Service-area enforcement: not implemented.
Travel-buffer enforcement: not implemented.
Rescheduling persistence: not implemented.
Schema/migrations: none.
API contracts: unchanged.
Managed database, geocoding, routing, payment, notification-provider, and
production access: none.

## 2026-08-23 — Rescheduling policy finalization and test-coverage matrix

### Verified continuation state

- Repository: `sbtheg17-market/foot`; checkout at `/app`.
- Authoritative base: `origin/main` at
  `75396f2d997668666135f35243899c7705a9aa86` (local `main` identical; clean tree;
  PRs #1–#40 present; no `conflict_*` branch used).
- Working branch: `feat/rescheduling-policy-test-matrix` (new, from `main`).

### Current rescheduling behavior (audited from code)

- `PATCH /api/bookings/:bookingId/status` with `status: "rescheduled"` +
  `scheduledAt` applies the new time **immediately and atomically** for BOTH
  client- and provider-initiated changes (row lock + provider advisory lock
  42001; future-instant, active-service, marketplace-timezone availability,
  same-client duplicate, and cross-client overlap validation; partial unique
  index as race safety net).
- **Provider-initiated changes do not require client confirmation** — the
  confirmed time is overwritten and the provider can self-reconfirm
  (`rescheduled → confirmed` is provider-only). No proposal/pending state,
  no decline verb, no history retention, no reminders/deadlines, no
  reschedule-count limit. Notifications are best-effort push after commit.
- Full detail with exact paths and state names: `docs/rescheduling-policy.md`.

### Proposed final policy (recommended, approval-gated)

- Appointment-time ownership: the time belongs to the booking; a time becomes
  authoritative only after the required workflow transition succeeds.
- Provider proposals should require client confirmation (retain original time,
  pending proposal, deadline, reminder, no auto-accept, safe fallback) — needs
  the not-yet-implemented proposal state from
  `docs/rescheduling-history-design.md`; NOT added this session.
- Client non-response: reminder, no automatic acceptance, preserve original if
  feasible, else support; never silent cancel/move.
- Multiple reschedules allowed with full re-validation and a communicated
  limit; client may counter a provider proposal; role-aware cancellation with
  client-friendly path for provider-caused changes; refunds/fees deferred to
  payments; no-show taxonomy (client/provider/disputed/access/travel) defined
  but consequences unresolved. Decision table: `docs/rescheduling-policy.md`
  Part 4 — **no item is marked Approved**.

### Unresolved operator decisions

Proposal-state adoption and deadline value; reminder scheduling; reschedule
count limit; no-show consequences; refund/fee schedule (blocked on payments);
availability-edit conflict flagging; admin-override auditing.

### Test coverage audit

- Only framework: Node built-in `node --test` + tsx (API; 28 suites under
  `artifacts/api-server/src/__tests__/`). Web and mobile have typecheck only —
  **zero web/mobile tests**. No Playwright/Vitest/Jest/Detox/Maestro, no
  `eas.json`, and **no CI workflow exists** (`.github/` absent).
- Full matrix, proposed 5-stage CI/release pipeline (static → API+disposable
  PG → web → mobile → release gate), and smallest-stack recommendation
  (keep node:test for API; Vitest+RTL for web and jest-expo+RNTL for mobile
  pending approval — NOT installed): `docs/test-coverage-matrix.md`.
- Native-device verification: NEVER performed; Expo web/static export is not
  native validation; exact future device checklist documented in §5.

### Files changed

- `docs/rescheduling-policy.md` (new)
- `docs/test-coverage-matrix.md` (new)
- `docs/neo/2026-08-21-client-retention-handoff.md` (this entry)

### Validation

- `pnpm install --frozen-lockfile`; `pnpm run build` (typecheck libs/api/web +
  web/api builds) green; mobile typecheck green.
- Disposable local PostgreSQL created in this workspace; `db:push` + idempotent
  seed applied; built server started on `PORT=8001`; `/api/healthz` → ok.
- Tests green against the live local server: state-machine unit 63/63;
  `test:rescheduling` 12/12; `test:integration` (concurrency) 16/16;
  `test:availability` 3/3; `test:pressure` 13/13 — 107/107. Remaining
  integration suites unaffected by this docs-only diff and not run.
- `git diff --check` clean; targeted secret scan of changed files clean.

### Boundaries

Runtime booking/rescheduling behavior: unchanged (no defect found — code
matches `docs/booking-statuses.md`). Schema/migrations: none. API contracts:
unchanged. Managed database access: none. Deployment: none. Live
notifications: none. Payments and service-area/travel enforcement: excluded.
Commit: single docs commit on `feat/rescheduling-policy-test-matrix` (this
entry ships inside it; the pushed branch head is its SHA). PR: not opened —
awaiting operator review. Next operator approvals: final rescheduling policy
(Part 4 table) and test-matrix scope before any runtime or migration change.

---

## 2026-08-23 — Session: consent-first rescheduling implemented (roadmap item 9)

### What happened

- The uncommitted item-9 implementation produced in the previous workspace was
  recovered intact (38-file staged diff, base `a80b031`), audited file-by-file,
  and re-applied onto a FRESH branch `feat/rescheduling-consent-workflow` cut
  from the current `origin/main` (`fd3c6b6`, the squash-merged docs PR #43).
  A stray `.env.example` deletion present in the recovered diff was rejected;
  the file is preserved byte-identical to `origin/main`. No other recovered
  content was dropped. Duplicate work avoided: nothing was re-implemented.

### Implemented (see docs/rescheduling-policy.md "Implementation record")

- Provider time changes are now consent-first proposals; the client's confirmed
  time is never overwritten without acceptance. Client immediate reschedule is
  retained. Accept applies time + append-only history row + proposal resolution
  in one transaction. Lazy expiry (`expired`/`unresolved`), no auto-accept,
  no silent moves. Deadline fallback: appt−48h else creation+24h (capped at the
  appointment). Provider proposal limit: 3 (configurable, never hidden).
  Idempotency `(requester, key)`; single pending proposal per booking (partial
  unique index); booking-row → proposal-row lock order; best-effort push after
  commit with coarse outcome recording.
- New: `lib/db/src/schema/reschedule.ts`,
  `docs/migrations/RESCHEDULE_PROPOSALS_HISTORY_V1.sql` (ADDITIVE ONLY),
  `routes/reschedule.ts`, `lib/reschedule-policy.ts`, web + mobile
  `reschedule-proposal-card.tsx`, OpenAPI + regenerated zod/react clients,
  suites `reschedule-policy.test.ts` + `reschedule-proposals.integration.test.ts`
  (`test:proposals`).
- Changed: state machine (provider `confirmed → rescheduled` removed), status
  route (consent-required 409, history writes, pending-proposal resolution on
  any transition away from `confirmed`), reschedule modals (provider path now
  creates proposals), booking detail pages (proposal card + history timeline).

### Validation (disposable local PostgreSQL 15 ONLY; no managed DB)

- `pnpm run typecheck` green (libs, api, web, mobile, scripts).
- `pnpm run build:deploy` green. `git diff --check` clean. Secret scan clean.
- `db:push` applied additively (2 enums, 2 tables, 4 indexes verified in psql);
  seed run twice — idempotent.
- Built server on local `PORT=18080` (8001/8010 occupied in this workspace):
  `pnpm test` 70/70; `test:proposals` 17/17; all 22 scripted `test:*` suites
  pass; unscripted suites pass except the known Session-080 changed-file-scope
  guard in `prevented-bookings-daily-rebuild.test.ts` (25/26 — fails by design
  on any feature branch; not a behavior regression).
- NOT validated: native devices (never), reminder delivery (not implemented),
  CI (does not exist yet — item 10).

### Boundaries

Managed DB: none. Deploy: none. Payments/service-area/notification
persistence/email/SMS: untouched. No force-push, no push to main, no PR created
programmatically (operator will open + squash-merge the PR manually).

### Next best action

Operator: review + squash-merge PR for `feat/rescheduling-consent-workflow`
(title: `feat: implement approved rescheduling consent workflow`). Then item 10
branch `test/web-mobile-ci-matrix` from the updated main: GitHub Actions matrix
(static/API+disposable-PG/web Vitest+RTL/mobile typecheck+deterministic Expo
exports), per operator decisions of 2026-08-23 (no jest-expo/RNTL).

## 2026-08-24 — Session: web/mobile/API coverage and CI matrix (roadmap item 10)

### Baseline

- Repository: `sbtheg17-market/foot` (SSH remote re-pointed to
  `git@github.com:sbtheg17-market/foot.git`; auth verified as
  `sbtheg17-market`). Checkout `/app`; working tree clean at start.
- Verified `origin/main`: `a911d2248b46b6f7ecd9945165d2b379acb69b99`
  ("feat: implement approved rescheduling consent workflow (#45)") — item 9
  merged; its implementation was NOT reworked. Items 1–9 intact.
- Branch: `test/web-mobile-ci-matrix`, cut from that main SHA (did not exist
  before this session). No `conflict_*` branch used; all preserved untouched.

### Implemented (test infrastructure only)

- `.github/workflows/ci.yml` — first CI workflow in the repository
  (pull_request + push to main), 15 deterministic jobs: `typecheck`,
  `api-build`, `deploy-build` (Railway parity), `api-tests` (disposable
  postgres:15 service container; db:push; seed ×2; built server; health; unit
  + 16 scripted integration suites + 6 unscripted suites; the daily-rebuild
  suite runs as a labeled NON-GATING step because its Session-080
  changed-file-scope guard fails by design off main — guard preserved, not
  weakened), `authz-concurrency` (authorization, concurrency, pressure,
  rescheduling enforcement, consent proposals), `migration-checks` (fresh
  push, idempotent re-push, seed ×2, frozen-artifact hash + no-destructive-DDL
  check, startup after migration), `web-tests`, `accessibility`,
  `timezone-dst`, `mobile-typecheck`, `expo-export-ios`, `expo-export-android`
  (both labeled NOT native validation), `smoke` (healthz 200, seeded login
  200, six critical booking/reschedule routes registered → 401 never 404, SPA
  served, artifacts exist), `secret-scan`, `git-diff-check`. No job deploys,
  needs production secrets, or touches a managed database.
- Web test layer (first in the repo, per §4 of the coverage matrix and the
  2026-08-23 operator decision): Vitest 4 + @testing-library/react 16 +
  jsdom 26 (30 is incompatible with Node 20) + axe-core, dev-only in
  `artifacts/web`. 60 tests across 5 files: `booking-modal.test.tsx`,
  `reschedule-modal.test.tsx` (client flow + provider consent-first proposal,
  loading/empty/error/403/409 recovery, duplicate-submit protection,
  idempotency key), `reschedule-proposal-card.test.tsx` (accept/decline,
  stale-accept 409 race, feasible/infeasible decline, read-only provider
  view, history), `marketplace-time.test.ts` (EDT/EST, 2026-03-08
  spring-forward, 2026-11-01 fall-back repeated wall clock, date boundary,
  labeled device fallback), `use-marketplace-timezone.test.tsx`
  (idle/loading/ready/unavailable). Accessibility: labeled dialog, focus
  entry, Escape incl. mid-submit lockout, aria-pressed, non-color "current"
  marking, labeled regions, axe scans (color-contrast off — jsdom cannot
  compute it).
- Minimal product change REQUIRED by failing axe tests (allowed by the session
  scope): `booking-modal.tsx` close button gained `aria-label` +
  `type="button"` + `aria-hidden` icon; the date input gained a
  `htmlFor`/`id` label association. No behavior change; reschedule modal was
  already compliant.
- Mobile (approved lighter path, no jest-expo/RNTL): `export:ios` /
  `export:android` scripts (deterministic Expo static export). Root
  `pnpm test` added (recursive `test`: pure API unit suite + web suite).
- `scripts/secret-scan.sh`: dependency-free deny-list scan (tokens, private
  keys, signed JWTs, non-local DB passwords; local scratch and documented
  redaction-test fixture hosts allowed) — used locally and in CI.
- Docs: `docs/test-coverage-matrix.md` §8 addendum (implemented matrix),
  `docs/native-device-checklist.md` (manual native checks: simulators,
  physical devices, native alerts, notification taps, cold start,
  permissions, token lifecycle, device timezones, deep links),
  `docs/TODO-LEDGER.md` created as the consolidated authoritative ledger (no
  single ledger file existed; deferred items preserved from their source
  documents, plus item-10 follow-ups).

### Validation (disposable local PostgreSQL 15 ONLY; no managed DB)

- `pnpm run typecheck` PASS (libs, api, web incl. new test files, mobile,
  scripts). `pnpm run build` / `pnpm run build:deploy` PASS.
  `pnpm test` (new root script) PASS: API unit 70/70 + web 60/60.
- All 22 scripted API `test:*` suites PASS against a seeded scratch DB +
  built server on PORT=18080 — 295/295 tests (incl. authorization 7/7,
  concurrency 16/16, pressure 13/13, rescheduling 12/12, proposals 17/17,
  lifecycle 14/14). Seed run twice — idempotent. db:push re-run — no-op.
- Unscripted suites: 71/71 PASS on a FRESH DB. Environment fact recorded in
  the ledger: the replay suite's DLQ subtests are single-run-safe only
  (fixed slot-pool positions persist as bookings; a re-run on the same DB
  409s). Daily-rebuild suite 25/26 — the changed-file-scope guard fails BY
  DESIGN on this feature branch (known repository guard; reported, not
  weakened, non-gating in CI).
- Web: 60/60 PASS; `test:a11y` 10/10; `test:tz` 10/10.
- Mobile typecheck PASS. Expo iOS + Android exports PASS locally with
  `--no-bytecode` (this container is arm64; the x86_64 `hermesc` binary
  cannot run — the plain export scripts run fully, with bytecode, on x86_64
  CI runners). BLOCKED locally, honest per the checklist: no simulator,
  emulator, or physical device exists in this environment — NATIVE-DEVICE
  BEHAVIOR REMAINS UNVERIFIED and is not claimed by any CI job.
- Smoke matrix verified locally: healthz 200, seeded login 200, six critical
  booking/reschedule routes → 401 (registered, never 404), SPA 200.
- `bash scripts/secret-scan.sh` PASS. `git diff --check` PASS (fixed one
  blank-line-at-EOF it caught in the new docs).
- GitHub Actions execution itself: PENDING first run on the PR (no workflow
  existed before this branch); results recorded in the PR.

### Boundaries

No booking/rescheduling behavior, state machine, or policy change; no
provider-proposal or history change; no service-area/travel change; no
reminders; no notification persistence; no email/SMS; no payments; no
production migration; no managed DB access; no deployment; no force-push;
no Replit artifacts; no credentials. Product diff limited to the two
axe-required accessibility attributes in `booking-modal.tsx`.

### Session output

- Implementation commit: `78ac7b5911213e5bd381707a8c3c6bf4379119f7`
  (`test: establish web mobile and CI coverage`, 16 files).
- Docs commit (`docs: update test matrix and deferred TODO ledger`) follows
  it with this record; exact SHA and PR URL in the final session handoff.
- PR `main...test/web-mobile-ci-matrix` created and squash-merged in-session
  per the operator's explicit item-10 merge authorization.
- Next operator: review the merged CI runs on main; schedule deferred work
  from `docs/TODO-LEDGER.md` (native device lab, real notification delivery,
  Playwright browser smoke, reminders, payments, service-area enforcement,
  managed-DB gate).

### Addendum — first GitHub Actions runs on PR #46 (same session)

- First run (head `681c45b…`): 13/15 jobs green immediately (both Expo
  exports, web, accessibility, timezone/DST, smoke, migration checks,
  authz-concurrency, secret scan, git diff --check, builds, full typecheck).
  Two honest failures, both test-infrastructure, fixed in-session:
  1. `mobile-typecheck` — the standalone package typecheck needs the lib
     project references built first; the job now runs
     `pnpm run typecheck:libs` before it
     (`test: build lib project references before the mobile typecheck CI job`,
     `1a0713685061a3d27b09d736524dc99bfc2855de`).
  2. `api-tests` — `prevented-booking-replay.integration.test.ts` DLQ
     subtests failed with duplicate 409s: they consume fixed seeded
     slot-pool positions, and earlier booking suites in the same job had
     already booked those instants. Verified locally: the file passes 14/14
     standalone against a fresh scratch DB with no other suite run first.
     The suite now has a dedicated CI job (`api-replay-tests`) with its own
     disposable database; nothing was weakened or skipped — all 14 tests
     remain gating. Ledger and matrix updated accordingly.
- Final workflow: 16 jobs. Merge performed only after all gating jobs were
  green on the final head; exact head SHA and merge SHA in the final
  handoff.

## 2026-08-24 — Session: pre-#11 release-readiness gate (verification only)

### Baseline and repair

- Verified `origin/main` = `17b1bf9589f9665630346af3a85d110debcd170a`
  (PR #46 squash). Local checkout had ONE local-only commit (`a7e0ec2…`)
  auto-created by the Emergent platform after the item-10 session; it tracked
  only the external harness file `test_reports/iteration_1.json`. Repaired
  with a plain `git reset --mixed origin/main` (not a force-push; nothing was
  ever pushed) — local `main` again equals `origin/main`, tree clean.
- Branch for this gate: `chore/pre-11-release-readiness` from that main.

### Audits performed

- **Merged-work verification (#1–#10):** #9 (routes/reschedule.ts, consent
  guard, policy constants, proposal cards web+mobile, additive
  `RESCHEDULE_PROPOSALS_HISTORY_V1.sql`) and #10 (ci.yml, web test layer,
  ledger, checklist, secret scan) confirmed present on `main` via git history
  and file inspection — not documentation claims.
- **Branch/PR audit:** 97 remote branches; all 46 closed PRs are MERGED (no
  closed-unmerged PRs across the full list); exactly ONE open PR — #2
  ("docs: record Session 068 publication verification", 2026-08-11,
  `.agents/LOG.md` + `.agents/NEXT_TASK.md`), whose NEXT_TASK payload is long
  superseded; recorded in the ledger with a recommendation to close without
  merge (operator decision; nothing deleted, nothing merged). All 47
  `conflict_*` branches untouched. Feature branches with commits "not in
  main" are pre-squash originals of merged PRs — no unmerged valuable work
  found.
- **File/artifact audit:** no tracked secrets (deny-list scan clean;
  `.env.example` is keys-only), no `.env` files, no conflict markers,
  `git diff --check` clean, executable bits only on the three shell scripts.
  Replit artifacts (`.replit`, `replit.md`, `.replit-artifact/`,
  `attached_assets/`, `nixpacks.toml`) are HISTORICAL tracked files from the
  original build — none added, none removed.
- **CI verification:** `ci.yml` parses (16 jobs, no `if:` conditions, no
  silent skips); all 16 jobs green on `main` `17b1bf9`; no production
  secrets/deploys/managed-DB usage; the single non-gating step
  (daily-rebuild) is labeled in-file and in §8 of the matrix.

### Defect found and fixed (test-only file hygiene)

The API server writes its DLQ to `artifacts/api-server/var/…` at runtime
(`prevented-booking-events.ts`, `DEFAULT_DLQ_PATH`). The directory was
untracked AND unignored, so any server run tripped the Session-080
changed-file-scope guard (`prevented-bookings-daily-rebuild.test.ts` reported
`unauthorized changed file: artifacts/api-server/var/`) even on a clean
`main` checkout — the guard's only failure at this gate. Fix: gitignore
`artifacts/api-server/var/` (runtime output) and `/test_reports/` (external
agent-harness reports, the same class that produced the stray local commit
above). No runtime behavior changed. `git check-ignore` verified.

### Validation (disposable local PostgreSQL 15 ONLY)

typecheck / build / build:deploy / root `pnpm test` PASS; 22 scripted API
suites 295/295; unscripted 71/71 (replay 14/14 on its own fresh DB);
smoke matrix (healthz 200, seeded login 200, six critical routes → 401,
SPA 200) PASS; db:push ×2 + seed ×2 idempotent; web 60/60, a11y 10/10,
tz-DST 10/10; Expo iOS+Android exports PASS via `--no-bytecode` (arm64
host; CI x86_64 runs full exports); secret scan PASS; `git diff --check`
PASS. #9 policy values in code confirmed to match the policy document
(deadline appointment−48h / now+24h clamp; limit 3 via
`RESCHEDULE_PROPOSAL_LIMIT`; lazy expiry; reminders NOT implemented).
Native devices: still NEVER verified. Browser E2E: still not implemented.

### Documentation truth reconciliation (append-only notes; history preserved)

- `README.md`: verification-commands section rewritten to the current
  commands; CI paragraph added; pnpm version corrected to the pinned 10.18.3.
- `docs/NEXT-STEPS.md`, `docs/test-coverage-matrix.md` (header),
  `docs/PRD.md`, `replit.md`: dated current-status banners marking historical
  sections as historical (stale "no CI", "92/95 tests", "provider-only"
  claims superseded).
- `docs/rescheduling-policy.md`: merge record appended (#44/#45 → `a911d22`,
  CI coverage since #46) — the doc previously said only "implemented on
  feat/rescheduling-consent-workflow".
- `docs/TODO-LEDGER.md`: pre-#11 review section — per-item status / why /
  files / dependencies / next action / completion criteria / owner / last
  reviewed for every deferred item, plus CI-badge item, environment
  limitations, the `var/` hygiene fix, and the PR #2 disposition.
- `docs/pre-11-release-readiness.md`: NEW — full gate report and verdict
  (internal demo: SUITABLE; controlled provider pilot: NOT YET — managed-DB
  gate + deployment authorization + native-device pass required; paid
  pilot/public launch/financial operation: NOT SUITABLE).

### Boundaries

No product behavior, state machine, policy, schema, notification, payment,
service-area, or deployment change. No managed DB access. No production
credentials. Roadmap #11 NOT started. Exact commit/PR/merge SHAs in the
final session handoff.

## 2026-08-25 — Session: provider public booking pages (roadmap #11)

### Baseline and scope

- Verified `origin/main` = `e8f0f34b846c11d470f23102af430cda8b25504d`
  (pre-#11 gate), clean tree. Recovery audit first: NO #11 draft work in any
  Git ref (all feat/docs/test branches map to merged PRs #22–#46; conflict_*
  snapshots preserved untouched) and none in the prior preview workspace
  (only a staged `.env.example` deletion — rejected as a local/env artifact).
- Roadmap #11 was then explicitly defined and authorized by the operator:
  provider-owned public booking pages and shareable conversion links, with
  policy defaults (slug format/uniqueness/immutability, unpublished default,
  public-data boundaries, allowlisted attribution, QR from canonical URL).
- Branch: `feat/provider-public-booking-pages` from that main.

### What was implemented

- Schema (additive only): `provider_profiles.public_slug` (unique index),
  `booking_page_published` (default false), `booking_page_published_at`;
  `bookings.source` (nullable). Frozen artifact
  `docs/migrations/PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql` (no destructive DDL,
  no DOWN by policy). `db:push` + seed verified idempotent (×2) on disposable
  local PostgreSQL 15 only.
- API: public `GET /booking-pages/:slug` (approved + published only; identical
  generic 404 for missing/unpublished/unapproved/format-invalid — validated
  before any DB work; public-safe allow-list projection with NO user/account
  ids); owner `GET /providers/me/booking-page`,
  `POST /providers/me/booking-page/publish` (approved-only, idempotent,
  kebab-case slug from display name, deterministic collision suffix,
  unique-race retry), `POST /providers/me/booking-page/unpublish`
  (owner-scoped, idempotent, slug retained). `POST /bookings` accepts optional
  allowlisted `source` (unknown values dropped, never an error). OpenAPI
  updated; orval client + zod regenerated.
- Web: `/book/:slug` public page (loading/error/generic-not-found states,
  service selection, weekly availability + marketplace timezone, reviews via
  the existing public endpoint, booking through the SAME BookingModal +
  slots/bookings endpoints — no duplicated booking logic; allowlisted
  `?source=` forwarded); dashboard `BookingPageCard` on
  `/provider/listing-preview` (publish/unpublish, copy, native share, preview,
  QR generate/download encoding canonical URL + `source=qr-card`; honest
  no-acquisition-promise copy). New dependency: `qrcode` (web only).
- Marketplace discovery unchanged at `/providers`; `/providers/:id` public
  listing target preserved.

### Validation (disposable local PostgreSQL 15; nothing managed touched)

- New API suite `test:booking-page`: 17/17 PASS (slug validation/collision/
  immutability, publish/unpublish authorization + idempotence, non-leak 404
  contract incl. defense-in-depth for unapproved-but-flagged rows, payload
  redaction, active-services-only, booking-from-page with attribution stored,
  unknown attribution dropped, availability enforcement intact, owner scoping).
- Web Vitest: 77/77 PASS (60 existing + 17 new incl. axe accessibility on the
  public page and dashboard card, source allowlist, QR URL correctness).
- Regressions: API unit 70/70; lifecycle 14/14; availability 3/3; concurrency
  16/16; first-booking 8/8; rescheduling 12/12; proposals 17/17;
  client-retention 8/8; pressure 13/13; authorization 7/7.
- `pnpm run typecheck` / `build` / `build:deploy` PASS; secret scan clean;
  `git diff --check` clean. Live smoke on the built server: publish → public
  JSON 200 → SPA `/book/:slug` 200 → generic 404 for unknown slug; visual
  check of the public page (mobile viewport) and dashboard card (QR render).
- CI job list updated (`test:booking-page` added to api-tests). Replay/DLQ and
  Session-080 scope-guard suites not run locally by design (dedicated CI
  environments; documented in the ledger).

### Boundaries held

- No managed database access; no production deployment; no payments, refunds,
  reminders, notification persistence, email/SMS, service-area enforcement,
  marketplace ranking, referral payouts, or fake inventory/reviews. No
  force-push; no branch deletion; conflict_* branches untouched. Booking,
  availability, authorization, consent-rescheduling, and concurrency
  protections unchanged (regression-verified).

## 2026-08-26 — Session: service-area + travel-buffer completion (roadmap #12)

### Recovery audit first (no duplicated work)

- Baseline `origin/main` = `a0083e7e1492108c10451444eace65d492fadc25`
  ("feat: enforce provider service areas and travel buffers (#49)"), local
  checkout equal, clean tree.
- **PR #49 was found MERGED** (squash `a0083e7`, 2026-08-25) — the handoff
  premise "closed, not merged" was stale. `git diff
  origin/feat/service-area-travel-enforcement origin/main` is EMPTY: main
  already contains the entire feature branch tree (efda40e).
- `recovery/roadmap-12-prior-session` (`d76ff46`, 2026-08-25 20:35) is a
  strictly OLDER snapshot: its only delta vs main is the ABSENCE of the
  `reason` passthrough on reschedule 409s that the later feature commit
  (`efda40e`, 22:41) added. Nothing unique to recover — superseded; branch
  preserved untouched.
- `conflict_250826_1608` inspected read-only: unrelated history (no merge
  base; Replit auto-snapshot, 83 files, ZERO #12-scoped files). Never merged,
  never used as a base. No secrets/`.env`/Replit artifacts copied from any
  ref.

### The actual gap: #49 merged with 3 failing CI jobs + missing CI wiring + no docs

GitHub check runs on `a0083e7`: 13/16 green;
`timezone-dst`, `api-replay-tests`, `authz-concurrency` FAILED. All three
were reproduced locally against disposable PostgreSQL 15 and fixed on
`feat/service-area-travel-enforcement` (brought forward via a normal merge of
`origin/main` — no reset, no force-push):

1. **timezone-dst**: `service-area.test.ts` (pure unit) transitively imports
   `@workspace/db`, which throws without `DATABASE_URL`; the job is DB-free
   by design. Fix: `src/__tests__/helpers/pure-unit-db-env.ts` sets a
   placeholder `DATABASE_URL` (`??=`, never overrides a real value) imported
   FIRST by the suite. No production code touched.
2. **api-replay-tests**: the DLQ fixture slot pool spaced slots by service
   duration only (60 min); consecutive pool slots violated the 30-minute
   buffer. Fix: pool spacing = duration + `DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES`.
3. **authz-concurrency** (`test:proposals`): the acceptance-revalidation
   fixture had Tom take `d3T16:00Z` back-to-back with bookingE
   (15:00–16:00Z) — now buffer-blocked. Fix: proposal + Tom's booking moved
   to `d3T16:30Z` (30 min clear; still an exact collision with the proposed
   time, preserving the test's intent; the later 18:00Z fixture stays
   buffer-clear at 30 min).
4. **CI wiring**: `test:service-area` (30-test integration suite) was never
   added to the `api-tests` job loop — added.
5. **Docs**: PR #49 changed no docs beyond the frozen migration artifact.
   This session recorded the implementation in
   `service-area-travel-policy.md` (implementation record; status updated,
   design history preserved), `api-routes.md`, `data-models.md`,
   `ux-guidelines.md`, `NEXT-STEPS.md`, `TODO-LEDGER.md` (deferred row
   closed with date + PR; #12 section + deferred follow-ups appended),
   `pre-11-release-readiness.md` (addendum), `native-device-checklist.md`
   (#12 mobile checks), and this continuity record.

### Validation (disposable local PostgreSQL 15 only; nothing managed touched)

- `pnpm run typecheck` / `build` / `build:deploy` PASS (artifacts verified).
- API unit (incl. service-area, 71 tests) PASS — and PASS with
  `DATABASE_URL` UNSET (the timezone-dst reproduction).
- Fresh-DB CI-order replications: api-tests job (unit + 18 scripted suites
  incl. `test:service-area` 30/30 and `test:booking-page`, + 5 unscripted
  suites) ALL PASS; authz-concurrency job (authorization, concurrency,
  pressure, rescheduling, proposals) ALL PASS; api-replay-tests job
  (replay/DLQ on its own fresh DB) 14/14 PASS.
- Web Vitest / a11y / timezone-DST suites PASS. Migration checks PASS
  (`db:push` ×2 idempotent, seed ×2 idempotent, frozen-artifact hash + no
  destructive DDL, server startup + healthz 200 after migration).
- Secret scan PASS; `git diff --check` PASS.
- Expo iOS/Android exports BLOCKED locally (arm64 host cannot execute the
  x86_64 `hermesc` binary — known, ledgered limitation); both export jobs
  were green in CI on this same code (`a0083e7`) and gate the completion PR.
- Native-device verification NOT performed (deferred, checklist updated).

### Boundaries held

- No routing/geocoding/radius/polygons/coordinates; no payments/refunds; no
  reminder delivery; no email/SMS; no managed DB access; no production
  deployment; no force-push; no branch deletion; conflict_* branches
  untouched; consent-first rescheduling semantics unchanged; existing
  confirmed bookings never silently cancelled.

### Publication

- Fix commit `51fa842`; docs commit `98b6602`; pushed without force to
  `feat/service-area-travel-enforcement`.
- Completion PR #50: https://github.com/sbtheg17-market/foot/pull/50
  (replacement for merged-and-unreopenable PR #49). Squash-merge SHA recorded
  in the ledger/PR after all deterministic CI checks pass.

---

## Session addendum — 2026-08-26 (roadmap #13 implemented)

Recovery first: the prior #13 session's workspace was inspected (fresh clone
of `main` @ `a3121c5`, zero local commits/stashes/changes) — NO code was
recovered; the continuity doc (`docs/roadmap-13-cancellation-no-show-continuity.md`,
draft PR #51) was the only prior artifact and served as the spec.

Implemented on `feat/cancellation-no-show-policy` from `a3121c5`:
server-authoritative cancellation categories (early/late/provider/support)
with a validated 24h notice window, provider reason-category guardrails,
no-show time-passed rule with actor/timestamp metadata, append-only
`booking_outcome_history`, cancellation preview + owner-scoped history
endpoints, public policy summary on booking pages, minimal API-first support
workflow (escalations linked to bookings, admin view/mediate/correct/suspend,
audit-logged, no dashboard UI), web + mobile parity for policy display,
honest cancel confirms, no-show marking, and escalation buttons. Additive
frozen migration `CANCELLATION_NO_SHOW_SUPPORT_V1.sql`, disposable-PG tested;
managed DB not accessed. Full record: `docs/cancellation-no-show-policy.md`.

## Continuation — 2026-08-26 (pilot readiness, Emergent session)

Roadmap #13 was completed and squash-merged (PR #52 → main `1c81695`) after
fixing one CI regression (pre-#13 suites aligned with the new cancellation
contract; commit `cc5ae06`, test-only). The pilot readiness review for the
Southern Ontario controlled pilot (5 providers, St. Catharines → Oakville,
free pilot, 2–5 weeks) was then implemented on `feat/pilot-readiness`:
env-configured support contact (`GET /api/support/contact`, footer links on
the public booking page and provider portal), on-demand real-browser Playwright
smoke test (Chromium 151, 13/13 PASS ×2), native-device EMULATION checks
(iPhone 13 WebKit 26.5 + Pixel 5 Chromium incl. 3G throttle, 9/9 PASS —
hardware verification remains DEFERRED with a manual script), and the full
pilot operations pack under `docs/pilot/` (readiness report, support workflow
with tested escalation, monitoring procedures — external alerting BLOCKED on
accounts, backup/restore drill PASS with measured RTO/RPO, secret rotation
drill PASS, incident runbook, provider onboarding/checklist/FAQ).

## Continuation — 2026-08-27 (provider dashboard, Emergent session)

The conversion-first provider dashboard was implemented on
`feat/provider-dashboard` and squash-merged: canonical `/provider/dashboard`
(old `/provider` redirects), owner-scoped read-only aggregates
(`GET /api/providers/me/dashboard`, `GET /api/providers/me/metrics`; approved
provider gate; access audit-logged), greeting/today/next-booking header,
quick actions, 7/30-day upcoming list with color+text status, performance
metrics (completion / cancellation / no-show / repeat-client over resolved
bookings, supportive copy, explicit empty state), booking-link tools (existing
publish/copy/share/QR) plus a dependency-free source-attribution bar chart,
collapsible recent activity, and a "coming soon" earnings preview
(completed-this-month × service price, `available: false`). No schema change,
no new dependencies; privacy-trimmed client names and FSA/city locations.
Deferred honestly: availability exceptions (emergency slots / block-off
dates), calendar view, on-time rate, dashboard rating display — recorded in
`docs/TODO-LEDGER.md`. Full record: `docs/provider-dashboard.md`.

## Graphify continuity aid

Before beginning a substantial continuation, query the local repository graph if `graphify-out/graph.json` exists:

```bash
graphify query "<task-specific architecture question>"
graphify path "<symbol or concept A>" "<symbol or concept B>"
graphify explain "<symbol or concept>"
```

Use Graphify to identify relevant source, docs, migrations, and dependencies before editing. Treat `EXTRACTED` links as direct source evidence and `INFERRED` links as leads that must be verified in code.

Graphify is optional and non-blocking. If it is unavailable or stale, continue with normal Git/source inspection. Never graph secrets, `.env` files, runtime data, managed-database contents, or credentials. Do not use Graphify as a production service, a CI gate, or a reason to skip tests.

Full workflow, privacy boundaries, and refresh policy:
`docs/graphify-continuity-workflow.md`.

Every future Neo handoff must include this line:

```text
Graphify status: report whether graphify-out/ is present, its latest refresh commit/date, whether code-only or full extraction was used, and whether a refresh is recommended.
```
