# Foot Governance Session Ledger (v1)

**Classification: LOCAL DOCUMENTATION-ONLY ARTIFACT — KEEP LOCAL UNTIL REVIEWED.**
Do NOT add this ledger to Session 063. Do NOT publish it automatically. It tracks governance state across sessions; it authorizes nothing. Update by hand only, one entry per confirmed state change, facts only.

Ledger last updated: end of environment-mismatch session (fresh-template workspace).

## 0. Update protocol (approved at ledger review — every update MUST include)

1. Session/date and responsible operator.
2. Gate A inventory version and checksum.
3. Exact conflict-branch count and tip SHAs.
4. Gate B verifier version, checksum, managed-run status, and report checksum.
5. Deploy-key status with deletion confirmation.
6. Session 063 candidate SHA, parent, tree, patch checksum, and publication status.
7. Approval changes and reasons.
8. A timestamped change-log entry.

Scope rule: this ledger tracks **authoritative status only** — it must not duplicate application requirements. Keep local-only; never add to Session 063; never publish automatically.

---

## 1. Gate A — Conflict-branch audit

| Field | Value |
|---|---|
| Status | PENDING — audit not yet run in a verified canonical clone |
| Branch inventory version | v3 (original 12 + `conflict_090826_2326 @ 73bdad6` + post-S063 addenda `conflict_100826_0813 @ 8cc0028`, `conflict_100826_0906 @ 018e69b`) |
| Expected branch count | 15 (all preserved evidence — never cleanup targets) |
| Approved procedure | `GATE_A_READONLY_AUDIT_PROCEDURE.md` v1 |
| Discrepancy form | `GATE_A_DISCREPANCY_REPORT_TEMPLATE.md` v1 |
| Inventory report checksum | — (produced on audit completion) |

## 2. Gate B — Managed-environment verification

| Field | Value |
|---|---|
| Status | BLOCKED — runs only after Gate A + key deletion + S063 publication |
| Verifier | v2, approved to run (read-only catalog verifier) |
| Environment rule | Managed environment only; runtime-injected DATABASE_URL; no migrations, no event writing, no production DB access from local workspaces |
| Verifier/report checksum | — (recorded on run) |

## 3. Deploy key

| Field | Value |
|---|---|
| Key | `foot-publication-window-s062` |
| Status | PENDING DELETION — GitHub administrator must delete, then verify absence |
| Verified absent on (date/by) | — |
| Rule | Session 063 publication window must NOT open before confirmed absence |

## 4. Session 063 — Traceability candidate

| Field | Value |
|---|---|
| Candidate commit | e6809e7 (local-only) |
| Parent | 3e76114 (= canonical origin/main) |
| Tree SHA | — (record from canonical clone before publication) |
| Patch checksum | — (record before publication) |
| Publication status | BLOCKED — awaiting deploy-key deletion + manual confirmation |

## 5. Approvals register

| Item | Status |
|---|---|
| Phase 4C plan v2 | APPROVED (plan) |
| Provider economics plan v2 | APPROVED (plan) |
| Gate B verifier v2 | APPROVED to run (blocked on sequence) |
| C-2 reviewed base (2678aac + 9a17bf8) | APPROVED — preparation only until Gate B + schema review clear |
| Discovery / SEO surfaces | NOT STARTED — canonical repo only, after governance recovery |
| Standalone prototype (fresh workspace) | NOT APPROVED — vertical, MVP scope, auth model intentionally unresolved |
| Gate A audit procedure doc | APPROVED (documentation only) |
| Discrepancy report template | APPROVED (documentation only) |
| This session ledger | APPROVED (documentation only; keep local until reviewed) |

## 6. Sequence of record

```
Verified canonical clone
→ Gate A read-only audit
→ deploy-key deletion confirmation
→ Session 063 publication
→ Gate B managed-environment verification
→ C-2 implementation
→ Phase 4C
→ provider economics
→ discovery and SEO
```

## 7. Change log

| Entry | Session | Change |
|---|---|---|
| 1 | Environment-mismatch session (fresh template) | Ledger created. Recorded: Gate A pending (15-branch inventory v3), Gate B blocked, deploy-key deletion pending, S063 publication blocked, approvals register, sequence of record. No repository, GitHub, or app work performed. |
| 2 | Environment-mismatch session (ledger review) | Ledger structure APPROVED as local status source of truth. Update protocol (section 0) embedded per review. Workspace declared CLOSED — no further work here beyond preserving the four documentation artifacts. Next: verified canonical clone → Gate A audit → deploy-key deletion + verification → update ledger with both results → only then open bounded S063 publication window → Gate B → C-2 → Phase 4C → economics → discovery/SEO. |

---
*Companion documents in this directory: `HANDOFF_ENVIRONMENT_MISMATCH.md`, `GATE_A_READONLY_AUDIT_PROCEDURE.md`, `GATE_A_DISCREPANCY_REPORT_TEMPLATE.md`.*
