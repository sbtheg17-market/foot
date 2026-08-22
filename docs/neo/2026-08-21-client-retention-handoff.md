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
