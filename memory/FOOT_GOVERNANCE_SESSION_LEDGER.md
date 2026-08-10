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
| Status | **PASS — 2026-08-10T15:10Z, zero discrepancies** |
| Branch inventory version | v3 (12 pinned in .agents/LOG.md:335 + 73bdad6 + 8cc0028 + 018e69b) |
| Observed branch count | **15 of 15 — every tip SHA exact match** |
| origin/main verified | 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a (tree bc67dd6e281d3521d679c411fc70cdde6ab24a34) |
| Channel | read-only SSH deploy key `foot-gate-a-readonly-audit-2026-08-10` (write access unchecked) |
| Approved procedure | `GATE_A_READONLY_AUDIT_PROCEDURE.md` v1 |
| Inventory report checksum | `9e30d5fb6a97c76a0bcfc1cc904476e0a42dd93fe6e9d6c392d3bc9bd56bbcb1` (report preserved at `evidence/GATE_A_REPORT_2026-08-10.txt`) |
| Ancestry finding | 14/15 branches have NO common ancestor with main (unrelated lineages); only conflict_070826_mc2 is real foot history (merge-base 54534b0, known superseded) |
| Mutations | NONE — no checkout/merge/rebase/update/delete/push of any conflict_* branch; main untouched |

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
| Status | **DELETED — confirmed by primary audit-log evidence** |
| Evidence | `public_key.delete` 2026-08-10T03:06:49.870Z, removed_by_user, doc ID `dBCe3Oevk8h46xWacXhjSA`; all 8 key creates reconcile to 8 deletes — zero publication keys remain (see `DEPLOY_KEY_DELETION_EVIDENCE.md`) |
| New audit-scoped key | REVOKED in the operator's access sweep (2026-08-10, behavioral evidence: publickey refused). **Post-containment audit key approved and generated (temporary)**: title `foot-postcontainment-audit-2026-08-10-temporary`, fingerprint `SHA256:a5eggDRah/Ummy36kY5u6O45t1HOplRu+7tD+WwpyzQ` — read-only, repository-specific, single-purpose (post-containment branch inventory only), to be DELETED immediately after the audit. No write key exists or is authorized yet. |
| Rule | Session 063 publication still requires a separate bounded WRITE window — see section 4 blocker |

## 3a. Containment (runbook v1.1) — evidence status

| Item | Status |
|---|---|
| Emergent.sh app access removal | **UNVERIFIED** — last audit export (ended 2026-08-10T13:15Z) shows the app freshly INSTALLED; no later evidence supplied |
| Branch protection on main | **UNVERIFIED** — no evidence supplied; no protection events in the export |
| Conflict branches preserved | VERIFIED — Gate A 15/15 exact match, post-containment count recorded |
| Required follow-up | Admin executes/confirms runbook steps 1–3 and exports the audit-log events |

## 4. Session 063 — Traceability candidate

| Field | Value |
|---|---|
| Candidate commit | e6809e7 (was local-only in a PRIOR workspace) |
| Parent | 3e76114 (= canonical origin/main, verified) |
| **Recovery status** | **NOT RECOVERABLE from remote — object absent from sbtheg17-market/foot; publication BLOCKED until the candidate is recovered from its original workspace or re-derived and re-reviewed** |
| Publication status | BLOCKED — candidate object unavailable + containment evidence incomplete + no write channel (by design) |

## 4a. C-2 preparation candidate (this session, LOCAL ONLY — not pushed)

| Field | Value |
|---|---|
| Branch | `c2-consent-api` (local clone at /root/foot) |
| Commit | **`a7a1ba2f2e01c4dec67f58d5a54e4aeacad09fc2` (corrected — supersedes 573e40f)** |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (exactly origin/main) |
| Tree | `44cb1f59f1a726fac0c4ef6cbb863cb9cb66f7ec` |
| Patch SHA-256 | `736253ced2e359faa66a6bc0021f5e10affd2a2299d5b97958bc51938ff9ea4e` |
| Scope | **8 files: `lib/comfort-profile/**` ONLY** (pnpm-lock.yaml removed — hard-forbidden by gate; root tsconfig reference reverted — not strictly required) |
| Tests | **31/31** contract tests PASS (reconciliation vs prior 29-test report documented in test header — prior candidate unrecoverable; coverage re-derived and exceeded; nothing intentionally removed); package typecheck PASS; root `typecheck:libs` PASS |
| option_id compatibility | Documented in vocabulary.ts: options addressed by stable `(categoryId, key)` only — swappable to DB-backed store with surrogate option_id without contract changes |
| Contract source | In-repo reviewed summary (.agents/LOG.md Sessions 059–062); original contract doc (sha 1fa0eecb…) absent from clone, independently reviewed in prior conversation — NOT claimed recovered |
| Boundaries honored | No schema, no migrations, no DB access, no event emission, no OpenAPI regen, no booking/ranking/discovery changes, no comfort data in errors/events |
| Status | AWAITING REVIEW — do not publish; not a traceability entry yet |

