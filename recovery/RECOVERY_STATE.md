# Recovery State — sbtheg17-market/foot handoff reconstruction

Mode: READ-ONLY. No push, no merge, no reset, no branch cleanup, no tests, no credential use.
Working dir: /app/recovery (persistent).

## Baseline (from owner + README.txt, checksum-verified)
- origin: https://github.com/sbtheg17-market/foot (recorded for provenance only; NO remote will be configured)
- origin/main = d2ad54cd8e450fcc3bf8fab28aed257d67e73b42
- local checked-out main at bundle time = d489aaed98764fbb7d4a40d3f03db1ed78ae7f66
- handoff-MANIFEST-80.sha256 originates from repo commit 6a3d370 (80 lines)
- handoff-MANIFEST-149.sha256 originates from repo commit 45d5ba1 (149 lines)

## Supplied-file verification (all against top-level MANIFEST.sha256)
| File | SHA-256 status |
|---|---|
| MANIFEST.sha256 | root of trust; self-hash 2149fba012a749317b6b3561a8963a4d1366958f45da9269253f3b591d14b503 |
| foot-bundle-checksums.sha256 | OK (305e5ef4...) |
| handoff-MANIFEST-80.sha256 | OK (21c066f6...) |
| handoff-MANIFEST-149.sha256 | OK (1b58e7f5...) |
| entry-list-80.txt | OK (361e5959...) |
| entry-list-149.txt | OK (13b478f2...) |
| handoff-downloads-MANIFEST-80.json | OK (ccd9c650...) |
| handoff-downloads-MANIFEST-149.json | OK (ccd9c650...) — byte-identical to the -80 json |
| README.txt | OK (851ceae5...) |

## Still awaited from owner (listed in MANIFEST.sha256, not yet uploaded)
| File | Expected SHA-256 |
|---|---|
| foot-all-refs.bundle (REQUIRED for branch search) | bcaed3a2683902244f755819e0bcd4f62889a83b35e6e6fa81ada715ab706fc1 |
| foot-all-refs.txt | 3fb645e45f13cbb6ddc87f3e105c9a8e46612d1621036dd963a4c931e7cffe72 |
| foot-bundle-verify.txt | 2a4edcbdba7ee178ee66c0026160e21b7b4d23d795ac4c251836430660d7d97f |
| bundle-heads.txt | 997ace00eff42693b32543b852e79a8b0ea5b5fefac09ba88a70d035ea6c4909 |

## Ref inventory (from entry-list-80.txt, checksum-verified)
main d489aaed98764fbb7d4a40d3f03db1ed78ae7f66
origin/conflict_010826_0008 a5638c55c4e182db98413eed4e1319b573776fd6
origin/conflict_010826_0036 0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2
origin/conflict_060826_2025 058cf6ecb01cc6bc02c0f9982115be96851b6006
origin/conflict_070826_mc2 bed2e069107df40312e806536c6fb462e8f402bc
origin/conflict_080826_1307 305fd861353b846a32c6cce5daa9a054631bda1e
origin/conflict_090826_0856 7110dc939810271908b5409b7cbb3c7b09342463
origin/conflict_090826_1405 60979dbfba25095085fe6b04dc32b5ec01896308
origin/conflict_090826_1718 c3589b1941f2f5993477a0b0c6eb9b23823d568d
origin/conflict_090826_1916 81014b03325101c20fe8d2fbc61a8d8f2b6df319
origin/conflict_090826_2136 7f7cfaa54ec536eb59d1f6d3e497d2cdd02cfd33
origin/conflict_090826_2326 73bdad6ba0c354234d89670ce5bce22e0147e075
origin/conflict_100826_0813 8cc00284ad2dfb654374469e001ba3f39fe322a8
origin/conflict_100826_0906 018e69bff9aca281ceed19f8be34a0e567e71422
origin/conflict_100826_1234 f9d0b7e9b60a6b45f640d14f5b60c31f2eacdd00
origin/conflict_100826_1415 27a5ada26367158b9e79b7321e18fa5b4e5019d6
origin/conflict_100826_1543 9e9a3ee9ae0c56d67c6e8ffe527f7ea8c9b0321b
origin/conflict_100826_1738 1eefbfd37b3008e59b55b887d83634e16484fd76   <- PRIORITY 3
origin/conflict_100826_1941 9a752aec36c4abd5bf4bfa9760fdb9267392072e   <- PRIORITY 2
origin/conflict_100826_2113 b9d27229a86d1ecf39b9f289251773eb88386e1a   <- PRIORITY 1
origin/conflict_100826_2258 12c88633121eb7ad137654eabdd1661b4f5cbf56   <- PRIORITY 4
origin/conflict_310726_1942 ffe8515962a6f617b183dab3adb1059905109ee2
origin/conflict_310726_2216 5e852632731b3d14a21544bd087cfbb90e4e644d
origin/main d2ad54cd8e450fcc3bf8fab28aed257d67e73b42
replit-agent 9682040bd5111691ebd73f63d439984a911de800
replit/agent-ledger 9682040bd5111691ebd73f63d439984a911de800
(22 conflict_* refs confirmed, including all four priority refs)

