# Backup/restore verification — pilot readiness

**Date:** 2026-08-26 · **Status: PASS (disposable local drill) · managed
database NOT accessed** (its backup schedule is documented procedure, gated by
`docs/managed-db-release-gate.md`).

## Test restore performed — 2026-08-26 (local PostgreSQL 15, seeded + smoke-test data)

| Step | Command | Result |
|---|---|---|
| Backup | `pg_dump -Fc oncallfoot > oncallfoot_backup.dump` | **181 ms**, 112 KB |
| Restore | `pg_restore -d restore_test oncallfoot_backup.dump` (fresh disposable DB) | **659 ms**, no errors |
| Integrity — row counts | per-table live-tuple counts, source vs restored | **all tables match** |
| Integrity — content | `md5(string_agg(id:status:scheduled_at ORDER BY id))` over `bookings` | **identical** (`30fcf5f6…94d2e`) |
| Cleanup | `DROP DATABASE restore_test` | done |

## Restore procedure (runbook)

```bash
# 1. Stop writes (stop the API service or enable maintenance mode).
# 2. Fresh target database:
createdb -h $HOST -U $USER oncallfoot_restore
# 3. Restore the latest custom-format dump:
pg_restore -h $HOST -U $USER -d oncallfoot_restore --no-owner /backups/<latest>.dump
# 4. Integrity spot-checks (counts + bookings checksum as above).
# 5. Point DATABASE_URL at the restored DB, restart the API, verify:
curl -fsS $BASE/api/healthz && <seeded admin login> && spot-check bookings.
```

## Backup schedule and provider

- **Pilot (managed host):** Railway PostgreSQL — enable/verify the platform's
  automated **daily** backups in the service settings (operator action; needs
  dashboard access — not performed from this session). Additionally take a
  manual `pg_dump -Fc` before each pilot week and before any migration, stored
  off-host.
- **Frozen migration artifacts** (`docs/migrations/*.sql`) are additive-only
  with **no DOWN by policy** — rollback is restore-based, which is exactly the
  path drilled above.

## RTO / RPO (pilot scale)

| Objective | Value | Basis |
|---|---|---|
| **RPO** | ≤ 24 h (daily backups); ≤ 1 h if the operator takes hourly manual dumps during active pilot weeks | backup cadence |
| **RTO** | ≤ 30 min end-to-end (dominated by provisioning + DNS/env changes; the data restore itself measured **< 1 s** at pilot scale, and stays seconds even at 100× pilot volume) | measured drill + managed-host provisioning allowance |

## Limits / honesty

- The drill ran against the **disposable local** database only.
- Managed-host backup settings and a managed-host restore drill remain an
  **operator action** (needs platform dashboard access) — do it once before
  pilot day 1 and append the dated result here.
