# STATE MATRIX v3 — sbtheg17-market/foot — 2026-08-10 (post demo wiring)
All work LOCAL AND UNPUSHED. Remote re-verified after this session's work:
main = 3e76114 (canonical), 21 refs total (HEAD + main + 19 conflict_* branches, all preserved,
conflict_100826_1738 untouched as evidence). NO remote writes performed.

## 1. RECOVERED ARTIFACTS (evidence only — unchanged from matrix v2)
- A′/B′/C′ patches: SHA-256 exact matches (dbb5abd6… / dfbf9e18… / 1dfbfb13…6e31)
- v3 comfort contract 339a03e6… (in-repo copy byte-identical); v3 economics contract 2172f6cf… (contract-approved ONLY)
- Legacy retired patches eec0147/0c216d6: full checksums on record; identities stay retired
- Audit export coverage ends 13:15:16Z; handoff packet preserved on conflict_100826_1738

## 2. RECONSTRUCTED CANDIDATES (local branches, byte-identical identities)
| Candidate | Branch | Commit | Status |
|---|---|---|---|
| A′ session-063 | candidate/A-prime-session063 | f4a5dfec… | **INTENDED FIRST PUBLICATION CANDIDATE (owner-designated)** — gate 12/12 PASS — BLOCKED (see §5); NO push, NO bounded write window created |
| C′ lockfile | candidate/C-prime-lockfile | 2c6d0248… | evidence-ready; frozen install PASS, battery 13/13 (205/0), gate PASS; sequenced AFTER A′ publishes+verifies → re-derive on new tip as NEW identity, rerun frozen install + lockfile diff + full battery + gate |
| B′ sign-out | candidate/B-prime-provider-signout | e6380bf7… | evidence-ready; typecheck/build PASS, gate PASS (draft-verification rationale only); sequenced LAST, requires real reviewed --approve-web-ui rationale |

## 3. APPROVED LOCAL WORK — Phase 4C (branch phase4c/non-schema-prep)
| Commit | Content | Verification |
|---|---|---|
| 2dc23539… (parent 3e76114, tree 56d34d2b…) | OpenAPI draft (x-status: draft, NO codegen), dependency-free contract module, fixtures, contract tests, unwired shells | patch sha256 528b9bac… |
| **7009ce66d7c6c888592279ce0f0ff3d9af023d11** (parent 2dc23539, tree 91518027…) | **Demo wiring — fixture data only**: /comfort-demo harness (client consent-first editor + provider booking simulation via pure projection mirror); shell initial-value props; route added in App.tsx; copy audit extended to demo files | patch sha256 ce572c77…3f03 (/app/repo_audit/new_candidates/phase4c-demo-wiring.patch) |

Exact files changed by 7009ce66 (6 files, +440/−7):
- artifacts/web/src/pages/comfort/comfort-demo.tsx (new)
- artifacts/web/src/pages/comfort/comfort-demo-data.ts (new; demo-only projection mirror, deleted at C-2/C-3)
- artifacts/web/src/pages/comfort/comfort-preferences-shell.tsx (initialPreferences/initialVisibility props)
- artifacts/web/src/App.tsx (+/comfort-demo route)
- artifacts/api-server/src/__tests__/comfort-profile.contract.test.ts (copy audit scans demo files)
- docs/comfort-profile/WIRING_NOTES.md (demo harness documented)

Guardrails held: OpenAPI still draft, NO codegen, NO schema/migrations/storage/persistence/production events;
consent-first + "matches your preferences" wording preserved; pnpm-lock.yaml untouched (sha c526b2bb… unchanged).

Test evidence for the wiring:
- Contract tests: 38/38 PASS (incl. extended copy audit)
- Regression suite (booking state machine): 63/63 PASS
- Workspace typecheck EXIT=0; web build EXIT=0
- Independent testing agent (browser automation via preview URL): **12/12 scenarios PASS, 0 issues**
  (consent-first lock/unlock; per-category visibility incl. visit-note default-hidden; booking-status gating
  requested/completed dark vs confirmed/en_route/in_progress visible; ownership gating; immediate + reversible
  withdrawal with data retained; sample fixture load; delete/reset; 280-char cap; zero forbidden medical phrases)
  Report: /app/test_reports/iteration_1.json
- Demo live at https://market-foot-staging.preview.emergentagent.com/comfort-demo
  (Vite dev server on port 3000; supervisor template frontend intentionally stopped for this session)

## 4. PUBLICATION-READY BUT BLOCKED
- A′ as-is (parent = live main). C′/B′ as evidence pending re-derivation per sequencing.
- Phase 4C commits (2dc23539, 7009ce66) are LOCAL review candidates only — not queued for publication.

## 5. MISSING EVIDENCE (external; blocks any push — cannot be inferred from anonymous access or commit metadata)
1. Detailed main branch-protection export (authenticated owner read). REQUIRED BEFORE A′.
2. Audit-log export 16:35Z → ≥21:40Z incl. OWNER attribution of conflict_100826_1415 / _1543 / _1738
   (commit metadata explicitly NOT accepted as attribution). REQUIRED BEFORE A′.
3. Managed Gate B (runtime-injected DATABASE_URL) — blocks Phase 4C step C-1 (schema/codegen); not claimed passed.
4. Pinned Gate A cleanup script — cleanup stays blocked.
5. Per-candidate publication approvals + one bounded write credential per window (none created this session).

## 6. PROHIBITIONS HONORED
No push/merge/delete/rebase; no bounded write window; all 19 conflict branches untouched;
no schema/migrations/storage/production events; economics not implemented; Gate B not claimed;
no remote log edits. Worktree clean at 7009ce66 after independent testing.