## 4b. Session 063 — RE-DERIVED candidate (this session, LOCAL ONLY — not pushed)

| Field | Value |
|---|---|
| Branch | `session-063-rederived` (local clone at /root/foot) |
| Commit | `63b6b2c180ec7f4a1e2672646a1784335390575a` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (exactly origin/main) |
| Tree | `87dcba65d8e1083f546aa7b840e43592efe69b71` |
| Patch SHA-256 | `573e806cad841514c9ee44fc4cfe8dacfb0f4f77d6df4b2acf4805c6f09bcc39` |
| Scope | Exactly 2 files: `.agents/LOG.md` + `.agents/NEXT_TASK.md` |
| Supersession | Explicitly supersedes unrecoverable `e6809e7`; **no byte-identity claim** |
| Publication gate | **FULL PASS** (all checks incl. tree identity + patch checksum; draft-wording fixed and re-passed) |
| Status | AWAITING HUMAN REVIEW — publication requires a new bounded write window (read-only key cannot push) |

## 4c. Provider-economics preparation candidate (LOCAL ONLY — not pushed)

| Field | Value |
|---|---|
| Branch | `provider-economics-prep` (local clone at /root/foot) |
| Commit | `a9d769c5c65faed7a8901c658730422e64f73d1a` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (exactly origin/main) |
| Tree | `46291584066e1bf650595daf3c3fb3a58ad93bc9` |
| Patch SHA-256 | `b025444a8ab28c241141d7e3ba32edd9f5e6d01844b7c33f853a2176a845b3bd` |
| Scope | 7 files: `lib/provider-economics/**` ONLY (lockfile excluded/restored) |
| Tests | 22/22 contract tests PASS; package typecheck PASS |
| Contents | Boundary types + validation (buffers, min booking value, preferred blocks w/ overlap detection); read-only TravelZoneReader over the EXISTING travel-zone contract (unchanged); pure advisory economics with visible assumptions + advisory-null reasons; deal state machine with MANDATORY pre-publish previews (terms-fingerprint pinned); no-stacking, cap, and window enforcement; in-memory mocks; structural absence checks for ranking/auto-discount/forced-acceptance/guarantee fields |
| Boundaries honored | No schema, migrations, DB access, production writes, ranking logic, automatic discounts, forced acceptance, SEO, booking behavior; separate from C-2 and Session 063 |
| Status | **APPROVED — reviewed local preparation base (2026-08-10)** |

### Requirements pinned for the NEXT economics slice (production implementation — not blockers for this candidate)