## Manifest reconciliation (149 vs 80)
- 64 common paths, ZERO checksum conflicts
- 85 paths only in 149-list; 16 paths only in 80-list
- handoff-downloads-MANIFEST-80.json == -149.json (identical sha ccd9c650...)

## Historical package context (handoff-downloads JSON)
- Transport-only patch package, generated 2026-08-10T23:20:09Z
- Historical baseline main at package time: 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
- Candidates: A_prime (commit f4a5dfec, parent 3e76114c), C_prime (re-derive), B_prime (re-derive),
  phase4c_prep + rule12_provenance (separate approvals)
- applied_remotely=false, publication_window_opened=false

## FINAL RESULT (2026-08-11) — OUTCOME: INCOMPLETE

Bundle verification: SHA-256 match (bcaed3a2...), `git bundle verify` okay/complete history,
29 refs exactly match foot-all-refs.txt / bundle-heads.txt / owner verify record. fsck clean.
Mirror at /app/recovery/foot.git (origin remote removed; refs restored exactly from verified
foot-all-refs.txt after removal side-effect; re-diffed: identical).

Search executed: full history of all 22 conflict_* branches + origin/main + local main
= 311 commits, 305 unique trees, 2294 blobs (owner entry-list-149 inventory: 4206 objects — consistent).

### Matrix summary
- handoff-MANIFEST-149: 90 VERIFIED_PRESENT / 59 NOT_FOUND / 0 mismatch
- handoff-MANIFEST-80: 64 VERIFIED_PRESENT / 16 NOT_FOUND / 0 mismatch
- CHECKSUM_MISMATCH: none (earlier tip-level ledger mismatches resolved byte-identically in history)
- Unique missing files: 55 (75 manifest entries incl. duplicates)
- Recovery sources: conflict_100826_1941 (primary), conflict_100826_2113, conflict_100826_2258
  under handoff/ and audit/handoff_restore/handoff/ trees; conflict_100826_1738 holds only the
  takeover docs handoff/00..04 (predates package assembly), contributed no package artifacts.

### Missing set (55 unique) by category
- BD-* B′ r2 validation evidence: 19; P4-* Phase 4C r2: 8; RD-* Rule 12 r2: 2
- CD-* C′ r2: 4; TO-* takeover session: 9; PB-* publication verification: 3
- RG-* regenerated transport logs: 6
- Archives: A_prime_package.tar.gz/.zip, C_prime_r2_package.tar.gz/.zip (4)
Full list: /app/recovery/report/RECOVERY_MATRIX.md

