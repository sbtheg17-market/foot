# 1. Repository identity, remote, main SHA, tree, status

Verified 2026-08-10T19:55:14Z, anonymous HTTPS (no credentials).

| Field | Value |
|---|---|
| Repository | `sbtheg17-market/foot` (public) |
| Remote (canonical) | `https://github.com/sbtheg17-market/foot` |
| GitHub repo id | `1315350130` |
| Owner | `sbtheg17-market` (user id `310312689`) |
| Default branch (HEAD) | `main` |
| `refs/heads/main` | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` — **matches canonical baseline** |
| Parent of main tip | `c02a3080cb91c41066ac9e1e1ae39763abc7d73c` (Session 061 traceability) |
| Tree of main tip | `bc67dd6e281d3521d679c411fc70cdde6ab24a34` |
| Author/Committer | `emergent-agent-e1 <github@emergent.sh>`, 2026-08-10T02:48:54Z |
| Subject | `docs(traceability): Session 062 — …` (full text in `verification/main_commit.txt`) |
| Clone status | Fresh full clone at `3e76114`; `git status` **clean** (no local modifications) |
| Total remote refs | 19 branch refs + HEAD (1 `main` + 18 `conflict_*`); no tags |

Canonical recent chain (as recorded in the ledger and consistent with the live remote endpoints):
`… → b3937a7 → 83cf335 → 6aa4863 → 47df77e → c02a308 → 3e76114` — fast-forward only; no force-push observed (remote tip is a descendant of every recorded prior tip).

## Reproduce independently
```bash
git clone https://github.com/sbtheg17-market/foot
cd foot
git rev-parse origin/main                        # expect 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
git log origin/main -1 --format='%H %P %T'       # commit, parent c02a308…, tree bc67dd6…
git ls-remote origin | sort -k2                  # compare to verification/refs_snapshot.txt
sha256sum .agents/LOG.md .agents/NEXT_TASK.md .agents/AGENT-RULES.md .agents/SETUP.md
                                                 # compare to verification/agents_sha256.txt
```

Note: the working workspace `/app` in this container is an unrelated fresh template repository (single commit `66e9b96`, no remote). It is NOT a clone of foot and holds no candidates, credentials, or prior session artifacts. The verification clone used for this packet lives at `/root/foot-verify` (read-only use).
