# OWNER ACCEPTANCE — Comfort-Wiring Plan v1.1
Recorded: 2026-08-11. Source: owner instruction (verbatim scope below).

## Decision
Plan v1.1 is ACCEPTED as the reviewed design. This is plan acceptance,
NOT implementation approval and NOT publication approval.

## Accepted corrections (from the formal review, folded into v1.1)
1. grant returns HTTP 201, with HTTP 400 validation handling;
2. withdraw and delete include HTTP 404;
3. loading, error, and unauthorized states are added at C-3;
4. tests use node:test with fetch-against-BASE.

## C-1 precondition tracker
| # | Condition | Status |
|---|---|---|
| 1 | Plan v1.1 acceptance recorded | SATISFIED (this record; ledger AC-021) |
| 2 | Gate B PASS in managed environment with runtime-injected DATABASE_URL | PENDING — next external action (local PostgreSQL does not qualify; ledger AC-017 BLOCKED) |
| 3 | Exact additive-table scope confirmed | PENDING (after Gate B) |
| 4 | OpenAPI/codegen boundary reviewed | PENDING (after Gate B) |

## C-1 candidate requirements (when all four conditions clear)
Separate candidate containing: approved OpenAPI/spec merge; codegen confined to
lib/api-zod and lib/api-client-react; exactly two additive tables
(client_comfort_profiles, client_comfort_consents); no alteration of existing
tables; no production events; captured schema/typecheck/generated-client/API
evidence via capture.py; rollback notes; exact tree, patch checksum, and
changed-file scope. Stop before publication.

## Standing holds (unchanged)
No codegen, no tables, no schema/migration changes, no persistence wiring,
no economics, no publication (Rule 12 or Phase 4C), no credentials,
all 22 conflict branches preserved, all existing holds preserved.

## Closed items
Endpoint issue: CLOSED as a tooling limitation (owner interface cannot render
binary downloads); archives independently verified 7/7 (ledger AC-020).
No further debugging of those URLs.
