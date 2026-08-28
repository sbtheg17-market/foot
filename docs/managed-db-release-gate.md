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

## Artifact addendum — 2026-08-26 (roadmap #13)

`docs/migrations/CANCELLATION_NO_SHOW_SUPPORT_V1.sql` joins the frozen
additive artifact set (one enum, one append-only table + index, three nullable
`bookings` columns, one nullable `support_tickets.booking_id` FK). Additive
only, no DOWN, never auto-applied; validated against disposable PostgreSQL
(push ×2 idempotent, seed ×2, startup, destructive-DDL scan). All gate
requirements and blockers above remain unchanged; the managed database was
not accessed.

## Artifact addendum — 2026-08-28 (provider onboarding recovery)

`docs/migrations/PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` joins the
frozen additive artifact set. The onboarding schema audit found that the
schema-defined `provider_applications.rejection_reason` column (selected by
the owner `/providers/application*` routes) had no frozen artifact at all —
so under Gate B it would never reach the managed database. The artifact adds
one nullable text column, additive only, no `IF NOT EXISTS` (drift fails
loudly per policy), no DOWN, never auto-applied. Validated against disposable
PostgreSQL (push ×2 idempotent, seed ×2, fresh apply PASS, re-apply fails
loudly as expected, column type/nullability matches the schema).
`sha256sum` at the reviewed checkout:
`dc978ccac702affed54c95449a06ed43b30e913a8583208d263d359a9c36f06b`.
All gate requirements and blockers above remain unchanged; the managed
database was not accessed.

## Artifact addendum — 2026-08-28 (pilot operations dashboard, Part 1)

`docs/migrations/PILOT_PROVIDER_RETENTION_V1.sql` joins the frozen additive
artifact set: one new enum (`pilot_retention_intent`) and one new table
(`pilot_provider_retention`, unique provider FK + admin actor FK, no cascade
delete). Additive only, no `IF NOT EXISTS` (drift fails loudly per policy),
no DOWN, never auto-applied. Validated against disposable PostgreSQL
(fresh apply PASS, re-apply fails loudly as expected, `db:push` ×2
idempotent, seed ×2, table shape matches the Drizzle schema). `sha256sum` at
the reviewed checkout:
`ceaac6d50e6336fe4c13281ab7de5fc36eca7d96262a771c16a3f8647bf90cad`.
All gate requirements and blockers above remain unchanged; the managed
database was not accessed.

## Preflight verification record — 2026-08-28 (provider return-path Gate-B artifacts)

A repository-side preflight for the provider return-path Gate-B release was
completed at the verified `origin/main` commit
`98a1811c3d379d8d11c575218843ce65cda06ba4` (clean tree; CI 16/16 green on
that SHA; PR #69 merged — the owner status reads are now drift-safe, so
applying these artifacts completes booking-page/service-area/rejected-
resubmission functionality rather than recovering from a crash).

### Artifact hash addendum — booking pages and service areas

`PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql` and `PROVIDER_SERVICE_AREAS_V1.sql`
were frozen (roadmap items #11/#12) without a recorded reference hash — a
gap found by this preflight: hash verification against this document was
impossible for them. Recorded now, recomputed at the reviewed checkout:

```text
PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql  139d6b41430d7110d481e3ec3257d9544cdcbfb5f2474f51ea16e411a0ac34dc
PROVIDER_SERVICE_AREAS_V1.sql         07031aa88d454c7e1f0a5502433ac25e1f5680977984bdd3d66733957396b633
```

SQL review of the exact bytes: both remain additive-only (three nullable/
defaulted `provider_profiles` columns + one unique index + one nullable
`bookings.source` column; two new tables with their indexes). No destructive
operations, no `IF NOT EXISTS` (drift fails loudly per policy), no DOWN
(rollback is restore-based per policy). The three provider return-path
artifacts (`PROVIDER_APPLICATION_REJECTION_REASON_V1.sql`,
`PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql`, `PROVIDER_SERVICE_AREAS_V1.sql`) are
mutually independent; the documented application order is
rejection-reason → booking-pages → service-areas.

### Full frozen-artifact inventory recomputed at `98a1811`

Every value previously documented in this file matches its recomputation;
the remaining artifacts are recorded here so future preflights can verify
all ten against documentation:

```text
CANCELLATION_NO_SHOW_SUPPORT_V1.sql           b6f253c1e5917ffa0e7cdc038486c5d16fb6cdc04d1f8b6772cb003ea11c8a2b
PILOT_PROVIDER_RETENTION_V1.sql               ceaac6d50e6336fe4c13281ab7de5fc36eca7d96262a771c16a3f8647bf90cad
PREVENTED_BOOKINGS_DAILY_V1.sql               c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876
PREVENTED_BOOKING_RECORDS_V1.sql              138982a19c7427044dfea167ffdbbcc72e6647130cc565f1d23621aef70e29ce
PROVIDER_APPLICATION_REJECTION_REASON_V1.sql  dc978ccac702affed54c95449a06ed43b30e913a8583208d263d359a9c36f06b
PROVIDER_BLOCKED_RANGES_V1.sql                820c079ebc7ed6bb979b0b5b0ff5b853164be16d24e7d68b70ba564dbe79469f
PROVIDER_EMERGENCY_OPENINGS_V1.sql            9c903becb3ac436687b2de347fb48216c2ba611b82cfa7c8ac6c9928e7280622
PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql          139d6b41430d7110d481e3ec3257d9544cdcbfb5f2474f51ea16e411a0ac34dc
PROVIDER_SERVICE_AREAS_V1.sql                 07031aa88d454c7e1f0a5502433ac25e1f5680977984bdd3d66733957396b633
RESCHEDULE_PROPOSALS_HISTORY_V1.sql           b8a8c5c7facf6dc01ce893360efe28b8fd6a7036847433f3abece308a6bc1ba5
```

### Repository fingerprint at `98a1811`

The documented fingerprint procedure at this checkout produced:

```text
lib/db/src/schema/*.ts aggregate SHA-256
b2c79051522f5182791efbfdd5ba16995a1138117f0cae35a1c2d0ea1a0a3731
```

The `d3a6d7d` baseline above remains the historical audit record; the
difference is the legitimately merged schema growth since 2026-08-22
(cancellation/no-show, emergency openings, blocked ranges, pilot retention).
As before, this is repository evidence only, not proof of production parity.

### Release blockers recorded — production remains BLOCKED

- Managed target: **NOT IDENTIFIED.** The preflight environment has no
  operator access; credentials were not requested, accepted, stored, or
  committed, per policy.
- Backup/recovery evidence: **NOT CONFIRMED.** Every control in
  `docs/backup-restore-runbook.md` remains `TBD` and no fresh recovery point
  is confirmed; per that runbook, no managed schema release is ready.
- Approval record: the product owner is the named release approver and the
  future production operator (working in Railway directly). **No migration
  authorization and no deployment authorization has been granted.**
- Dry-run/staging target: none identified.
- Managed catalog state: **UNKNOWN** — no authorized read-only catalog check
  has occurred; which artifacts are already applied cannot be known.

No managed database was accessed, no SQL was applied to any non-disposable
target, and no production deployment occurred during this preflight. The
default outcome remains `No migration applied.`
