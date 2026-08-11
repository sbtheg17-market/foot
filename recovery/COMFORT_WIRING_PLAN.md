# PHASE 4C COMFORT-PROFILE WIRING PLAN v1.1 (for review — nothing wired yet)

Revision v1.1 (2026-08-11, per COMFORT_WIRING_PLAN_REVIEW.md): status-code matrix
corrected to the OpenAPI draft (grant 201/400; withdraw and delete include 404);
UI states re-worded from "already scaffolded" to "to be added at C-3";
test harness corrected to the repo's node:test + fetch convention (not supertest).

Status: PLAN ONLY. Prepared 2026-08-11 against candidate phase4c-nonschema-prep-r3
(d9195dfa, parent d2ad54cd). The OpenAPI document REMAINS `x-status: draft`.
No schema, migrations, storage, events, or generated clients are added by this plan.
Implementation follows contract v3 §9 sequencing (C-1 → C-2 → C-3); each step needs
its own review and this plan's stop conditions.

## 1. Exact routes and API contracts (six operations, from openapi.draft.yaml)

| # | Method + path (under `/api`) | operationId | Success | Errors |
|---|---|---|---|---|
| 1 | GET /clients/me/comfort-profile | getMyComfortProfile | 200 profile+flags+consent; 204 no profile | 401 |
| 2 | PUT /clients/me/comfort-profile | putMyComfortProfile | 200 saved | 400 validation, 401, 409 no active consent |
| 3 | DELETE /clients/me/comfort-profile | deleteMyComfortProfile | 204 | 401, 404 no profile |
| 4 | POST /clients/me/comfort-consent | grantComfortConsent | 201 consent state | 400 validation, 401 |
| 5 | DELETE /clients/me/comfort-consent | withdrawComfortConsent | 200 consent state (profile hidden, not deleted) | 401, 404 no consent to withdraw |
| 6 | GET /bookings/{bookingId}/client-comfort | getBookingClientComfort | 200 projection | 401; **404 on EVERY denial** (never 403) |

Contract source of truth: `PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md`
(SHA-256 `339a03e6…`), enforced by the dependency-free contract module —
closed vocabularies (pressure, touch, temperature, fragrance, sensitivity flags,
accessibility, setting, duration buckets, time windows, communication, curated
language tags), `VISIT_NOTE_MAX_LENGTH=280`, unknown keys rejected.

## 2. Client/server ownership boundaries
- Server (artifacts/api-server) owns: validation via
  `validateComfortPreferences` / `validateVisibilityFlags`, consent decisions via
  `isConsentActive` (latest-row semantics), projection via `buildProviderProjection`,
  denial mapping to 404. The web client NEVER re-implements these rules.
