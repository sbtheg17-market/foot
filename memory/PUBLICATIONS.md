# PUBLICATIONS — sbtheg17-market/foot (verified read-only by this workspace)

## A′ Session 063 traceability — LANDED 2026-08-11
- prior local candidate: f4a5dfeca5af222aeb9dcb1a6da822415397f902
- published commit:      0938c440c7defafed7fdbeaa3839616e231ec9f4
- parent:                3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
- tree:                  63dcfbe3080dae65a478c55d8e4bdbebb1832838
- scope:                 .agents/LOG.md + .agents/NEXT_TASK.md
- result:                fast-forward (exactly 1 commit), remote/local match, clean tree
- wording rule:          commit objects are NOT byte-identical (committer
                         sbtheg17-market 2026-08-11T00:27:32Z differs); the verified
                         published TREE and PATCH SCOPE match the candidate.
- independent verification: ledger PB-001 (ls-remote + parent/tree/scope/FF anatomy
                         from refreshed mirror); 20 conflict branches intact.
- credential:            bounded write credential was never held in this workspace;
                         revocation must be executed/confirmed by the channel owner
                         (ledger PB-002, BLOCKED).

## C′ r2 — APPROVED; PRE-PUSH VERIFIED; PUSH BLOCKED (no credential in workspace)
- approval:              C′ publication explicitly approved 2026-08-11 as next separate publication
- pre-push verification: CP-001 package 9/9 + secret scan clean; CP-002 live main == 0938c440
                         fresh + 21 heads; CP-003 anatomy (parent/tree/patch-sha/scope/lockfile);
                         CP-004 FAIL (grep formatting, superseded); CP-005 gate 12/12 + CD-005
                         battery evidence confirmed; CP-006 independent testing-agent 8/8 PASS
                         (/app/test_reports/iteration_1.json)
- push status:           CP-007 BLOCKED — no bounded write credential was provided to this
                         workspace (request skipped). Steps 6–8 must execute via the Replit
                         channel with the NEW bounded credential, using
                         /app/handoff/downloads/C_prime_r2_package (guide steps 1–9).
                         On landing report: this workspace verifies remote SHA/parent/tree/
                         scope/lockfile read-only, then owner revokes the credential.
- retired old identity:  2c6d0248569b9c3f99213a19a40eaade81e69a4a (base 3e76114) — never apply
- r2 candidate commit:   f905a1518803342a4e3bc5c20a92660443fd005b
- parent/base:           0938c440c7defafed7fdbeaa3839616e231ec9f4
- tree:                  bc28a5c1571af56c25394ac907e440d928a780dc
- patch sha256:          ea3eb8ed962753db7b5d6846c9b90bd7d2b5da7cecc397f9be088e49da8d3456
- scope:                 .agents/SETUP.md + package.json (packageManager 9.15.0 → 10.18.3)
- evidence:              CD-001 derivation; CD-002 frozen install exit 0 (defect fixed);
                         CD-003 lockfile byte-identical; CD-004 FAIL (env bootstrap,
                         superseded, kept on record); CD-005 battery 229/229 PASS
                         (17/17 suites, postgres 15.18, server :8899); CD-006 gate 12/12 PASS
- package:               /app/handoff/downloads/C_prime_r2_package (+ .tar.gz fe771db2…,
                         .zip 3148fd2f…)
- blocked on:            explicit C′-specific approval + NEW bounded write credential
                         (A′ window credential must not be reused)

## Next in order (do not reorder, never bundle)
1. C′ r2 publication (after approval) → independent read-only verification here.
2. B′ re-derivation on post-C′ tip: browser verification + REAL reviewed
   --approve-web-ui "<approver>: <reason>" rationale (packaged one is DRAFT-only).
3. Phase 4C prep and Rule 12 stay separate candidates.

## Environment notes for future sessions (pod-restart-safe paths)
- /app/repo_audit/foot-mirror (refresh with git fetch), derive_worktree (C′ r2 branch),
  validate_worktree, run_battery.sh (build+seed+server harness), assemble_*.py scripts.
- Battery needs: apt postgresql (15.18 arm64), corepack pnpm@10.18.3,
  DATABASE_URL=postgres://foot:foot@127.0.0.1:5432/foot_test (throwaway local),
  JWT_SECRET any local value, PORT free (8080 is occupied in this pod).
- Ordering rule: final capture record → sync ledger copies → DOWNLOADS.sha256 →
  MANIFEST.sha256 → silent verify.
