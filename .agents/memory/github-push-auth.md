---
name: GitHub push authentication
description: Environment-specific behavior when pushing the repository's main branch to GitHub
---

Direct `git push origin main` may report GitHub's `Invalid username or token` even when the managed environment later advances `origin/main` asynchronously to the pushed commit. The managed GitHub push callback can also fail before running if its durable worker cannot spawn.

**Why:** The repository requires checkpoint synchronization, but neither failure is an application or Git-history problem, and retrying with guessed credentials is unsafe.

**How to apply:** Preserve the local commits, do not force-push or rewrite history, re-check local/remote hashes and ahead-behind after a reported failure, and only retry after confirming the remote did not advance. Report the exact hashes.