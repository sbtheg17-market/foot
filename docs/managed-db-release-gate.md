# Managed Database Release Gate

This gate controls every schema change to the managed production database.
It is a release procedure, not an authorization to run a migration. A
documented procedure never replaces explicit operator approval.

## Environment boundaries

| Environment | Purpose | Allowed database actions |
|---|---|---|
| Local scratch | Disposable development and tests | `db:push`, frozen-artifact rehearsal, seed, and destructive reset are allowed only against an explicitly disposable local database |
| Staging | Release rehearsal | Read-only catalog checks and an approved rehearsal may be performed against the identified staging target; production credentials and data must not be used |
| Managed production | Live customer data | No schema write, replay, projection rebuild, backup, or restore without the gates in this document and the backup/restore runbook |

Never infer a managed target from a local `.env`, a hostname, a project name,
or a previously used connection string. Credentials stay in the host secret
manager and are supplied only to the operator's process.

## Canonical repository evidence

- Repository: `sbtheg17-market/foot`
- Schema entry point: `lib/db/src/schema/index.ts`
- Schema modules: `lib/db/src/schema/*.ts`
- Drizzle configuration: `lib/db/drizzle.config.ts`
- Frozen artifacts:
  - `docs/migrations/PREVENTED_BOOKING_RECORDS_V1.sql`
  - `docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql`
- There is currently no committed Drizzle migration-history directory or
  migration journal. `db:push` is a local scratch-only tool.

### Final audit baseline

The final documentation audit used the verified current `origin/main` commit
`d3a6d7dbcf707b0173617d7a01f35f7501b5f2fa` on 2026-08-22. The repository
fingerprint procedure below produced this aggregate source-file fingerprint:

```text
lib/db/src/schema/*.ts aggregate SHA-256
8e69085fda8280e511483990d6c24653831252fa0541de990d7288ca238024d8
```

The aggregate is reproducible from the sorted relative file list and exact
file bytes. Individual source hashes are retained in the audit record; the
aggregate is not a semantic manifest and is not evidence of production parity.

The frozen artifact hashes must be recomputed from the reviewed checkout, not
copied from chat or an old report:

```bash
sha256sum docs/migrations/PREVENTED_BOOKING_RECORDS_V1.sql
sha256sum docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql
```

The current repository evidence records these values:

```text
PREVENTED_BOOKING_RECORDS_V1.sql  138982a19c7427044dfea167ffdbbcc72e6647130cc565f1d23621aef70e29ce
PREVENTED_BOOKINGS_DAILY_V1.sql   c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876
```

## Schema manifest procedure

The repository does not yet contain a canonical semantic schema manifest.
Until one is explicitly reviewed and committed, use this procedure as
repository evidence only. It must not be reported as proof that production
matches.

### Source and normalization

1. Check out the exact approved commit. Record only its commit SHA.
2. Use the relative paths under `lib/db/src/schema/`, sorted
   lexicographically.
3. Read files as UTF-8 with LF line endings. Do not remove comments, reorder
   declarations, evaluate environment values, or include generated output.
   This is an exact source fingerprint, not a guessed semantic parser.
4. Separately hash the frozen SQL artifacts. Do not mix environment-specific
   metadata, database hostnames, usernames, passwords, query parameters,
   row contents, physical storage identifiers, statistics, or timestamps into
   the fingerprint.

### Fingerprint command

Run from the repository root on the approved commit:

```bash
git rev-parse HEAD
find lib/db/src/schema -type f -name '*.ts' -print0 \
  | sort -z \
  | xargs -0 sha256sum \
  | sha256sum
sha256sum docs/migrations/PREVENTED_BOOKING_RECORDS_V1.sql
sha256sum docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql
```

The first hash is a deterministic fingerprint of the source-file list,
relative paths, and exact file bytes. Record the individual file hashes as
the review artifact so a changed file can be identified. A future semantic
manifest may additionally serialize, in stable order, every declared table,
column, enum/value, constraint, index/predicate, uniqueness attribute, and
foreign key. That generator requires its own review; do not invent a
semantic fingerprint by hand.

### Read-only managed comparison

After separate authorization, compare the manifest against a read-only
catalog export for the confirmed target. The comparison must cover:

- table names and schemas;
- column names, order, types, nullability, and defaults;
- enum names and ordered labels;
- primary keys, unique constraints, checks, and foreign keys, including
  names and delete behavior;
- index names, tables, columns/order, predicates, uniqueness, and validity;
- the migration-history relation, if the target has one;
- projection presence and row counts only where the approved check requires
  them.

The export and report must omit connection strings, credentials, row contents,
and environment-specific physical metadata. Any mismatch or ambiguous target
is a hard stop.

## Required preflight

The release owner must capture a review record containing:

- reviewed commit SHA and artifact hashes;
- target class (`staging` or `managed production`);
- target fingerprint derived without exposing credentials;
- named operator, approver, and change window;
- backup/recovery evidence from `docs/backup-restore-runbook.md`;
- ordered artifact list and dependency review;
- SQL review result, including destructive-operation review;
- dry-run output and expected counts;
- application compatibility result;
- abort conditions and stop owner.