### Nested bundle recovery (evidence)
candidates/local-branches-2026-08-10.bundle recovered byte-identical (sha 99760835...),
verify okay, 5 refs; commit/parent/tree verified against handoff-downloads JSON:
- A′ f4a5dfec (parent 3e76114, tree 63dcfbe3) EXACT
- B′ e6380bf7 (tree c6e8c1f2) EXACT
- C′ 2c6d0248 (tree 093a2c22) EXACT
- rule12 b85f71f3 (tree a4091ce2) EXACT
- phase4c_prep 2dc23539 (tree 56d34d2b) EXACT (bundle tip 7009ce66 is one commit ahead)
r2 commit objects 9e0bbd45 (B′ r2), 396040ea (P4C r2), e5919bd4 (Rule12 r2): ABSENT from both
ODBs — r2 patches retained as evidence only; NOT publication-ready; NOT re-derived.

### Session 2026-08-11 (plan v1.1 accepted)
- OWNER ACCEPTANCE recorded (AC-021, PLAN_V1.1_ACCEPTANCE.md): plan v1.1 accepted as the
  reviewed design with the four corrections (grant 201/+400; withdraw+delete 404;
  loading/error/unauthorized added at C-3; node:test + fetch-against-BASE).
  Design acceptance only — NOT implementation or publication approval.
- C-1 PRECONDITIONS: 1/4 satisfied (acceptance recorded). Pending: Gate B PASS
  (managed env, runtime-injected DATABASE_URL — the next EXTERNAL action),
  additive-table scope confirmation, OpenAPI/codegen boundary review.
- ENDPOINT ISSUE: CLOSED as tooling limitation (AC-020, 7/7 independent PASS);
  no further URL debugging.
- NOTHING IMPLEMENTED: no codegen, no tables, no schema/migrations, no persistence
  wiring, no economics, no publications, no credentials; 22 conflict branches preserved.

### Session 2026-08-11 (formal review gate)
- WIRING PLAN REVIEW (AC-016): section-by-section against real artifacts —
  8 ACCEPTED, 2 CHANGE REQUESTED, 0 UNRESOLVED. Findings: grant returns 201(+400) not 200;
  withdraw/delete include 404; shells lack loading/error/unauthorized scaffolds (to be ADDED
  at C-3); repo test harness is node:test + fetch (not supertest). Corrections folded into
  plan v1.1 (AC-019 supersedes AC-013 pin). Full report: COMFORT_WIRING_PLAN_REVIEW.md.
  Plan status: READY FOR OWNER ACCEPTANCE — NOT implementation-approved.
- GATE B (AC-017): BLOCKED — managed runtime-injected DATABASE_URL not available here;
  local PostgreSQL explicitly does not qualify. Owner-run per GATE_B_RUNBOOK.md.
- C-1 (AC-018): NOT_RUN — conditionally approved; requires (1) explicit plan acceptance,
  (2) Gate B PASS, (3) confirmed additive-table scope, (4) OpenAPI/codegen boundary review.
  Not started from summary alone, per instruction.
- ENDPOINT VERIFICATION (AC-020): independent testing agent — 7/7 PASS; all three archives
  byte-exact with attachment headers and valid structure. Owner-side fetch failure is an
  interface limitation (chat cannot render binary), not a server defect; use browser/curl.
- LEDGER: 20 records, VERIFY PASS. Manifest HANDOFF-R3-MANIFEST.sha256 refreshed (0 failures).
  Sealed acceptance bundle re-verified 22/22.
- PRESERVED HOLDS: no Rule 12 publication, no Phase 4C publication, no economics,
  no discovery expansion, no admin dashboard, no supply-health dashboards, no cleanup,
  no remote writes, no schema/tables/codegen during review.

### Session 2026-08-11 (three follow-on local tasks)
- RULE 12 R3 EXPORT: package extended with MANIFEST.json + STATUS.txt (LOCAL-ONLY/UNPUBLISHED,
  commit fc6251a4 / parent d2ad54cd / tree 1f1da660 / patch sha 3eee486c...), CHECKSUMS 8/8,
  archived (sha fedacb17...) and served at GET /api/recovery/rule12-r3 (+.sha256);
  round-trip byte-identical (AC-010); sealed acceptance bundle untouched (22/22).
