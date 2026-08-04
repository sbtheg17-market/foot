# Commit Strategy — OnCall Foot

This document captures the project's preferred commit and sync rhythm, stated by the project owner.

---

## Guiding Principle

> Push in small, checkpoint-sized commits so each merge is easy to review and GitHub stays in sync.

Never let Replit build several checkpoints locally without pushing. GitHub is the sync anchor after every meaningful checkpoint.

---

## The Cycle

1. Complete **one logical checkpoint** of work.
2. Review the diff immediately.
3. Commit and push that checkpoint to `origin/main` (or the active branch).
4. Pull/fetch the latest in any other environment.
5. Start the next checkpoint from the synced state.

---

## Commit Rules

1. Do not wait until the whole repo is finished before pushing.
2. After each completed checkpoint, prepare a clean git commit.
3. Keep each commit focused on **one logical unit of work**.
4. Before moving to the next checkpoint, confirm the repo is in a clean state.
5. Do not make large unrelated refactors in the same commit as feature work.
6. If a checkpoint touches shared structure, split that cleanup into its own commit first, then the feature commit.
7. Preserve a smooth merge path with GitHub by keeping commits small and reviewable.
8. If anything is risky to merge, explain it before committing.

---

## Suggested Commit Order (for a typical feature)

| Commit | Content |
|---|---|
| 1 | Shared refactor / route restructure / RBAC scaffolding |
| 2 | Feature checkpoint — UI |
| 3 | Related backend logic |
| 4 | Polish or bug fixes |

If a checkpoint is large, split it into:
- backend/model changes
- frontend changes
- tests or cleanup

---

## Before Every Commit

- Show changed files before committing
- Write commit messages that answer *"What got better for the user?"* (see `docs/checkpoint-notes-guide.md`)
- Avoid unrelated formatting changes in the same commit as feature work
- Preserve one clean branch for the provider build

---

## Project-Specific Constraints

The following constraints apply until the owner lifts them:

- **Provider-first scope only** — do not build client or admin portals yet
- **No monetization UI** — Stripe Connect and subscriptions are future work (see `docs/future-monetization.md`)
- **No new seed data** unless it is required for the current checkpoint
- **Separate refactors from feature work** — if a route restructure is needed, commit it alone first
- **Report broken references before changing them** — if you find a broken import or stale reference from a previous session, describe it before modifying it
