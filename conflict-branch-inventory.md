# Conflict Branch Inventory — sbtheg17-market/foot

Generated: 2026-08-09 (Session 057 window, read-only analysis; no branches modified)
Canonical baseline at time of inventory: `origin/main` = `6a5cf35` (cf689b5 → 4734990 → 6a5cf35)

Method: for every `origin/conflict_*` ref — tip hash, root commit, merge-base with
foot `main`, full-history scan for `.patch`/`.bundle` artifacts, and provenance check
of every artifact against published main commits.

| Branch | Tip | Root | Commits | Descends from foot/main? | Patch artifacts (full history) | Unique recoverable content? | Lineage |
|---|---|---|---|---|---|---|---|
| conflict_010826_0008 | a5638c5 | b720fae | 9 | NO (no merge-base) | none | none found | Unrelated Emergent workspace |
| conflict_010826_0036 | 0c7bd7b | b720fae | 11 | NO (no merge-base) | none | none found | Unrelated Emergent workspace |
| conflict_060826_2025 | 058cf6e | d0aeb89 | 6 | NO (no merge-base) | none | none found | Unrelated Emergent workspace |
| conflict_070826_mc2 | bed2e06 | 9ef0b8f | 114 | **YES** — merge-base `54534b0` with main; 5 commits unique to branch, 30 unique to main | attached_assets/phase1-mc1_1786063790850.patch, attached_assets/phase1-mc2_(1)_1786195672753.patch | Low: unique commits are pre-publication drafts of the MC2 provider-application-status API whose content was published on main as `1f4c018` (same change; LOG "Phase 1 checkpoint 2 verified"); branch additionally holds `docs/phase1-mc2-handoff.md` and the two MC1/MC2 patch attachments (both features published) | **Real foot history branch** (stale, superseded) |
| conflict_080826_1307 | 305fd86 | d0aeb89 | 21 | NO (no merge-base) | baseline-test-drift.patch, phase1-mc1.patch, phase1-mc2.patch, phase1-mc3.patch, phase1-mc4.patch, seed-script-hygiene.patch | none unique — MC1–MC4, baseline-drift, and seed-hygiene work all documented as published in main's LOG (Phase 1 checkpoints 1–3, baseline drift resolved, seed rows) | Unrelated Emergent workspace (patch courier) |
| conflict_090826_0856 | 7110dc9 | 66e9b96 | 10 | NO (no merge-base) | phase2-mc9-commit1-reviewer-decisions.patch, phase2-mc9-commit2-decision-notifications.patch, phase2-mc9-commit3-reviewer-decision-tests.patch | none unique — MC9 commits published on main as `0afb3ff`+`92d001f`, `917361d`, `8323aac` (verified ancestors of main) | Unrelated Emergent workspace (patch courier) |
| conflict_090826_1405 | 60979db | 66e9b96 | 12 | NO (no merge-base) | 963902e-web-notification-feed.patch, phase1-54aae0f-marketplace-events.patch | none unique — web feed published as `a98e1a3`, Phase 1 events as `d7a5999` (verified ancestors of main) | Unrelated Emergent workspace (patch courier) |
| conflict_090826_1718 | c3589b1 | 66e9b96 | 14 | NO (no merge-base) | 963902e-web-notification-feed.patch, phase1-54aae0f-marketplace-events.patch | none unique — same artifacts as conflict_090826_1405; extends that lineage with current-session container markers only | Unrelated Emergent workspace (patch courier; includes this session's boilerplate lineage) |
| conflict_310726_1942 | ffe8515 | 11c2276 | 12 | NO (no merge-base) | none | none found | Unrelated Emergent workspace |
| conflict_310726_2216 | 5e85263 | 11c2276 | 14 | NO (no merge-base) | none | none found | Unrelated Emergent workspace |

## Summary

- 9 of 10 branches are unrelated Emergent workspace lineages (four distinct roots:
  b720fae, d0aeb89, 66e9b96, 11c2276) with NO common ancestor with foot main.
- 1 branch — `conflict_070826_mc2` — IS real foot history (stale MC2-era transfer
  branch). Its unique content is superseded by published main commits; NEXT_TASK.md
  already lists its deletion as a documented hygiene follow-up.
- Every `.patch` artifact found on any conflict branch corresponds to work already
  published and verified on main (MC1–MC4, MC9 commits 1–3, web notification feed,
  Phase 1 marketplace_events). No unique recoverable patch artifacts were identified.

## Recommendation (for the separate authorized cleanup operation)

- Safe to archive/delete after approval: all 9 unrelated Emergent lineages.
- `conflict_070826_mc2`: safe to delete per the existing documented hygiene action,
  but as real foot history it could alternatively be tagged (e.g.
  `archive/conflict_070826_mc2`) before deletion for forensic retention.
- Cleanup must be its own authorized operation with no effect on main history.
