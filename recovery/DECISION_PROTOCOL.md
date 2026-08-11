# DECISION AND CHANGE-CONTROL PROTOCOL (standing — adopted 2026-08-11)

Every plan, contract, candidate, gate, or implementation step is reported as:

1. Decision: ACCEPTED / ACCEPTED WITH CONDITIONS / CHANGE REQUESTED / BLOCKED / NOT APPROVED
2. Exact scope: files, routes, tables, APIs, tests, candidate identity affected
3. Reason: why accepted / conditionally accepted / changed / blocked
4. Evidence: contract section, test record, ledger entry, checksum, gate result, or repository fact
5. Consequence: what the decision permits and what remains forbidden
6. Next action: exactly one executable step, and whether approval is required

Required response format for every decision report:
  Decision: / Scope: / Reason: / Evidence: / Permitted: / Still blocked: /
  Next action: / Approval required:

## Alteration rule (never silently alter an accepted plan)
If implementation reveals a mismatch, STOP and produce:
- original accepted wording;
- discovered mismatch;
- proposed alteration;
- affected scope;
- compatibility and migration impact;
- new tests required;
- whether the change requires fresh approval.
Implementation does not continue until the alteration is explicitly accepted.
Design acceptance is never implementation approval. A requested alteration is
never automatic permission to change scope.

====================================================================
# DECISION REGISTER (carried forward, owner-issued)

## D-001 Comfort-Wiring Plan v1.1
Decision: ACCEPTED AS DESIGN ONLY
Scope: /app/recovery/COMFORT_WIRING_PLAN.md v1.1 — six comfort routes
  (getMyComfortProfile, putMyComfortProfile, deleteMyComfortProfile,
  grantComfortConsent, withdrawComfortConsent, getBookingClientComfort);
  candidate phase4c-nonschema-prep-r3 d9195dfab83a211dd2d79e7836348693a9748bc8.
Accepted corrections:
  - grant returns 201 with 400 validation handling;
  - withdraw and delete include 404;
  - loading, error, and unauthorized states are added at C-3;
  - tests use node:test with fetch-against-BASE.
Reason: formal section-by-section review (8 accepted / 2 change-requested)
  with corrections folded into v1.1; owner accepted the reviewed design.
Evidence: COMFORT_WIRING_PLAN_REVIEW.md; ledger AC-016, AC-019, AC-021;
  PLAN_V1.1_ACCEPTANCE.md; openapi.draft.yaml response codes.
Permitted: planning and Gate B preparation.
Forbidden: implementation, codegen, schema, storage, publication.

## D-002 Gate B
Decision: BLOCKED / PENDING EXTERNAL MANAGED RUN
Scope: managed database verification per GATE_B_RUNBOOK.md; six checks
  (identity, connectivity, role/permissions, schemas, comfort-tables-absent,
  migration baseline).
Reason: no managed runtime-injected DATABASE_URL in this workspace; local
  PostgreSQL does not qualify.
Evidence: ledger AC-017 (BLOCKED); AC-022 (operator kit prepared and
  safety-rail tested: /app/recovery/gate-b/run-gate-b.sh + gateb-query.mjs).
Permitted: prepare the runbook and evidence structure.
Forbidden: run or claim Gate B locally, add schema, run migrations, connect
  persistence, begin C-1.

## D-003 C-1 schema preparation
Decision: CONDITIONALLY APPROVED, NOT YET EXECUTABLE
Scope (when executable): separate C-1 candidate — merge approved OpenAPI spec
  into lib/api-spec/openapi.yaml; codegen confined to lib/api-zod and
  lib/api-client-react; exactly two additive tables (client_comfort_profiles,
  client_comfort_consents); no existing-table or event changes.
Preconditions: (1) plan v1.1 accepted — SATISFIED (AC-021);
  (2) managed Gate B PASS — PENDING; (3) exact two-table scope confirmed —
  PENDING; (4) OpenAPI/codegen boundary confirmed — PENDING.
Evidence: ledger AC-018 (NOT_RUN); PLAN_V1.1_ACCEPTANCE.md precondition tracker.
Permitted (when all four pass): create the C-1 candidate with captured
  schema/typecheck/generated-client/API/rollback/tree/patch/scope evidence.
Forbidden: any C-1 work before all four preconditions; publication always
  out of scope for the candidate.

## Standing holds (apply to every decision above)
No Rule 12 publication, no Phase 4C publication, no economics, no discovery
expansion, no admin/supply-health dashboards, no conflict-branch cleanup,
no remote writes, no credentials. 22 conflict branches and the sealed
acceptance bundle preserved.
