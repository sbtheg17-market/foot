# Gate B — Schema Migration AUTHORIZATION PACKET (prepared, NOT executed)

**Status: AWAITING EXPLICIT OPERATOR APPROVAL. Nothing has been written to the managed
database. This packet-prep session itself ran read-only and rolled back.**

## 1. Exact target (non-secret)

| Item | Value |
| --- | --- |
| Host | `aws-0-us-west-2.pooler.supabase.com` (session pooler; the tenant-specific endpoint discovered and verified during the labeled Run 2 diagnostic) |
| Port | `5432` |
| Database | `postgres` |
| Pooler tenant/user (non-secret part) | `postgres.uddbekcpnnszmplqkirl` |
| Rejected endpoint (will NOT be used) | `aws-1-us-west-2.pooler.supabase.com` — its pooler returned `FATAL: (ENOTFOUND) tenant/user … not found` |
| Direct host (will NOT be used) | IPv6-only; unreachable from this IPv4-only container |

## 2. Same-tenant confirmation

The target is the **same Supabase tenant verified in Run 2**: identical project ref
(`uddbekcpnnszmplqkirl`) in the pooler username, identical credentials (staged mode-600,
never printed), and Run 2's identity fingerprint from this exact endpoint: PostgreSQL
17.6, Supabase-managed markers 3/3 roles + 4/4 schemas, empty `public` schema (0/18).

## 3. Pinned schema provenance

| Item | Value |
| --- | --- |
| Git commit containing the pinned schema | `f17bdcec6e0f22ef37f37b2707cc73e7630788ad` (current `origin/main`) |
| Last commit that touched the schema dir | `d7a59998a0a2dc88ba5853f87852674d61b2fa97` (2026-08-09, "feat(db): add additive marketplace_events log (Provider Activation Phase 1)") |
| Schema source path | `lib/db/src/schema/` (15 files: 14 table modules + `index.ts`) |
| Git tree hash of `lib/db/src/schema` at main | `2c5feac6160deee7c4ce13496b0304f02eec0ea0` |
| Source hash (sha256 of sorted concatenated `*.ts`) | `2af45e443ff41e61ada7b1a7d7f130e9ba5ca561b60ebe55856e64ba79aeec37` |
| Pinned table count | **18** |

The lost pinned verifier (`df1465bb…`) was NOT reconstructed or replaced; the hashes above
are new, clearly-labeled provenance for the schema source only.

## 4. Exact command (choose one — recommendation: Option B)

**Option A — repo-standard workflow:**
```bash
# from /app/work/repo, DATABASE_URL sourced from the mode-600 env file (never printed)
pnpm --filter @workspace/db run push        # = drizzle-kit push --config ./drizzle.config.ts
```
drizzle-kit push computes its own diff against the live (empty) DB at run time; on an
empty database it creates exactly the pinned objects, but the executed SQL is generated
at run time rather than being the reviewed artifact. The `push-force` variant will NOT be
used.

**Option B — plan-exact apply (RECOMMENDED):** execute the reviewed, hash-pinned SQL plan
byte-for-byte in ONE transaction via a psycopg2 runner:
```bash
# runner reads /app/memory/GATE_B_MIGRATION_PLAN.sql, verifies its SHA-256 equals
# f765cf97bde2c89bd49c3e33b93c4d8012206bcc9cb42d4569d502e80ec39f67 before executing,
# runs it in a single transaction (auto-rollback on any error), then re-runs the
# read-only catalog check.
```
Guarantees the executed SQL is exactly what was reviewed.

## 5. Generated SQL plan (complete, offline-generated — no DB connection was made to produce it)

| Item | Value |
| --- | --- |
| Plan file | `/app/memory/GATE_B_MIGRATION_PLAN.sql` |
| Plan SHA-256 | `f765cf97bde2c89bd49c3e33b93c4d8012206bcc9cb42d4569d502e80ec39f67` |
| Generator | `drizzle-kit generate --dialect postgresql --schema ./src/schema/index.ts` (drizzle-kit 0.31.x, local only; output directed outside the repo — zero repo files changed) |

## 6. Objects to be created (nothing else)

| Object type | Count |
| --- | --- |
| `CREATE TABLE` | **18** — account_roles, availability, bookings, invoices, marketplace_events, provider_application_events, provider_application_submissions, provider_applications, provider_notifications, provider_profiles, push_tokens, reviews, services, support_messages, support_tickets, travel_zones, users, verification_docs |
| `CREATE TYPE` (enums) | 14 |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | 12 (all defined in the pinned schema — none is the future Race-Proof partial unique index, which stays a separate task) |
| `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` | 34 |

## 7. Destructive-statement audit

`DROP` / `ALTER … DROP` / `TRUNCATE` / `DELETE` statements in the plan: **0**.
No existing objects will be dropped or altered — and the live target contains no
OnCall Foot objects to drop (verified empty in Run 2).

## 8. Writability confirmation (verified read-only, this session)

- Server `default_transaction_read_only = off` — Run 2's read-only state was **client-forced only**
- `pg_is_in_recovery() = false` (primary, writable)
- `has_schema_privilege(current_user,'public','CREATE') = true`
- `has_database_privilege(current_user,'postgres','CREATE') = true`

## 9. Scope guarantees

- No application files change. No repo schema files change. No commits to the repo.
- No seed data. No RLS changes. No auth configuration. No extra extensions.
- No unrelated indexes — the Race-Proof partial unique index is explicitly EXCLUDED
  (separate reviewed task after Gate B clears).
- Expected resulting table count in `public`: **18**.
- After execution: re-run the read-only catalog verification; Gate B is recorded as
  CLEARED only on an actual 18/18 result — no fabricated PASS.

**EXECUTION BLOCKED until explicit approval of this packet (and choice of Option A or B).**
