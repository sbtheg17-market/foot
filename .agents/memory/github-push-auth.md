---
name: GitHub push authentication
description: Environment-specific behavior when pushing the repository's main branch to GitHub
---

Direct `git push origin main` may fail with GitHub's `Invalid username or token` when the workspace credential is unavailable or stale. The managed GitHub push callback can also fail before running if its durable worker cannot spawn.

**Why:** The repository requires checkpoint synchronization, but neither failure is an application or Git-history problem, and retrying with guessed credentials is unsafe.

**How to apply:** Preserve the local commits, do not force-push or rewrite history, report the exact local and remote hashes, and retry only after authenticated GitHub access or worker availability is restored.