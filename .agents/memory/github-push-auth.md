---
name: GitHub push authentication
description: Environment-specific behavior when pushing the repository's main branch to GitHub
---

GitHub read access and write access are separate. Direct `git push origin main` may report `Invalid username or token` when the current account is not authenticated or lacks write permission, even though `git fetch` and `git ls-remote` work. A managed environment may also advance `origin/main` asynchronously after a push callback, and the managed GitHub push callback can fail before running if its durable worker cannot spawn.

**Why:** The repository requires checkpoint synchronization, but neither failure is an application or Git-history problem, and retrying with guessed credentials is unsafe.

**How to apply:** Treat GitHub account authorization as external to the repo: reconnect the account or use a fork with a pull request. Before a new documentation publication, fetch and base the branch on the latest authoritative `origin/main`; preserve local commits, do not create duplicate commits just to retry publication, force-push, or rewrite history; re-check local/remote hashes and ahead-behind after a reported failure, and only retry after confirming the remote did not advance.