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
