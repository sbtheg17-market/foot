# SETUP — One-Task → One-Patch Workflow

Every approved task ends in: **1 commit, 1 patch file, tests run and recorded, patch published**
(upload to Replit / attach to the coordination channel). Future agents MUST follow this flow.

---

## 0. Ground rules

- One approved task per commit per patch. Never mix tasks.
- Append-only history: never rewrite, squash, or discard existing commits/branches.
- Task patches MUST NOT include: `.env` files, secrets, tokens, lockfile churn unrelated to the
  task, generated noise, or `node_modules`.
- Record every task in `.agents/LOG.md` (what/evidence) and keep `.agents/NEXT_TASK.md` current.
- Patches live in `patches/` at the repo root.

## 1. Work the task

Make the change for a SINGLE task. Run the checks that apply:

```bash
# JS/monorepo (OnCall Foot):
corepack pnpm install --frozen-lockfile
pnpm test                      # or targeted workspace tests
pnpm web:dev                   # UI sanity check

# This checkout (FARM template):
#   frontend hot-reloads under supervisor; check logs:
tail -n 50 /var/log/supervisor/frontend.err.log
#   run/record automated verification (see test_reports/)
```

Record results (pass counts, report paths) in `.agents/LOG.md`.

## 2. Commit — one task, clear message

```bash
git status                     # verify ONLY the intended files changed
git add <files>                # docs + code for that single task, nothing else
git commit -m "<Area> — <task summary>"
```

Message convention (`Area — summary`):

| Task | Commit message | Patch filename |
|---|---|---|
| Phase 4C restoration | `Phase 4C — restore contract + shell (design-only)` | `PHASE_4C_restoration.patch` |
| Comfort Profile API | `Phase 4C — Comfort Profile API routes (consent-gated)` | `PHASE_4C_comfort-profile-api.patch` |
| Provider projection card | `Phase 4C — Provider projection card` | `PHASE_4C_provider-projection-card.patch` |
| Patient auth + logout | `Auth — patient sign-in + logout hardening` | `AUTH_patient-signin-logout.patch` |
| C-3 shell states | `C-3 — shell loading/error/unauthorized states` | `C3_shell-states.patch` |

## 3. Generate the patch from the commit

```bash
git format-patch -1 HEAD --stdout > patches/<NAME>.patch
git apply --stat patches/<NAME>.patch     # confirm exact file scope
```

Verify it applies cleanly on the pre-task baseline:

```bash
git worktree add /tmp/patch-verify <baseline-sha>
git -C /tmp/patch-verify apply --check patches/<NAME>.patch && echo OK
git worktree remove --force /tmp/patch-verify
```

## 4. Publish

- Upload `patches/<NAME>.patch` to Replit / the coordination channel (same as
  `C-prime-lockfile-reproducibility.patch`, `phase4c-nonschema-prep.patch`,
  `B-prime-provider-signout.patch`).
- Others reproduce with `git apply patches/<NAME>.patch` (or `git am` to keep authorship).
- Add a LOG entry: task, commit SHA, patch name, test evidence, approval note
  ("approved and logical — Fable/Replit signed log" per operator policy).

## 5. Repeat per approved task

Each Next Action Item is its own cycle: work → checks → commit → patch → verify → publish → log.

---

## Baseline notes for THIS checkout (do not repeat these caveats blindly)

- `9f9394f` is a platform auto-checkpoint (mixed template + Phase 4C snapshot). For patch
  construction it is HISTORICAL — the clean pair lives on branch
  `patch-build/phase4c-restoration`:
  - baseline `6582133` (template without Phase 4C artifacts)
  - task commit `c8a778f` (`Phase 4C — restore contract + shell (design-only)`)
  - product: `patches/PHASE_4C_restoration.patch` (6 files, verified clean-apply on baseline).
- Keep the `patch-build/*` branches — they are evidence, not clutter.
- `.env` files exist in the baseline commits of this local-only repo (non-secret dev defaults).
  They must still never appear in task patches.