- COMFORT-WIRING PLAN: /app/recovery/COMFORT_WIRING_PLAN.md drafted for review (AC-013) —
  six routes/contracts, ownership boundaries, consent/privacy, 404-only projection rules,
  five UI states, test plan, exact file list, C-1 schema/codegen implications, Gate B
  dependency, rollback/stop conditions. NOTHING wired; OpenAPI remains x-status: draft.
- CHECKLIST DRY RUN (items 1-8 only): AC-011 FAIL (script cwd defect, superseded) →
  AC-012 PASS 9/9: fresh main==d2ad54cd, identity+checksums, 38/38 tests, typecheck+build,
  lockfile invariant, exact 9-file scope, secret scan, gate rationale mechanism
  (rejects malformed; runs end-to-end with self-describing DRY-RUN non-approval text,
  no --ack-draft-wording needed). Recorded as PREPARATION ONLY; items 9-15 untouched.
- LEDGER INTEGRITY EVENT: verify caught two artifact drifts (AC-006 checksums file
  regenerated during export; AC-011 script fix) — resolved append-only with structured
  supersedes records AC-014/AC-015; VERIFY PASS, 15 records.
- MANIFEST: HANDOFF-R3-MANIFEST.sha256 refreshed (self-hash d68fedef...), 0 failures.
- DEFERRED per owner: recovery index page.
- STILL BLOCKED: schema, migrations, storage, economics, production events, demo wiring,
  Rule 12 publication, Phase 4C publication, conflict-branch cleanup, Gate B execution
  (owner-run), credentials, push/merge.
- NEXT MILESTONE (owner-set): review comfort-wiring plan → Gate B → smallest persisted
  Phase 4C implementation.

### Session 2026-08-11 (four approved local tasks)
- TASK 1 (export): phase4c_r3 package (patch + MANIFEST.json identity/scope + PROVENANCE.md +
  STATUS.txt LOCAL-ONLY/UNPUBLISHED + 4 evidence logs + CHECKSUMS.sha256) archived
  (sha 2a981539...) and served at GET /api/recovery/phase4c-r3 (+ .sha256);
  round-trip byte-identical (ledger AC-007). Sealed acceptance bundle untouched (22/22 re-verified).
- TASK 2 (Rule 12 r3): recovered r2 patch (sha 1afb92dc..., byte-identical) applied clean onto
  d2ad54cd → NEW LOCAL-ONLY commit fc6251a4e2726c31f7adab1c45370500a0d2d693
  (tree 1f1da660, docs-only .agents/AGENT-RULES.md +32) on separate branch
  candidate/rule12-provenance-r3, never bundled with Phase 4C. Gate 12/12 PASS (AC-002),
  secret value scan CLEAN (AC-005 supersedes AC-003 policy-text false positive),
  package /app/recovery/candidates-r3/rule12_r3/ (AC-006). NOT exported, NOT published.
  Historical r2 commit e5919bd4 remains absent and unclaimed.
- TASK 3: GATE_B_RUNBOOK.md — managed-env-only, runtime-injected DATABASE_URL, never
  printed/logged/checksummed/persisted, 6 catalog checks, capture.py redaction,
  PASS/FAIL/BLOCKED/UNRECORDED taxonomy (AC-008).
- TASK 4: PUBLICATION_CHECKLIST_phase4c_r3.md — all 15 required items; items 9-15
  explicitly UNSATISFIED; stop line before window/credential (AC-009).
- LEDGER: /app/recovery/ledger/LEDGER.jsonl — 9 append-only records, verify PASS,
  built with recovered capture.py (fe14b624) + record_action.py (28e6c8cf) byte-exact
  from snapshots; secret-pattern refusal by the redaction layer observed working (AC-005 retry).
