# Proposed artifacts — demo flag + admin audit log (2026-09-27)

**Status: PROPOSED — NOT APPLIED. No DDL or DML has been run against any
database.** These three files are frozen for review under
`docs/managed-db-release-gate.md` (Gate B). Applying any of them requires a
fresh, explicit, named operator approval that quotes the SHA-256 below.

| Artifact | Kind | Statements | SHA-256 (frozen bytes) |
|---|---|---|---|
| `USERS_IS_DEMO_V1.sql` | DDL, additive | `ALTER TABLE users ADD COLUMN is_demo boolean DEFAULT false NOT NULL`; partial index on `is_demo = true` | `0c4c6097d982dc24e833426a34ad164f9ed41b74a3d24f0c25b47f3549818f28` |
| `USERS_IS_DEMO_BACKFILL_V1.sql` | DML, idempotent, single transaction | `UPDATE users SET is_demo = true` for the fixed 6-address seed allowlist; verification `SELECT` | `e4e840ce1182c6386ea467825982d173870a2af86883cf75b5ccc06516f714a9` |
| `ADMIN_AUDIT_LOG_V1.sql` | DDL, additive | `CREATE TABLE admin_audit_log` (actor FK, action, target type/id, before/after jsonb summaries, created_at, two CHECKs); two indexes | `6d015f1daa858d1a72bf88f459d21e3dc1019185d5d6c62749e000d8161c43a9` |

Validation performed in this workspace: PostgreSQL grammar parse of every
statement (`pglast`, libpg_query) — **syntax only**. No local scratch
PostgreSQL was available, so the required disposable-database rehearsal is
still outstanding and must precede any managed apply (see checklist).

## Why

- **Demo data can never pose as real.** Today "demo" is a code-side e-mail
  allowlist (`lib/demo-data.ts` `DEMO_EMAILS`) consulted by `/admin/demo-data`,
  the `/admin` Demo tags and the provider scorecard `isDemo`. A flag on the row
  is queryable by every metric SQL, survives an e-mail change and lets a future
  admin mark a test account without a deploy.
- **Every admin action reviewable.** Credential reviews, support-ticket status
  changes, demo purges and system checks currently leave no trail beyond
  application logs. Application decisions are already in
  `provider_application_events`; the audit log complements, it does not
  replace, those domain histories.

## Design notes (what reviewers should check)

- `users.is_demo` has a constant default → PostgreSQL ≥ 11 stores it in the
  catalog; no table rewrite, no long lock on `users`.
- Partial index only over `true` rows: tiny, and exactly what
  `/admin/demo-data` and the metric exclusions filter on.
- Backfill list is byte-identical to `DEMO_EMAILS` plus the seed admin
  (`admin@oncallfoot.com`). It is a fixed list, never `LIKE '%oncallfoot%'`,
  so the owner's real account and real applicants cannot be caught.
- `admin_audit_log.target_id` is deliberately **not** a foreign key: a purged
  demo user or deleted ticket must keep its audit rows.
- `before_summary` / `after_summary` are written by the API from allowlisted
  projections (status fields, ids, counts). Reviewer-private notes, e-mail
  bodies and personal data are never stored here — that rule lives in the
  API write path and will be unit-tested when the write path is built.
- No enum for `action`: new admin actions must not require a migration. The
  API constrains the vocabulary; the CHECK only rejects blank strings.

## Sequencing after approval (each its own reviewed step)

1. Rehearse all three on a disposable local PostgreSQL (`db:push` a scratch
   schema, run the artifacts with `scripts/apply-frozen-migrations.py`, confirm
   `information_schema` shows the column/table, re-run the backfill to prove
   idempotence).
2. Apply `USERS_IS_DEMO_V1.sql` to the managed database (one transaction),
   then `USERS_IS_DEMO_BACKFILL_V1.sql`, then `ADMIN_AUDIT_LOG_V1.sql`.
   Record each hash in `APPLIED_LEDGER_*.md`.
3. **Only after step 2**: mirror the declarations in Drizzle
   (`lib/db/src/schema/users.ts` `isDemo`, new `admin-audit-log.ts`) — before
   any future `drizzle-kit push`, per the index-drop hazard rule. Declaring the
   column before it exists would break every `select()` on `users`.
4. Seed sets `is_demo = true`; `/admin/demo-data`, `/admin` Demo tags and
   `/providers/me/scorecard` `isDemo` switch from `DEMO_EMAILS` to the flag;
   `system-status.ts` gains probes for the two new artifacts.
5. Audit-log write path: `PATCH /admin/verification/docs/:id`,
   `PATCH /support/escalations/:id`, `POST /admin/demo-data/purge`, and the
   application approve/reject routes write one row each inside their existing
   transaction; read-only feed `GET /admin/audit-log` (admin-gated, no notes).
6. `docs/metrics-definitions.md` (written now) gains the `is_demo` exclusion
   clause in every SQL once the flag exists.

## Hard rules restated

- Never re-run an artifact whose hash differs from this table.
- Any `DROP`, rename or type change is a hard stop — not in scope here.
- The operator runs the managed apply; agents rehearse locally only.
