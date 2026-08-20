# Projection Rebuild Runbook — `prevented_bookings_daily`

This runbook governs every execution of
`artifacts/api-server/src/scripts/rebuild-prevented-bookings-daily.ts`
against a production database. **Production rebuild is a separately
authorized, operator-confirmed, one-run-at-a-time operation.** Nothing in
this document authorizes an execution by itself, and nothing schedules the
script automatically.

The projection is rebuildable by design: it is never a source of truth,
never written by request paths, and never read in booking authorization
paths. Its ONLY source is `prevented_booking_records`, which the rebuild
reads with SELECT only — **zero source writes, ever**. Numbers derived from
the projection inherit the source label: *best-effort telemetry that may
undercount API 409 responses*. Per-path counts (`preflight_count`,
`index_violation_count`) are internal dimensions and are never exposed to
ordinary clients; any future client-facing endpoint may surface
`attempts_total` only.

---

## 1. What a rebuild does

One transaction, all-or-nothing:

1. `SET LOCAL TIME ZONE 'UTC'` — day bucketing can never drift with process
   or session timezone (day parameters travel as plain strings, never
   locale-dependent values).
2. **Tripwire** (before any write): `COUNT(*) = COUNT(DISTINCT
   correlation_id)` over the rebuilt range. The source is unique by
   `correlation_id` by construction; a violation means source corruption —
   the rebuild aborts with exit `1` and writes nothing.
3. `DELETE` the projection rows in scope (everything for a full rebuild;
   only the `day_utc` window for a bounded rebuild).
4. `INSERT … SELECT` the daily aggregation from the source, grouped by
   `(marketplace_id, provider_id, service_id, occurred_at::date)`, in
   deterministic grain order. Full rebuilds also restart the surrogate-id
   sequence inside the transaction, so repeated full rebuilds of identical
   source data produce identical rows.
5. **Reconciliation** (still inside the transaction):
   `SUM(attempts_total)` = source `COUNT(*)`, and the per-path sums equal
   the source per-path counts, over the rebuilt range. Any mismatch →
   `ROLLBACK`, exit `1`, projection unchanged.

There are deliberately **no replay-style write caps**: a rebuild is a
wholesale transactional replacement, not an event stream — capping it could
only produce a half-replaced projection.

## 2. Modes

- **Full rebuild** (default): replaces the entire projection.
- **Bounded rebuild** (`--from YYYY-MM-DD --to YYYY-MM-DD`, both required,
  inclusive UTC days): replaces only projection rows whose `day_utc` falls
  inside the window, from source rows whose `occurred_at` falls inside the
  same window. Rows outside the window are untouched.

## 3. Dry-run first (always)

```bash
DATABASE_URL=<target-from-secret-manager> \
pnpm --filter @workspace/api-server exec \
  node --import tsx/esm src/scripts/rebuild-prevented-bookings-daily.ts \
  --dry-run [--from YYYY-MM-DD --to YYYY-MM-DD]
```

The dry-run executes inside a `READ ONLY` transaction — the database itself
rejects any write — and reports, in a single `DRY RUN`-labeled summary line
(`evt: prevented_bookings_daily_rebuild_summary`): source rows,
distinct-correlation count, per-path source counts, `would_delete`,
`would_insert`, and the **`target_fingerprint`** — the first 12 hex
characters of `SHA-256("host:port/dbname")` derived from `DATABASE_URL`,
the same algorithm as the replay script. Username, password, query
parameters, and the raw URI are never part of the fingerprint input and
never appear in any output.

Review before requesting live authorization:

- `mode` is `DRY_RUN`; the log line says `DRY RUN`;
- `source_rows` equals `distinct_correlations` (tripwire clean — a dry-run
  that reports a tripwire failure exits `1` and must stop everything);
- `would_delete` / `would_insert` match expectations for the scope;
- `target_fingerprint` is the intended target.

## 4. Live execution confirmation (required authorization block)

A live run requires the operator to post this block, completely filled in,
in the authorization channel. There is no automatic approval mechanism and
nothing may bypass this step:

```text
PROJECTION REBUILD AUTHORIZATION — one run only
Scope:                 FULL | BOUNDED <from> .. <to>
Target fingerprint:    <12-hex from the dry-run summary>
Dry-run summary:       source_rows=<n> distinct_correlations=<n>
                       would_delete=<n> would_insert=<n>
Single-run rule:       this authorization covers exactly ONE execution.
No-retry rule:         if the run fails, DO NOT re-run without a fresh
                       authorization referencing the failure report.
Statement:             production rebuild is authorized for this one run only.
```

## 5. The one live run

```bash
DATABASE_URL=<target-from-secret-manager> \
pnpm --filter @workspace/api-server exec \
  node --import tsx/esm src/scripts/rebuild-prevented-bookings-daily.ts \
  --confirm-target <fingerprint> [--from YYYY-MM-DD --to YYYY-MM-DD]
```

Enforcement (violations exit `2` before anything is touched):

- `--confirm-target` is **mandatory** for live execution and must match the
  fingerprint derived from `DATABASE_URL`;
- malformed options, malformed or impossible days, `--from` later than
  `--to`, or a missing `DATABASE_URL` abort as usage errors;
- an unreachable database at startup aborts with exit `2`, nothing touched.

During the run (violations exit `1`, transaction rolled back, projection
unchanged): tripwire failure, reconciliation failure, or any transaction
error.

## 6. After a failure

If the run exits nonzero: **stop**. Do not re-run and do not "fix" the
projection by hand. The transaction has already rolled back — the
projection is exactly as it was. Collect the summary/error lines, report to
the operator, and wait for a fresh authorization that explicitly references
the failure. A tripwire failure additionally means the SOURCE table needs
investigation before any rebuild may be re-attempted.

## 7. Credential-free reporting requirements

Every report about a rebuild (dry-run or live) may contain **only** the
summary-line fields: `mode`, `scope`, `from_day`, `to_day`, the count
fields, `reconciliation`, `target_fingerprint`, and `duration_ms`.

Never include: `DATABASE_URL` or any connection string, usernames,
passwords, tokens, cookies, authorization headers, or row contents. The
script itself never prints any of these; reports must not reintroduce them.

## 8. Schema provenance

- Declaration (B1): `lib/db/src/schema/prevented-bookings-daily.ts`
- Frozen DDL artifact (B2): `docs/migrations/PREVENTED_BOOKINGS_DAILY_V1.sql`
  — additive-only, single transaction, no `IF NOT EXISTS`, no DOWN; apply to
  managed infrastructure only under explicit Gate B authorization (B3),
  never via `drizzle-kit push`. Local scratch databases may apply it freely
  for tests.
- Focused tests:
  `artifacts/api-server/src/__tests__/prevented-bookings-daily-rebuild.test.ts`
  (local scratch PostgreSQL 15+ only — `UNIQUE NULLS NOT DISTINCT` requires
  PostgreSQL 15).