- Client (artifacts/web) owns: presentation, optimistic-free form state (no local
  caching of another user's data), calling generated hooks from
  `@workspace/api-client-react` only. Shell literals are replaced by generated
  types — no hand-rolled request/response shapes.
- Providers get data ONLY through operation 6 (booking-scoped). No provider-side
  route may read profile rows directly.

## 3. Consent and privacy behavior
- Consent-first: PUT profile returns 409 unless the latest consent row is a grant
  (`isConsentActive`). Grant/withdraw are separate operations (4/5) and idempotent.
- Withdraw hides the profile from all projections immediately but does NOT delete
  data; DELETE (op 3) is the only destructive action and is owner-initiated.
- Owner-scoped `/clients/me/*`: authenticated client id comes from the session; a
  client can never address another client's profile by id.
- Language rule: every user-facing description says preferences "match your
  preferences" — never medical guidance; enforce with
  `findForbiddenMedicalPhrases` in a copy-audit test.
- Privacy default: all visibility flags default to `defaultVisibilityFlags()`;
  nothing is visible to providers unless the client turned the category on.

## 4. Projection / filtering rules (operation 6)
Return 404 (never 403, to avoid existence leaks) unless ALL hold:
1. requester is the provider assigned to `bookingId`;
2. booking status ∈ `PROJECTION_ACTIVE_BOOKING_STATUSES` (confirmed / en_route / in_progress);
3. client consent is currently active;
4. profile exists.
Then return ONLY categories whose visibility flag is true, built by
`buildProviderProjection` (server-side; no raw profile fields pass through).
Empty projection (all flags off) → 200 with empty categories; card renders nothing.

## 5. UI states (both shells; empty/consent-lock states exist today — loading, error, and unauthorized handling are TO BE ADDED at C-3)
- Loading: skeleton on editor and provider card while the hook is in-flight.
- Empty: editor shows "no profile yet" first-run state (GET 204); provider card
  renders NOTHING for 404/empty projection (no "hidden profile" hint).
- Unauthorized (401): redirect to sign-in preserving return path.
- Forbidden: does not exist for these routes by design — denials are 404; the
  provider card treats 404 as empty; the editor never receives 403.
- Error (5xx/network): non-blocking inline retry banner; never lose typed input;
  save button disabled while consent is missing with inline explanation (409 path).

## 6. Test plan
- Keep: 38/38 contract tests (vocabularies, consent semantics, projection, copy audit).
- Add integration tests using the repo's existing harness — node:test + fetch
  against a running BASE (as in review.integration.test.ts); NOT supertest: one happy + each error path per operation
  (401/400/409/404 matrix, ~18 cases); consent latest-row edge (grant→withdraw→grant);
  projection status matrix (each non-active status → 404); visibility filtering
  (flag off ⇒ category absent); no-event assertion (no `marketplace_events` writes).
- Web: component tests for the five UI states per shell; copy-audit test reusing
  `FORBIDDEN_MEDICAL_PHRASES`.
- Gates: typecheck, web production build, frozen install, secret scan — all PASS
  before any review handoff.

## 7. Exact files expected to change (C-2/C-3 implementation, when approved)
- NEW `artifacts/api-server/src/routes/comfort.ts` (six handlers, contract module only)
- EDIT `artifacts/api-server/src/routes/index.ts` (mount router)
- NEW `artifacts/api-server/src/__tests__/comfort-profile.integration.test.ts`
- EDIT `artifacts/api-server/package.json` (test script for integration suite)
- EDIT `artifacts/web/src/pages/comfort/comfort-preferences-shell.tsx` (wire hooks; route at `/profile/comfort`)
- EDIT `artifacts/web/src/components/comfort/provider-comfort-card-shell.tsx` (wire projection hook)
- EDIT web router file registering `/profile/comfort` + provider booking-detail render site
- C-1 only (separately approved): `lib/api-spec/openapi.yaml` merge; regenerated
  `lib/api-zod` + `lib/api-client-react` (codegen output only, never hand-edited)
Anything outside this list = stop condition (see §10).

## 8. Schema / storage / codegen implications (ALL currently blocked)
- Two additive tables per contract §5: `client_comfort_profiles`,
  `client_comfort_consents` (append-only consent history) in `lib/db` — additive
  migrations only, no changes to existing tables.
- Codegen: merge draft into canonical spec, then
  `pnpm --filter @workspace/api-spec run codegen` — only after C-1 review approval;
  the draft keeps `x-status: draft` until that merge is approved.
- No storage wiring, no events, no economics, no demo wiring in any step of this plan.

## 9. Gate B dependency
C-1 schema work MUST NOT start until Gate B (managed environment, runtime-injected
DATABASE_URL, per GATE_B_RUNBOOK.md) passes and specifically confirms the comfort
tables DO NOT yet exist and the migration baseline matches the recorded state.
Sequencing: this plan reviewed → Gate B PASS → C-1 (schema+codegen) → C-2 (routes)
→ C-3 (UI wiring), each with its own review.

## 10. Rollback and stop conditions
- Rollback unit = one reviewed commit per step; revert restores the previous state
  with no data loss (C-1 additive tables are dropped only by an explicitly approved
  down-migration; withdrawing consent already hides data without schema action).
- STOP immediately if: changed-file scope exceeds §7; any test in §6 fails; codegen
  diff touches files outside lib/api-zod + lib/api-client-react; any comfort route
  emits an event; projection can return 403 or leak a hidden category; Gate B
  fails or is UNRECORDED; main moves off d2ad54cd (re-derive first); or any
  credential would need to be printed or persisted.
- On stop: record the FAIL/BLOCKED ledger entry, do not patch around the gate,
  escalate with the record id.