- MANIFEST REFRESH: HANDOFF-R3-MANIFEST.sha256 (38 entries, all verify;
  self-hash bcc3f58e...). origin remote now points at the verified LOCAL bundle file
  only (credential-free fetch for gate freshness); refs re-diffed clean.
- STILL BLOCKED: push/merge, Gate B execution, schema/storage/migrations, economics,
  Rule 12 publication, publication windows, credentials.

### Session 2026-08-11 (post-acceptance authorized work)
- EXPORT: sealed handoff-bundle archived → /app/recovery/exports/foot-handoff-bundle-sealed-2026-08-11.tar.gz
  (SHA-256 e6385b3c1ad972d16c1672efbbd4a6ff4df432cafb966f1ef4ddd2ca06611d8d); extract-verified 22/22;
  served read-only at GET /api/recovery/export (+ .sha256), download re-verified byte-identical.
- CANONICAL BASELINE REPORT: repo = OnCall Foot (pnpm workspace); main tip d2ad54cd
  ("feat(web): provider portal sign-out", 2026-08-11 01:56:31 +0000, tree c7e136a4);
  worktree checkout clean (0 modified); mirror refs identical to verified foot-all-refs.txt
  (29 refs, no unexpected); 22 conflict_* branches preserved untouched; zero credentials used
  (bundle-only supply chain).
- PHASE 4C RE-DERIVATION (r3): recovered r2 patch (sha db071702..., byte-identical to manifest)
  applied clean via git am onto d2ad54cd → NEW candidate commit d9195dfab83a211dd2d79e7836348693a9748bc8
  (parent d2ad54cd, tree 2b1a3f7d) on LOCAL-ONLY branch candidate/phase4c-nonschema-prep-r3.
  Validation (new evidence, labeled): frozen install PASS; test:comfort-contract PASS 38/38;
  workspace typecheck PASS; web production build PASS; tracked tree clean; patch secret-scan clean.
  Package: /app/recovery/candidates-r3/phase4c_r3/ (patch + PROVENANCE.md + 4 evidence logs +
  CHECKSUMS.sha256 self-hash a34754ef...). Historical r2 commit 396040ea remains absent and unclaimed.
- GATE B: NOT run here — requires managed environment with runtime-injected DATABASE_URL;
  no credentials requested/used. Remains owner-run.
- BLOCKS UNCHANGED: schema, migrations, storage, economics, production events, publication,
  Rule 12 r2 re-derivation. Missing-file import remains optional owner-supplied recovery only.

### Acceptance layer (2026-08-11, post-recovery)
- Evidence ceiling declared in acceptance/ACCEPTANCE_RECORD.md (90/149 + 64/80; 55 missing;
  no 149/149 or 80/80 claim; no rebuild; no regeneration; r2 candidates blocked).
- Layered handoff set at /app/recovery/handoff-bundle/: original 13 supply files byte-identical
  (re-verified against owner MANIFEST.sha256) + acceptance/ subdirectory + ACCEPTANCE-LAYER-README.txt
  + roll-up ACCEPTANCE-MANIFEST.sha256. Import procedure for later-supplied files documented
  (verify SHA-256 per MISSING_FILES_55.txt, no overwrites, provenance log, matrix rerun,
  rebuild only at full verification).
- Standing constraints: new work from canonical main d2ad54cd only, with review;
  Gate B / schema / migrations / storage / economics / publication BLOCKED pending
  separate approval.

### Claims discipline
149/149 and 80/80 NOT claimed. Verified counts: 90/149 and 64/80.
Handoff bundle NOT rebuilt (missing files). No push/merge/test/cleanup/credentials/Gate B.
Owner action required: supply the 55 missing files (or the original evidence exports /
package archives) from the source workstation; alternatively accept the r1-candidate
evidence chain as the maximum recoverable set.