1. Pin currency, timezone, daylight-saving, overnight-block, and rounding semantics.
2. Define travel-cost inputs and behavior when location, duration, or travel data is unavailable.
3. Make preview tokens single-use, time-limited, and invalidated by any terms change.
4. Implement concurrent redemption-cap enforcement atomically.
5. Enforce no-stacking structurally when the schema is eventually built.
6. Keep deal expiry terminal and prove no auto-renewal.
7. Preserve the structural tests showing no ranking, auto-discount, forced-acceptance, or guarantee fields.

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
| 3 | 2026-08-10 canonical-access session (read-only deploy key; operator = repo admin) | **Gate A PASS**: 15/15 conflict_* branches, zero discrepancies, report checksum 9e30d5fb…; origin/main verified 3e76114 (tree bc67dd6e…). Deploy-key deletion CONFIRMED (doc ID dBCe3Oevk8h46xWacXhjSA; zero publication keys remain). New read-only audit key added by operator (cannot publish). Containment steps 1–3 (app removal, main protection) remain UNVERIFIED — awaiting admin evidence. S063 candidate e6809e7 found NOT RECOVERABLE from remote (local to a prior workspace) — publication blocked on candidate recovery/re-derivation. C-2 preparation candidate built per operator authorization: local branch c2-consent-api @ 573e40f, parent 3e76114, patch sha f7dc3667…, 20/20 contract tests + typecheck PASS, storage-agnostic, NOT pushed, awaiting review. Gate B still blocked (no managed environment). Approval changes: none beyond standing authorization. |
| 4 | 2026-08-10 same session (review corrections applied) | **C-2 corrected per review**: new commit a7a1ba2 (supersedes 573e40f) — lockfile removed (hard-forbidden by gate), root tsconfig reverted (not strictly required), scope now exactly lib/comfort-profile/** (8 files), patch sha 736253ce…, tests expanded 20→31 with documented reconciliation vs the unrecoverable 29-test report, option_id compatibility documented, missing-contract-file status recorded (NOT claimed recovered). **Session 063 RE-DERIVED per authorization**: new candidate 63b6b2c (branch session-063-rederived), parent 3e76114, tree 87dcba65…, patch sha 573e806c…, exact two-file scope, explicit supersession of e6809e7 with no byte-identity claim; repository publication gate FULL PASS (incl. tree identity + patch checksum). Both candidates LOCAL ONLY, stopped for review. main and all 15 conflict branches re-verified untouched. |
| 5 | 2026-08-10 same session (dual review received) | **C-2 a7a1ba2 APPROVED** as reviewed local preparation base (stays local until post-Gate-B authorization). **Session 063 63b6b2c APPROVED FOR PUBLICATION, conditional**: write window may open ONLY after admin evidence of Emergent.sh access removal + active main protection is recorded; then publish exactly 63b6b2c fast-forward from 3e76114, close and verify. **Economics preparation APPROVED and BUILT**: local branch provider-economics-prep @ a9d769c (parent 3e76114, tree 46291584…, patch sha b025444a…, scope lib/provider-economics/** 7 files), 22/22 contract tests + typecheck PASS; boundaries/advisory-economics/deal-preview models with no-stacking + cap enforcement; travel-zone contract integrated read-only, unchanged; separate from C-2 and S063. All three branches local-only; main + 15 conflict branches re-verified untouched. |
| 6 | 2026-08-10 same session (economics review received) | **Provider-economics a9d769c APPROVED** as reviewed local preparation base. Seven production-implementation requirements pinned in section 4c for the next economics slice (currency/timezone/DST/overnight/rounding semantics; travel-cost input definitions + unavailable-data behavior; single-use time-limited preview tokens invalidated on terms change; atomic concurrent cap enforcement; structural no-stacking at schema level; terminal deal expiry with no auto-renewal; preservation of structural exclusion tests). Reviewed local set now: C-2 a7a1ba2 · S063 63b6b2c (conditional publication) · economics a9d769c. Next blocking action remains EXTERNAL: containment evidence → bounded S063 publication → close/verify window → managed Gate B → C-1 schema → connect C-2 → economics implementation. Write window stays closed until admin evidence confirms Emergent.sh removal AND active main protection. |
| 7 | 2026-08-10 same session (containment: partial, operator-attested) | Operator VERBALLY CONFIRMED GitHub access removal. Behavioral corroboration captured: the Gate A read-only deploy key is now REFUSED by GitHub ("Permission denied (publickey)") — the remote channel from this workspace is fully closed, consistent with a complete access sweep (Emergent.sh + audit key). Evidence status: (a) Emergent.sh access removal = operator-attested + behavioral corroboration, documentary audit-log evidence still pending; (b) main branch protection = STILL UNEVIDENCED. Per the dual-evidence rule, the S063 write window REMAINS CLOSED. All remote verification is suspended (no channel); local clone intact with the three candidates verified present (a7a1ba2, 63b6b2c, a9d769c on separate branches; local origin/main mirror at 3e76114; 15 conflict refs in last-known mirror). No further work this block per operator instruction. |
| 8 | 2026-08-10 same session (post-containment inventory audit) | **POST-CONTAINMENT AUDIT PASS** via temporary read-only key (fingerprint SHA256:a5eggDRah…, single bounded ls-remote pass, no clone/fetch/write): conflict_* count = 15 (ZERO growth since the access sweep — inventory frozen); all 15 tip SHAs exact full-SHA matches to the pinned inventory; main = 3e76114 unchanged; total heads = 16, no unexpected refs. Behavioral confirmation: branch creation STOPPED after Emergent.sh access removal — intervention response strongly reinforces the root-cause hypothesis. Inventory snapshot preserved at evidence/POSTCONTAINMENT_INVENTORY_2026-08-10.txt (sha256 f668ae0c…). **Audit key must now be DELETED by the operator per its conditions.** Publication-key policy affirmed: audit key is never converted to write; S063 will use a separate, separately authorized, bounded write credential after main-protection evidence is verified. |
| 9 | 2026-08-10 same session (audit acceptance + key retirement) | Operator ACCEPTED the post-containment audit (15/15 frozen inventory, main 3e76114, zero new branches; correlation reinforced, causation still qualified). Key retirement executed on the side available to this workspace: **private halves of BOTH audit keys destroyed locally** (foot_postcontainment + the already-revoked foot_readonly; /root/.ssh now holds no keys) — this workspace can no longer authenticate to GitHub even if a public key survived. GitHub-side deletion of `foot-postcontainment-audit-2026-08-10-temporary` (fp SHA256:a5eggDRah…) assigned to a GitHub administrator with verification of absence. S063 window still CLOSED — sole remaining containment item: documentary evidence of main protection (force-push disabled, deletion disabled, restricted direct writes, PR/approved path required, no Emergent.sh bypass). Sequence after evidence: approve window → separate bounded write key → publish exactly 63b6b2c from 3e76114 → verify → disable/delete write key → Gate B → C-1 → C-2 storage connection → economics implementation. |

---
*Companion documents in this directory: `HANDOFF_ENVIRONMENT_MISMATCH.md`, `GATE_A_READONLY_AUDIT_PROCEDURE.md`, `GATE_A_DISCREPANCY_REPORT_TEMPLATE.md`.*
