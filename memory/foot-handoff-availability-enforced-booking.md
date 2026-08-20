# OnCall Foot — Read-only Handoff: availability-enforced-booking (Real slots, no double-booking)

Durable copy stored OUTSIDE the project repository (/app/foot) on purpose: repo policy
inspection (.agents/AGENT-RULES.md, docs/) showed adding any file would broaden the
reviewed working-tree diff, which the operator forbade. This artifact changes nothing
inside the repo.

## Repository status (verified read-only)
- Branch: feat/availability-enforced-booking
- HEAD: 27b906562bc2375106d767703f2e3c3a887103b0 (= canonical origin/main; NOTHING committed on the branch)
- Working tree: DIRTY by design — 17 modified + 12 untracked files = the complete local implementation, UNCOMMITTED
- Staged: 0 files. Temporary artifacts: none (advisory-lock POC removed; api-server/var/ removed; pnpm-lock.yaml restored)
- git diff --check: clean. Conflict markers: none in any changed/untracked file
- Diff size: 17 files changed, 1317 insertions(+), 96 deletions(-), plus 12 untracked new files

## Exact changed files
Production source (M): artifacts/api-server/src/routes/bookings.ts; artifacts/api-server/src/routes/providers.ts;
  artifacts/web/src/components/ui/booking-modal.tsx; artifacts/web/src/pages/provider-profile.tsx; lib/api-spec/openapi.yaml
Production source (new, untracked): artifacts/api-server/src/lib/availability.ts
Focused test (new, untracked): artifacts/api-server/src/__tests__/availability-enforced-booking.test.ts
Regression fixtures (M): booking-concurrency, booking-pressure, care-history.integration,
  client-booking-lifecycle.integration, prevented-booking-events.integration,
  prevented-booking-replay.integration, review.integration (all under artifacts/api-server/src/__tests__/)
Generated API output (M): lib/api-zod/src/generated/api.ts, types/duplicateBookingConflictResponse.ts, types/index.ts;
  lib/api-client-react/src/generated/api.ts, api.schemas.ts
Generated API output (new, untracked): lib/api-zod/src/generated/types/{bookingRequestRejectedResponse,
  bookingRequestRejectedResponseReason, duplicateBookingConflictResponseReason, getProviderSlotsParams,
  providerSlot, providerSlotsResponse, providerUnavailableConflictResponse,
  providerUnavailableConflictResponseReason, publicAvailabilityResponse, publicAvailabilityWindow}.ts
Unexpected files: NONE.

## Implementation summary
- Timezone Option B: MARKETPLACE_TIMEZONE optional; default America/Toronto; invalid override throws
  InvalidMarketplaceTimezoneError (clear 500, no silent fallback). Effective label exposed in API + UI.
- DST: Intl-based conversion; spring-forward (nonexistent) slots omitted; fall-back (ambiguous) slots omitted,
  never silently doubled. Unit-tested for both 2026 Toronto transitions.
- Slots: fixed 30-min increment (:00/:30), no DB column; slot kept only when start + service.duration_minutes
  <= window_end; half-open [start, start+duration).
- Overnight windows: rejected (start >= end → 400) on both availability-write routes; never match in checks.
- POST /bookings: invalid/past → 400 {error}; outside windows → 400 {error, reason:"outside_availability"};
  provider overlap → 409 {error, reason:"provider_unavailable"} (no ids leaked); same-client duplicate →
  409 {error, bookingId, reason:"duplicate_booking"} (additive reason; telemetry preserved).
- Concurrency: db.transaction + tx.execute(SELECT pg_advisory_xact_lock(42001, providerId)) → overlap check
  (existing.start < req.end AND req.start < existing.end, per-booking duration via make_interval) → insert,
  all in ONE transaction. Blocking states: requested/confirmed/rescheduled. Non-blocking: cancelled/completed/no_show.
  Partial unique index remains the final safety net. POC proved lock compatibility before implementation.
- Public endpoints: GET /providers/{id}/availability and GET /providers/{id}/slots?serviceId&date —
  shape-only payloads (timezone, windows, slot start/end/available); no booking ids, client ids, or details.
- Web: booking modal = date + real slot grid (taken slots disabled; 409/400 reasons refresh slots);
  provider profile shows weekly windows + timezone label.
- OpenAPI updated FIRST, then pnpm --filter @workspace/api-spec run codegen; generated files never hand-edited.

## Test evidence (operator-reported from the implementation session; NOT rerun during this handoff)
availability-enforced-booking 45/45; booking-state-machine 63/63; booking-concurrency 16/16;
client-booking-lifecycle 14/14; booking-pressure 13/13; availability-preset 3/3; care-history 4/4;
review 7/7; role-state 2/2; authorization-hardening 7/7; prevented-booking-events 9/9;
prevented-booking-replay 14/14; marketplace-events 12; reviewer-decisions 14; provider-readiness 14;
provider-notifications 12; provider-application suites 8, 9, 23, 11, 11.
Codegen clean; root typecheck passed; API build passed; web build passed; git diff --check passed.
prevented-bookings-daily-rebuild.test.ts NOT RUN — projection/rebuild work is NOT AUTHORIZED (also unaffected:
creates no API bookings).
All testing used a LOCAL scratch PostgreSQL (postgresql://scratch@localhost/foot_scratch) with db:push + seed.
Managed database: never accessed.

## Known limitations / open items (report-only; do NOT resolve without operator approval)
1. PATCH /bookings/:id/status with rescheduled + new scheduledAt BYPASSES availability/overlap checks
   (confirmed: PATCH route untouched by diff; out of approved scope).
2. Naive-timestamp round-tripping relies on the Node process running in UTC; documented in the
   implementation report; in-code documentation is partial (availability.ts header covers explicit
   conversion policy, not the driver/process-TZ dependency).
3. Ambiguous fall-back local times cannot be booked at either instant (by design; documented).
4. Slot `available` flag is advisory; the locked transaction is authoritative.
5. No production verification of any kind; local scratch DB only.
6. Three regression tests had ASSERTION updates (not fixture-only) because approved behavior changed:
   lifecycle "another client same time" → now expects provider_unavailable; events race path →
   accepts preflight (lock serialization supersedes index collisions; counting rule still strict);
   replay pinned duplicate 409 body → includes additive reason. Operator should review these in the diff.

## Next-Neo instructions
1. Review this handoff FIRST; then start from the current UNCOMMITTED working tree on
   feat/availability-enforced-booking (HEAD 27b9065). Do NOT assume anything is committed — it is not.
2. Do not commit until the operator explicitly authorizes; then do not push/PR/merge/deploy without
   separate authorization.
3. Never access the managed database; keep analytics/projection DEFERRED (PR #21 preserved, migration unapplied).
4. Preserve all conflict_* branches untouched.
5. Address only operator-approved follow-ups (reschedule enforcement, process-UTC note, etc.).
6. Local re-verification recipe (if needed): install pnpm 9 + local PostgreSQL; export
   DATABASE_URL=<scratch>; pnpm install; pnpm run db:push; JWT_SECRET=<any> pnpm run seed;
   build & start api-server on a free port (8080 is occupied in this container; 8090 was used);
   run suites with node --import tsx/esm --test.
