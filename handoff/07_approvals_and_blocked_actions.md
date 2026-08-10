# 7. Pending approvals and explicitly non-authorized actions

## 7.1 Approved (with exact limits)
| Item | Approved scope | Hard limits |
|---|---|---|
| Phase 4C comfort-profile v3 | **Non-schema preparation only**: OpenAPI/specification draft; UI shells; fixtures; contract tests; non-persistent boundary preparation | NO schema, NO migration, NO storage wiring, NO persistence, NO event emission; gated on the checksum-verified contract document |
| Provider economics v3 | **Contract only** | NO implementation until Phase 4C sequencing AND Gate B pass; economics UI shells explicitly excluded |
| Small UX fixes | May continue as **separate proposed candidates** | One reviewed candidate at a time; web scope requires `--approve-web-ui` human approval at publication |
| E2E hardening | May continue as **separate proposed candidates** | No new web/mobile test framework beyond what is separately approved; no scope creep |

## 7.2 Pending approvals (nothing may proceed without the named approval)
1. Publication of Candidate A (Session 063 traceability) — needs artifact recovery → review → specific publication approval + operator-approved channel window.
2. Publication of Candidate B (provider sign-out) — same, plus `--approve-web-ui` approval if scope is `artifacts/web/**`; must be re-derived if it publishes second.
3. Phase 4C contract document review (checksum `1fa0eec…bb14`) — prerequisite for the approved non-schema prep to be checked against it.
4. Provider economics contract review (checksum `5a7a202…2bcc`).
5. Any conflict-branch cleanup — requires: recovered pinned script/inventory, a FRESH 18-branch re-inventory, and separate explicit authorization (currently blocked regardless).
6. Gate B managed verification run — requires owner scheduling in the managed environment.
7. Branch-protection + audit-log exports — require owner-held authenticated read access.

## 7.3 Explicitly NOT authorized (blocked — do not perform)
- Schema changes; migrations; storage wiring.
- Production event writes.
- Provider economics implementation.
- Broad marketplace expansion.
- Conflict-branch cleanup (including tagging/deleting any `conflict_*` ref).
- Remote ledger edits (any push touching `.agents/*` included).
- **Any push or merge of any kind**, to any ref.
- Requesting, transferring, printing, or embedding any credential, PAT, SSH key, `DATABASE_URL`, or secret.
- Using conflict branches as development bases.
- Claiming byte identity between re-derived and original candidates.

## 7.4 Gate B statement (verbatim policy)
Gate B is **not passed** until verified in the managed environment with a runtime-injected `DATABASE_URL`. No local substitute counts. Until then: no migrations, no storage wiring, no production event writes.
