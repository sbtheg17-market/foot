# Task PRD — OnCall Foot Complete Project Reconnaissance (recon-report-2)

## Task type
Reconnaissance and synthesis only — NO application build, NO merges, pushes, rewrites, deletions, or file modifications in the target repository.

## Target
- Repo: `github.com/sbtheg17-market/foot` (public read access)
- Canonical branch: `main` @ `b20087d13eb77ad3da0b60efc88d4e768f68134d` (2026-08-11 16:29:48 +0000)
- Read-only clone: `/app/recon/foot` (all 27 refs fetched)

## Deliverable
`/app/memory/NEO_ENTRY_REPORT.md` — "OnCall Foot — Complete Marketplace Vision, Branch Reconciliation, Roadmap, and Current-State Report" (all 20 required sections).

## Key verified findings
1. Main = OnCall Foot pnpm/Node24/Express5/PostgreSQL(Drizzle)/React19(Vite)/Expo monorepo, ~85% MVP; provider portal + client booking live; admin narrow (verification + reviewer decisions); payments deferred.
2. **26 conflict branches** exist (inventory v6 on main counts only 25 — stale). Only `conflict_070826_mc2` shares history with main and is superseded (git cherry verified). 25 branches have NO merge base across 5 root lineages.
3. Corrected classification: 4 oldest branches = original OnCall Foot FastAPI/Mongo era (not Comfort-Wiring); 16 = agent work-transfer/audit workspaces; 4 = Comfort-Wiring proper (0846, 1112, 1134, 1322).
4. `conflict_110826_1322` (newest, pushed AFTER main's HEAD) preserves the Phase 4C contract V3, 11 CW patches + signed approval INDEX.json, CW ledger ENTRY-001..019 (27/27 tests), and the prior Neo report — dissolving the "Phase 4C contract absent" blocker (operator approval still required to recover it).
5. Auth bypass audit on main: CLEAN (zero bypasses; only a seed comment). CW bypass confined behind ALLOW_TEST_IDENTITY_HEADERS + production hard-refusal.
6. Gate B (managed DATABASE_URL verification) remains the standing blocker for activation Phases 4–7 and any migration.
7. Next 3 tasks: Gate B clearance → client booking-lifecycle completion slice → Phase 4C stack-native port. Parallel: inventory v7 + branch export/cleanup re-authorization.

## Integration policy honored
Nothing merged/pushed/modified. Recommendations only: never merge no-merge-base branches; port Comfort-Wiring functionality stack-natively; all publications via dedicated branch + publish:gate + reviewed fast-forward.
