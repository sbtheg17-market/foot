# Takeover packet — `sbtheg17-market/foot`

Prepared 2026-08-10 (verification timestamp `verification/verified_at.txt`). Prepared by the incoming agent from **repository state + anonymous read-only GitHub verification only** — not from conversational memory. **Contains zero credentials, tokens, keys, connection strings, or secrets.** No push, merge, or remote mutation of any kind was performed.

## Contents
| File | Packet requirement |
|---|---|
| `00_TAKEOVER_RESPONSE.md` | Required first report of the new Neo: verified / accepted / unverifiable / local candidates / missing evidence / single safest next action + owner questions |
| `01_repository_identity.md` | (1) Identity, remote, main SHA, tree, clean/dirty status |
| `02_branch_inventory.md` | (2) Full conflict-branch inventory (**18 found vs 16 claimed** — reconciled), classifications, preserved exclusions |
| `03_agents_state.md` | (3) `.agents/*` state at `3e76114` with checksums; byte copies under `verification/agents_snapshot/` |
| `04_environment_and_baseline_tests.md` | (4) Environment/setup instructions + baseline test results (recorded vs independently re-run, honestly separated) |
| `05_missing_evidence.md` | (5) Branch-protection export, post-16:35Z audit export, managed Gate B — plus newly identified gaps |
| `06_candidate_inventory.md` | (6) Candidate inventory with every verifiable/unverifiable field flagged |
| `07_approvals_and_blocked_actions.md` | (7) Every pending approval and every explicitly non-authorized action |
| `08_next_actions.md` | (8) Exact next actions in priority order |
| `09_publication_drafts/` | Two SEPARATE publication drafts (A: Session 063 traceability, B: provider sign-out) — prepared, NOT executed, NOT approved |
| `verification/` | Machine-checkable evidence: refs snapshot, main commit record, `.agents` SHA-256 + blob SHAs, byte snapshots |

## How the new account verifies this packet against GitHub
```bash
git clone https://github.com/sbtheg17-market/foot && cd foot
git rev-parse origin/main                                  # 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
git ls-remote origin | sort -k2 | diff - ../handoff/verification/refs_snapshot.txt
sha256sum .agents/*.md | diff - ../handoff/verification/agents_sha256.txt
```
(Ref-list diffs after packet time are expected only as NEW `conflict_*` snapshots; `main` must not move except by an approved published draft.)

## Canonical rules carried forward
- `origin/main` of `https://github.com/sbtheg17-market/foot` is the only source of truth; conflict branches are archival only.
- One reviewed candidate at a time; fast-forward only; no push without a named approval and a fresh bounded write credential, revoked immediately after.
- Secrets live only in host secret managers; never in Git, logs, chat, or this packet.
