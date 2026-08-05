---
name: Workflow bootstrap resource limits
description: Replit-managed pnpm bootstrap failures that prevent artifact workflows from starting
---

The managed artifact workflows can fail before application startup when their pnpm version bootstrap recursively spawns child pnpm processes and exhausts the workspace thread/process limit.

**Why:** This failure presents as a workflow crash even though the application code is not being executed; repeated restarts only reproduce the resource exhaustion.

**How to apply:** Check workflow logs for `pthread_create: Resource temporarily unavailable` and repeated `pnpm add pnpm@...` processes before changing application code. Stop the recursive process tree or wait for the environment to recover, then restart once. Record the limitation separately from application verification.