# 3. Current `.agents` state at main = `3e76114`

Byte-exact copies are in `verification/agents_snapshot/`. Integrity anchors (verify with `sha256sum` and `git ls-tree origin/main .agents/`):

| File | SHA-256 | Git blob SHA | Size |
|---|---|---|---|
| `.agents/LOG.md` | `0a675ad50fdc15ada975ca51eacf72d045ba39b0a24b34fe8efc6f78c0126ca5` | `34511a8f20efbc1f4a01291dbfdf261d73a73ca6` | 222,328 B / 2,231 lines |
| `.agents/NEXT_TASK.md` | `e3ce0c5311a37c2236f778f7bf5f2b744b1cb741f4873d54d305c4d05a293a73` | `4359053f15a50170940d93b0e0b7f5aa250d05ac` | 14,427 B / 244 lines |
| `.agents/AGENT-RULES.md` | `71c1f152eb5d186996838a2df72ebf4fb1b22bdd9bae1407c5df4d57339d7172` | `51e3b7740535797b475fb177cce50a58356603d8` | 3,296 B / 94 lines |
| `.agents/SETUP.md` | `ae877057c6d470b8deae46d6a9e294ee4dc9bafda4ee73a1842014cb27b7951c` | `174132cf566b436c06d65296ea29c01eaf51d0ab` | 6,169 B / 136 lines |

`.agents/memory/` (tree `f1751b7c734dc007ff6c6b100fc5f1cf603760fa`) additionally contains `MEMORY.md`, `drizzle-unique-error-wrapping.md`, `github-push-auth.md`, `workflow-bootstrap-resource-limits.md`.

## State summary (from the files themselves — the authoritative text is the snapshot)

- **LOG.md** ends its session ledger at **Session 062** (published as `3e76114`). Sessions 054–062 present exactly once each. **There is NO Session 063 entry anywhere in the published ledger** — the Session 063 traceability entry exists only inside the unpublished local candidate `eec0147` (not recoverable here).
- **NEXT_TASK.md** (Session 062 revision): canonical tip recorded as `c02a308` with the Session 062 docs commit as "next reviewed candidate" — consistent: that candidate landed as `3e76114`, the current tip. Records: publication chain, published candidates (Phase 4B `b3937a7`, review-gate flag `47df77e`, etc.), queued approved order (Phase 4C → provider economics → 4D–4G → mobile parity), the authorized-but-blocked conflict-cleanup order, and the permanent canonical handoff policy.
- **AGENT-RULES.md**: read-before-write; always append to LOG; API-contract-first (`lib/api-spec/openapi.yaml` + codegen); never edit generated files; prices in cents; strict booking-status transitions; **secrets never logged/printed/committed**; no Replit lock-in in app code; log portability.
- **SETUP.md**: Node 24+, pnpm 9.15.0 (see drift note in `04_…md`), PostgreSQL via host-managed `DATABASE_URL`, `JWT_SECRET` in secret manager only, verification command list, known limitations. Uploaded handoff files under `attached_assets/` stay out of Git history.

## Gate status as recorded at `3e76114`
- **Gate A** (conflict cleanup): BLOCKED — pinned cleanup script unrecovered; only a read-only 12-branch inventory pass was done (now stale; 18 branches exist).
- **Gate B** (managed DB): **UNVERIFIED** — managed-database catalog check environment-unavailable; no production event writes; no migrations.
- Publication channel: dedicated fail-closed MCP channel over a repo-scoped deploy key; key write access **revoked** after the Session 062 window; publication additionally requires an explicit operator-approved window (max 72h).
