# Recovered evidence — extraction record

All files below were extracted **read-only** from archival snapshot branches of
`sbtheg17-market/foot` on 2026-08-10 (takeover container). No branch was modified.
Every file was secret-scanned before inclusion: **no credential, token, key, or
connection string present** (the audit export contains only GitHub-hashed token
fingerprints, which are non-reversible metadata).

| File | Source (branch:path) | SHA-256 (verified) |
|---|---|---|
| `patches/session-063-traceability.patch` | conflict_100826_1543:memory/patches/… | `290fa5099d46bc9f536561e77fca8c7750eae668aa52f4df1a242ab1e550dcbe` — matches handoff prefix `290fa509…` |
| `patches/provider-signout.patch` | conflict_100826_1543:memory/patches/… | `2b4ee109aa295f3f387c74bc8f1f9a70b2ec18e316df87f4b24c0939978817bb` — matches `2b4ee109…` |
| `patches/PROVIDER_SIGNOUT_EVIDENCE.md` | conflict_100826_1543:memory/patches/… | `1bdb779bf3ab2f8b774fa6991e31360eb6af03a11c676334b526d13751994f63` |
| `contracts/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` | conflict_100826_1543:memory/contracts/… | `339a03e6bb2c7aab6cee7306bb1daff43003a46c6edbbf16f2ed77c2d5fe4a4f` — EXACT match to Session 063 record |
| `contracts/PROVIDER_ECONOMICS_CONTRACT_V3.md` | conflict_100826_1543:memory/contracts/… | `2172f6cf08bd1a86a15c6d140ff8f591941a80311ef496fd62f98f2a68ceec61` — EXACT match |
| `evidence/bootstrap_report.md` | conflict_100826_1543:memory/bootstrap_report.md | (informational) |
| `evidence/REMOTE_INVENTORY_2026-08-10T19Z.txt` | conflict_100826_1543:memory/handoff/… | (informational) |
| `evidence/CONFLICT_BRANCH_INVENTORY_V4_2026-08-10.md` | conflict_100826_1415:memory/evidence/… | matches its recorded `.sha256` companion |
| `evidence/GATE_A_REPORT_2026-08-10.txt` | conflict_100826_1415:memory/evidence/… | matches companion |
| `evidence/REMOTE_INVENTORY_2026-08-10T17Z.txt` | conflict_100826_1415:memory/evidence/… | matches companion |
| `evidence/POSTCONTAINMENT_INVENTORY_2026-08-10.txt` | conflict_100826_1415:memory/evidence/… | (informational) |
| `evidence/export-sbtheg17-market.ndjson` | conflict_100826_1415:memory/evidence/export-sbtheg17-market.json.gz (decompressed) | GitHub security log, 306 events, coverage ends 2026-08-10T13:15:16Z |
| `governance/FOOT_GOVERNANCE_SESSION_LEDGER.md` | conflict_100826_1415:memory/… | ledger v1, entry 11 |
| `governance/DEPLOY_KEY_DELETION_EVIDENCE.md` | conflict_100826_1415:memory/… | — |
| `governance/CONTAINMENT_ADMIN_RUNBOOK.md` | conflict_100826_1415:memory/… | — |
| `governance/HANDOFF_ENVIRONMENT_MISMATCH.md` | conflict_100826_1415:memory/… | — |
| `governance/CONFLICT_CLEANUP_PLAN_V1_16BRANCH.md` | conflict_100826_1415:memory/… | matches companion — **INVALIDATED by 18-branch discovery; cleanup paused** |
| `governance/DELETION_REQUEST_DRAFT_V1.md` | conflict_100826_1415:memory/… | **MISMATCH vs its recorded companion checksum** (edited after checksumming) — flagged; moot while cleanup paused |
| `governance/GATE_A_READONLY_AUDIT_PROCEDURE.md` | conflict_100826_1415:memory/… | — |

Usage rule: recovered patches/contracts are **review evidence and content source** for the
newly derived candidates. The retired identities `eec0147…` / `0c216d6…` are recorded as
historical facts embedded in the artifacts; no continuity or byte identity is claimed for
any new commit object.