Preflight must fail if the target cannot be identified, the artifact hash
differs, an expected object already exists unexpectedly, backup evidence is
missing, the dry-run is not clean, or approval is incomplete.

## Migration inventory and rollback status

| Artifact | Operation | Dependency/order | Managed status | Rollback |
|---|---|---|---|---|
| `PREVENTED_BOOKING_RECORDS_V1.sql` | Add enum, table, two indexes; one transaction; additive-only | First; source for the daily projection | Unknown until a fresh authorized catalog check | No automated DOWN; backup restore or reviewed forward-fix |
| `PREVENTED_BOOKINGS_DAILY_V1.sql` | Add projection table with CHECK and `UNIQUE NULLS NOT DISTINCT`; one transaction; additive-only | Second; requires the records source; PostgreSQL 15+ | Unknown until a fresh authorized catalog check | No automated DOWN; projection can be transactionally rebuilt from its source, while schema recovery is backup restore or reviewed forward-fix |

The artifacts intentionally have no `IF NOT EXISTS`, so drift fails loudly.
Do not add untested rollback SQL. Do not run either artifact through
`drizzle-kit push`.

## Required-index audit

The repository declaration audit found the following correctness-relevant
index evidence:

| Correctness concern | Repository definition | Current managed result |
|---|---|---|
| Active-booking uniqueness | Exact declaration is `bookings_active_booking_unique_idx` on `public.bookings (client_id, provider_id, service_id, scheduled_at)` with predicate `status IN ('requested','confirmed','rescheduled')`; unique | `NOT VERIFIED` — managed catalog access was not authorized |
| Provider overlap/availability | No dedicated provider overlap or availability index is declared. Application correctness uses provider-scoped availability reads and overlap predicates under a provider advisory lock; this is not a database-index substitute | `NOT VERIFIED` — managed query plan/catalog review unavailable |
| Prevented-record uniqueness | `prevented_booking_records_correlation_unique_idx` on the server-generated correlation identifier; additive frozen artifact | `NOT VERIFIED` |
| Projection grain uniqueness | `prevented_bookings_daily_grain_unique` with `UNIQUE NULLS NOT DISTINCT` over marketplace, nullable provider/service, and UTC day; additive frozen artifact | `NOT VERIFIED` |
| Foreign-key support indexes | No blanket FK-support index set is declared; each FK and workload path requires a target-specific catalog/performance review | `NOT VERIFIED` |

The requested active-booking invariant is therefore repository-verified under
the exact snake-case name above. It must be compared by full definition,
predicate, uniqueness, and validity—not by a normalized or shortened name.
No index was created, altered, dropped, or renamed by this audit.

## Controlled application

The only permitted production sequence is:

1. **Preflight** — verify commit, hashes, target class, target fingerprint,
   dependency order, and approval record.
2. **Backup confirmation** — complete the pre-migration recovery point and
   verification required by the backup/restore runbook.
3. **SQL review** — review the exact bytes, transaction behavior, object
   footprint, compatibility, and absence/presence of destructive operations.
4. **Dry-run** — use an approved staging target or the artifact's read-only
   preflight procedure. Capture the output without credentials or row data.
5. **Explicit approval** — the named approver authorizes the exact artifact
   hashes, target fingerprint, scope, and one-run window.
6. **Controlled apply** — run exactly once with `psql --set ON_ERROR_STOP=1`
   and a single transaction, using the secret manager's private environment.
7. **Immediate verification** — run the read-only checks below and the
   application health check.
8. **Release decision** — release only if every check passes; otherwise stop,
   preserve logs, and use the documented recovery decision.

The application must not start by pushing schema. Current startup uses
`pnpm run start`; `Procfile`, `nixpacks.toml`, and `railway.json` must remain
free of `drizzle-kit push`, `drizzle-kit migrate`, and implicit DDL.

## Post-application verification

Check, without writes:

- expected tables, columns, defaults, enums, constraints, and foreign keys;
- exact index definitions, predicates, uniqueness, and validity;
- expected projection/source relationship and approved row-count checks;
- schema manifest and frozen-artifact hashes;
- migration/application output and target fingerprint;
- `/api/healthz` and an application smoke check;
- the active-booking invariant: identical active booking tuples cannot be
  committed concurrently;
- no unexpected catalog objects or schema drift.

Any failed or unavailable check means **do not release**. A partially applied
transaction should be treated as failed and investigated; do not retry without
fresh authorization.

## Abort conditions

Stop before any write when:

- target identity or environment class is ambiguous;
- the commit or artifact hash does not match the approval record;
- backup, restore, RPO, or RTO evidence is missing;
- SQL contains an unreviewed destructive operation;
- an expected object already exists or differs;
- the dry-run is unavailable or reports unexpected work;
- explicit approval is missing or covers a different target/scope;
- application compatibility is unknown;
- credentials appear in logs, output, reports, or shell history.

## Current disposition

This document records procedure readiness only. Against final audit baseline
`d3a6d7dbcf707b0173617d7a01f35f7501b5f2fa`, the repository fingerprint and
frozen artifact hashes are recorded, but the current managed catalog, managed
migration history, backup/restore readiness, and production schema match remain
**BLOCKED / NOT VERIFIED**. Production deployment and schema application are
**NOT AUTHORIZED**. The default outcome is `No migration applied.`
