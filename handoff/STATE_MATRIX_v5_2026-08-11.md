# STATE MATRIX v5 — 2026-08-11 (post-C′ publication takeover, first response)

Read-only verification only. ZERO remote writes performed (clone/fetch/ls-remote only).
Ledger records TO-001..TO-008 appended via capture.py (ledger now 95 records incl. this
session; TO-007 FAIL superseded by TO-008 — grep spacing class, same as CP-004 precedent).

## 1. Verified main tip (TO-001, TO-002)
- Repository: sbtheg17-market/foot (anonymous HTTPS read confirmed; no credential in pod)
- main: e2406942b4206f877468e1b0f4c3c331ec151da9 — MATCHES expected takeover baseline.
- Ancestry: 3e76114 → 0938c440 (A′) → e2406942 (C′) — fast-forward chain confirmed.

## 2. A′ and C′ publication verification (TO-002)
- A′ 0938c440: parent exactly 3e76114; scope exactly .agents/LOG.md + .agents/NEXT_TASK.md;
  tree 63dcfbe3080dae65a478c55d8e4bdbebb1832838 (matches PB-001 ledger record). VERIFIED.
- C′ e2406942: parent exactly 0938c440; scope exactly .agents/SETUP.md + package.json;
  tree bc28a5c1571af56c25394ac907e440d928a780dc — EXACT match to ledger CD-001 re-derived
  C′ r2 (local candidate f905a151; owner-channel re-commit, committer sbtheg17-market
  2026-08-11T01:07:27Z; commit hashes differ by design — tree identity is the protocol
  standard). Patch checksum ea3eb8ed962753db7b5d6846c9b90bd7d2b5da7cecc397f9be088e49da8d3456
  re-verified in both restored package copies. VERIFIED.
- Lockfile invariant: pnpm-lock.yaml blob 8a5e03928a523e39b5855e0172f1772aec05ec71
  byte-identical across C′ (0 diff lines) and unchanged at current main. HELD.

## 3. Conflict-branch inventory (TO-001, TO-003) — DISCREPANCY RECORDED
- Remote now has **21** conflict_* branches, not the 20 stated in the handoff.
- All 20 tips from STATE_MATRIX_v4 match exactly (no tampering, no deletions, no moves).
- NEW 21st ref: conflict_100826_2113 → b9d27229a86d1ecf39b9f289251773eb88386e1a
  ("Auto-generated changes", 2026-08-11T01:14Z — AFTER the handoff text was authored).
  Tip-vs-parent scope: .emergent/emergent.yml ONLY. CLASSIFICATION: platform auto-snapshot
  of the prior takeover pod. Its lineage carries the FULL durable handoff package —
  currently the ONLY remote ref that carries the C′-r2 package, capture.py, and the
  87-record ledger. READ-ONLY inventory item; NOT a development base; owner audit-log
  attribution remains open (inherited blocker BF-037).
- No other unexpected ref changes. main + 21 conflict_* = 22 heads total.

## 4. Handoff bundle status (TO-004, TO-005)
- Restored read-only from b9d27229 lineage to /app/audit/handoff_restore + canonical
  live evidence at /app/memory/evidence/.
- handoff/MANIFEST.sha256: 64/64 present files verify OK. 33 entries ABSENT — the known
  pod-local durability gap (AC/RG/CD per-candidate evidence .log files + package
  .tar.gz/.zip archives), recorded previously in NA-003/RG-009→RG-011; every present
  file matches its checksum. NOT corruption.
- Candidate bundle local-branches-2026-08-10.bundle: verify OK, complete history,
  5 refs restore exact tips (A′ f4a5dfec, old C′ 2c6d0248, old B′ e6380bf7,
  phase4c 7009ce66, rule12 b85f71f3).

## 5. B′ recovery / re-derivation status (TO-005, TO-006)
- Old B′ e6380bf7 (parent 3e76114, tree c6e8c1f2, one file
  artifacts/web/src/components/layout/provider-layout.tsx, +40/−2) is NOT on any remote
  ref (upload-pack refuses it) — recovered locally from the verified bundle + patch
  (sha256 dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093).
- Old B′ patch apply-checks CLEAN onto e2406942 (A′/C′ never touched the file).
- Re-derivation onto parent e2406942 NOT yet performed → next local action.
- Outstanding B′ requirements: typecheck; web build; desktop + mobile browser
  verification (AC-006 remains NOT_RUN); sign-out clears client session/token state;
  protected routes stay protected post-sign-out; no unrelated changes; capture.py record
  per command; REAL reviewed --approve-web-ui rationale (current one DRAFT-only);
  publication gate with exact tree + patch checksum. Publish alone, never bundled.

## 6. Phase 4C status
- phase4c-nonschema-prep.patch (2dc23539): apply-check CLEAN on e2406942. Scope verified
  non-schema: contract doc v3, OpenAPI draft, fixtures, 38 contract tests, consent-first
  editor shell, provider comfort-card shell, wiring notes, api-server package.json test
  script. UI shells remain unwired from persistence.
- phase4c-demo-wiring.patch: stacks on prep (does not apply standalone — expected).
- Contract tests 38/38 captured in ledger (AC-007); re-capture through capture.py on the
  new tip when Phase 4C work resumes. No codegen, schema, migrations, storage, or
  production events performed or permitted.
- Rule 12 provenance-docs candidate (b85f71f3): apply-check CLEAN on e2406942; separate
  candidate, own approval.

## 7. Gate B status (TO-008)
- UNVERIFIED / BLOCKED. No runtime-injected DATABASE_URL in this pod. Managed-environment
  catalog check with redacted evidence still required. All schema/migrations/storage/
  production-event/C-2-persistence/economics work remains FORBIDDEN.

## 8. Provider economics
- R1–R7 contract approved AS CONTRACT ONLY (sha 5a7a2029…). Implementation gated behind:
  B′ sequenced → Gate B pass → Phase 4C implementation review → own scope review.

## 9. Evidence & credentials present / missing
PRESENT: 87-record ledger restored intact + 8 takeover records (95 total, summary
regenerated VERIFY PASS); capture.py + record_action.py live at /app/memory/evidence/;
candidate patches + bundle + manifests; battery evidence CD-005 (229/229) on tree
bc28a5c1 == CURRENT main tree (duplicate-guard: no rerun needed); C′ r2 package checksums.
MISSING: 33 pod-local evidence logs/archives (durability gap, regenerable);
owner attribution/audit export for conflict_100826_1738/1941/2113 snapshots;
per-candidate publication approval for B′; bounded repo-scoped write credential
(correctly absent until an approved publication window); runtime DATABASE_URL (Gate B).

## 10. Exact next local-only action
Re-derive B′ from parent e2406942 with a NEW identity: cherry-pick/apply the recovered
one-file change onto e2406942 in a scratch worktree; run typecheck + web build + desktop
and mobile/responsive browser verification + sign-out session/token + protected-route
checks, all through capture.py; export patch + candidate manifest + tree/patch checksums +
changed-file list + secret scan; then STOP for explicit per-candidate approval naming the
candidate and target ref. No other candidate in the same window.

## 11. Approval required?
- For this session's verification: NOT required (read-only, zero remote writes — honored).
- For B′ local re-derivation + validation package prep: NOT required (approved local work),
  but B′ PUBLICATION requires explicit named approval + real reviewed --approve-web-ui
  rationale + new bounded repo-scoped credential.
- For anything remote (push, branch ops, ledger edits, Gate B-gated work): YES, blocked
  pending the Section 9 missing items.
