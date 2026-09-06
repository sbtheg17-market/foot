# Gate-B operator runbook — DRAFT — DO NOT EXECUTE

**This is a proposed, non-executable runbook for human operator review.** Nothing in
it is authorized. `docs/managed-db-release-gate.md` and
`docs/backup-restore-runbook.md` govern; where this draft and those documents
differ, those documents win. Sections marked **DRAFT** contain decisions the
repository does not document and that the named approver must make explicitly.
Sections marked **DO NOT EXECUTE** describe an operator-only production procedure
for review purposes and must not be run until the approver re-labels them for one
specific run window.

No credentials, hostnames, ports, usernames, or connection strings appear in this
document, and none may be added to it.

## 0. Roles and preconditions

| Role | Named person | Recorded where |
|---|---|---|
| Release operator | _TBD_ | release record |
| Release approver | _TBD_ (repository docs name the product owner as approver and future production operator) | release record |
| Stop owner (may abort at any step) | _TBD_ | release record |
| Change window (start/end, timezone) | _TBD_ | release record |

Preconditions that must all be true before §1 begins:

- `docs/gate-b-preflight-draft.md` reviewed; its §1–§2 re-run by the operator on
  the operator machine (HEAD = `9710454ef0b864071bcba387b5cf56f0d79ae36d`, clean
  tree, ten hashes match).
- The operator's database tooling meets the backup scripts' preflight
  (`psql`/`pg_dump` major ≥ server major reported by the SQL file §0).
- Credentials exist only in the operator's secret manager and are injected into
  the operator's process at run time; they never appear on a command line, in a
  file, in a screenshot, in chat, or in shell history.

## 1. Preflight checklist (non-executable; tick with evidence references only)

Status column added 2026-09-05 from the operator's read-only catalog session,
recorded in `docs/gate-b-release-record.md`. **`CLOSED (read-only evidence;
rerun required in change window; not approval)` means the read-only evidence
was recorded on that date; it must be re-run inside the change window before
any apply (catalog state can drift), and it never means approved.** Every other
check is OPEN and blocks §5.

| # | Check | Evidence to record (non-secret) | Pass condition | Status (2026-09-05) |
|---|---|---|---|---|
| 1.1 | Repository at approved SHA, clean | `git rev-parse HEAD`, `git status --short` | SHA equals approval record; status empty | repository-side PASS at `9710454` recorded (preflight §1); operator re-run at the window **OPEN** |
| 1.2 | Ten artifact hashes | `sha256sum docs/migrations/*.sql` | all equal the gate document inventory | repository-side 10/10 MATCH recorded (preflight §2); operator re-run at the window **OPEN** |
| 1.3 | Target descriptors | SQL file §0 (run first, alone) | database name recorded as the expected canonical database; server major ≥ 15; `meets_pg15…` = true — otherwise stop | **CLOSED (read-only evidence; rerun required in change window; not approval)** — `postgres`, major 17, PG15 requirement met (release record §2); identity confirmation itself remains **OPEN** (B3) |
| 1.4 | `storage.migrations` identification | SQL file §1.1, §1.2, §1.4 only (§1.3, §1.4a, §1.5–§1.8 are DEFERRED — they read a platform-owned journal and are not needed for classification) | relation is `storage.migrations` with columns `id`, `name`, `hash`, `executed_at`; row count recorded | **CLOSED (read-only evidence; rerun required in change window; not approval)** — relation and columns observed; 65 rows (release record §2); corroborating only |
| 1.5 | Base tables present | SQL file §2 | six of six true — otherwise stop; never create or repair | **CLOSED (read-only evidence; rerun required in change window; not approval)** — 6/6 present (release record §2) |
| 1.6 | Per-artifact state | SQL file §3.2 **before** §3.1 | exactly two APPLIED (`PREVENTED_BOOKING_RECORDS_V1`, `PROVIDER_APPLICATION_REJECTION_REASON_V1`), eight ABSENT, zero PARTIAL — any `PARTIAL - HARD STOP` stops everything (no §4, no apply, no deploy) | **CLOSED (read-only evidence; rerun required in change window; not approval)** — 2 APPLIED / 8 ABSENT / 0 PARTIAL (release record §3) |
| 1.7 | Exact definitions of the two existing artifacts | SQL file §4.1–§4.5, one at a time, only if §3.2 shows no PARTIAL rows (§4.6, §4.7, §4.7b DEFERRED to the evidence record) | every row `MATCH`; §4.4 all indexes `is_valid`. **A `MATCH` grid is evidence, not authorization** — it establishes only that the checked definitions align; the reviewer re-reads the expected values against the artifact files and the gate document before accepting them | **CLOSED (read-only evidence; rerun required in change window; not approval)** — §4.1–§4.5 all MATCH, all indexes valid; §4.7 (RLS disabled/not forced, zero policies, zero user triggers) and §4.7b (sequence integer/1/1/owned) consistent (release record §4); reviewer re-read of expected values still required |
| 1.8 | Drift scan | SQL file §5 (DEFERRED until the core classification above is complete) | zero rows | **CLOSED (read-only evidence; rerun required in change window; not approval)** — zero unexpected Gate-B-named objects (release record §4.3) |
| 1.9 | Provenance of the two existing artifacts | operator records (who, when, from which hash) | documented, or explicitly recorded as "provenance unknown — accepted by approver" | **OPEN** (release record §5) |
| 1.10 | Backup gate | `docs/backup-restore-runbook.md` §"Pre-migration backup gate" steps 1–9 | every control has a named value; fresh recovery point reference recorded; PITR coverage and RPO/RTO confirmed | **OPEN** — all nine controls and the recovery-point reference are placeholders (release record §8) |
| 1.11 | SQL review of the exact bytes of each artifact in the apply set | reviewer name + hash per artifact | additive-only confirmed; no `IF NOT EXISTS`; transaction mode decided (§3) | **OPEN** — transaction mode undecided (release record §7.2); review item R1 (`RESCHEDULE_PROPOSALS_HISTORY_V1` declares a 73-character constraint identifier exceeding PostgreSQL's 63-byte limit; the truncated server name must be explicitly accepted and collision-checked against the target and staging catalogs; artifact bytes must not be edited — release record §7.5) must be closed by the human reviewer; the post-apply verification package is **OPEN** and must be generated only after a repository-only extraction/check against the frozen artifact bytes (release record §7.6) |
| 1.12 | Dry-run on isolated staging | §4 output (no credentials, no rows) | every artifact in the apply set applied cleanly in the approved order; verification queries pass | **OPEN** — no target, no validated baseline, no approved order |
| 1.13 | Application compatibility | statement referencing the CI run on the approved SHA and the staging smoke result | recorded | **OPEN** |
| 1.14 | Explicit approval | approver name, timestamp, artifact hashes, target descriptors, scope, one-run window | complete | **OPEN** — not granted |

Any failed or unavailable check → **stop**; do not proceed to §5.

## 2. Remaining evidence required (complete list as of this draft)

1. Backup owner, provider/service, frequency, retention, PITR decision,
   restore-test cadence, RPO, RTO, escalation owner — all currently `TBD` in
   `docs/backup-restore-runbook.md`.
2. Fresh pre-migration recovery point covering the change window (non-secret
   provider reference), verified complete/readable/in retention.
3. Non-secret target descriptors recorded (SQL file §0) and the environment class
   stated as "managed production" by the operator.
4. Exact-definition comparison results for the two existing artifacts (SQL file
   §4), all `MATCH`.
5. Provenance record for the two existing artifacts, or an explicit approver
   acceptance of unknown provenance.
6. Approved total order (§3 below, currently DRAFT).
7. Transaction-mode decision per artifact (§3, currently DRAFT).
8. Identified isolated staging target and its dry-run output (§4).
9. Application compatibility statement for SHA `9710454`.
10. Named operator, approver, stop owner, change window, and the explicit
    approval record.
11. A separate, later decision on production deployment (`docs/TODO-LEDGER.md`:
    NOT AUTHORIZED).

## 3. Total-order decision — **DRAFT (not documented by the repository; requires approval)**

Documented constraints honored: records → daily; rejection-reason → booking-pages →
service-areas; PostgreSQL ≥ 15 for daily. Everything else below is a proposal
derived from merge chronology in `docs/TODO-LEDGER.md` and has **no repository
authority**.

| Pos. | Artifact | Preflight state | Documented constraint | DRAFT rationale | DRAFT transaction mode |
|---|---|---|---|---|---|
| — | `PREVENTED_BOOKING_RECORDS_V1` | APPLIED (exists) | first of the prevented pair | **EXCLUDED from apply set** — objects exist; re-apply would fail loudly by design | n/a |
| — | `PROVIDER_APPLICATION_REJECTION_REASON_V1` | APPLIED (exists) | first of the return-path trio | **EXCLUDED from apply set** — column exists | n/a |
| 1 | `PREVENTED_BOOKINGS_DAILY_V1` | ABSENT | after records (satisfied) | completes the oldest documented pair | file self-wraps `BEGIN/COMMIT`; run with `ON_ERROR_STOP` only (decision needed: see note) |
| 2 | `RESCHEDULE_PROPOSALS_HISTORY_V1` | ABSENT | none | oldest remaining artifact (pre-#11) | psql-supplied single transaction |
| 3 | `PROVIDER_PUBLIC_BOOKING_PAGES_V1` | ABSENT | after rejection-reason (satisfied) | roadmap #11; documented second in trio | psql-supplied single transaction |
| 4 | `PROVIDER_SERVICE_AREAS_V1` | ABSENT | after booking-pages | roadmap #12; documented third in trio | psql-supplied single transaction |
| 5 | `CANCELLATION_NO_SHOW_SUPPORT_V1` | ABSENT | none | roadmap #13 | psql-supplied single transaction |
| 6 | `PILOT_PROVIDER_RETENTION_V1` | ABSENT | none | pilot dashboard Part 1 | psql-supplied single transaction |
| 7 | `PROVIDER_EMERGENCY_OPENINGS_V1` | ABSENT | none | availability exceptions Phase B (first) | psql-supplied single transaction |
| 8 | `PROVIDER_BLOCKED_RANGES_V1` | ABSENT | none | availability exceptions Phase B (second) | psql-supplied single transaction |

**Transaction-mode note (DRAFT, SQL-review decision):** `PREVENTED_BOOKINGS_DAILY_V1`
contains its own `BEGIN;`/`COMMIT;`. Adding an outer psql-supplied transaction
around a self-wrapped file produces nested-transaction warnings and an early
inner commit; the reviewer must choose one mechanism per artifact and record it.
The other seven files have no transaction statements and rely on the psql-supplied
single transaction to satisfy the gate's "single transaction" requirement.

**Apply set (DRAFT): 8 artifacts. Excluded: 2 (already present).** Any change to
the apply set or order requires a new approval record.

## 4. Dry-run procedure — isolated staging target only

Purpose: prove the approved order applies cleanly and yields the expected catalog,
using no production credentials and no production data.

1. Provision a disposable PostgreSQL whose **major version equals** the managed
   server major version (SQL file §0). It must be separately provisioned and
   clearly named as disposable (the restore-rehearsal script's naming rules in
   `docs/restore-supabase-instance-rehearsal.md` are a reasonable model).
2. Establish the pre-Gate-B baseline schema on it in one of two approved ways:
   a. schema-only restore of the verified recovery point into the disposable
      target (operator-only; per `docs/restore-supabase-instance-rehearsal.md`;
      restored data is production-sensitive even if schema-only is intended —
      confirm the artifact is schema-only before use), **or**
   b. a local scratch schema that reproduces the managed state exactly, including
      the two already-present artifacts.
3. Run the SQL file §0–§5 against the disposable target and confirm the same
   state as production preflight (two APPLIED, eight ABSENT, zero PARTIAL, all
   definitions MATCH).
4. Apply the eight artifacts in the approved order, one `psql` invocation per
   artifact, with `--set ON_ERROR_STOP=1` and the recorded transaction mode,
   capturing stdout/stderr to a log that contains no credentials.
5. Re-run the SQL file §3.2 (expect ten APPLIED, zero PARTIAL) and §5 (expect
   zero rows). Run the post-application verification of
   `docs/managed-db-release-gate.md` §"Post-application verification".
6. Start the application build of SHA `9710454` against the disposable target and
   check `/api/healthz` plus a read-only smoke check.
7. Record: target major version, artifact order, per-artifact exit status and
   duration, verification results, application health. No credentials, no rows.
8. Destroy the disposable target.

A dry-run that requires any deviation from the approved order or any manual fix
is **not clean**; return to §1.

## 5. Production apply procedure — **DO NOT EXECUTE** (operator-only, review copy)

To be performed only by the named operator, inside the approved one-run window,
after every §1 check passes and the §1.14 approval names these exact hashes.

For each artifact in the approved order:

1. Recompute the artifact's SHA-256 from the reviewed checkout and compare it to
   the approval record. Mismatch → stop.
2. Re-run SQL file §3.2 for that artifact. State must be ABSENT. Anything else →
   stop.
3. Run exactly once, from the repository root, with the connection supplied by the
   secret manager to the process environment (never on the command line):
   - artifacts without internal `BEGIN/COMMIT`:
     `psql --set ON_ERROR_STOP=1 --single-transaction --file docs/migrations/<ARTIFACT>.sql`
   - artifacts with internal `BEGIN/COMMIT` (currently only `PREVENTED_BOOKINGS_DAILY_V1.sql` in the apply set):
     `psql --set ON_ERROR_STOP=1 --file docs/migrations/<ARTIFACT>.sql`
   (Final flag set is whatever §3's transaction-mode decision recorded.)
4. Exit status must be 0 and the log must show no ERROR. Any non-zero exit,
   any ERROR, or any doubt → stop; do **not** retry; preserve the log; go to
   §7. A partially applied transaction is treated as failed.
5. Re-run SQL file §3.2 for that artifact. State must be APPLIED.
6. Record artifact name, hash, exit status, start/end timestamps, operator, in the
   release record. No credentials, no rows.

Never: run `drizzle-kit push`/`migrate` against the managed target; run an artifact
whose state is not ABSENT; combine artifacts into one file; edit an artifact; add
`IF NOT EXISTS`; retry without fresh authorization.

## 6. Immediate verification (read-only)

1. SQL file §3.2 → ten APPLIED, zero PARTIAL.
2. SQL file §5 → zero unexpected objects.
3. Extend the exact-definition comparison approach of SQL file §4 to each newly
   created table/index/enum against its artifact (columns, types, nullability,
   defaults, constraints incl. `ON DELETE` behavior, index definitions incl.
   predicates and uniqueness, `is_valid` = true). Prepare these before the window;
   do not improvise them during it.
4. Gate document §"Post-application verification": active-booking unique index
   `bookings_active_booking_unique_idx` unchanged by full definition; no schema
   drift; `/api/healthz`; application smoke check against the running build of
   the approved SHA (deployment of a new build is a separate gate — see §8).
5. Record every result. Any failed or unavailable check → do not release; §7.

## 7. Stop conditions and recovery decision

Stop immediately, before any further write, when any of the following holds:

- target identity or environment class is ambiguous;
- HEAD SHA or any artifact hash differs from the approval record;
- backup, restore, RPO, or RTO evidence is missing or stale;
- SQL file §3.2 shows PARTIAL for any artifact, or APPLIED for an artifact about
  to be applied, or ABSENT for one of the two previously present artifacts;
- SQL file §4 shows any non-MATCH row; SQL file §5 shows any row;
- the dry-run was not clean or was skipped;
- approval is missing, expired, or covers a different scope/target;
- an apply returns non-zero, logs ERROR, or is interrupted;
- credentials appear in any log, output, report, or shell history;
- the stop owner says stop.

Recovery is decided per `docs/backup-restore-runbook.md` §"Restore decision
during an incident" (provider PITR, backup restore, reviewed forward-fix,
projection rebuild, or not yet safe). Artifacts have no DOWN; never reverse one
with improvised SQL.

## 8. Railway deployment — separate gate, **NOT AUTHORIZED**

Deployment of the canonical `main` build is a distinct decision recorded as NOT
AUTHORIZED in `docs/TODO-LEDGER.md`. When and only when it is explicitly
authorized after §6 passes: the operator deploys the approved SHA through the
hosting provider's own protected interface (no repository workflow deploys by
design), confirms `/api/healthz`, runs the read-only smoke check, and then re-runs
`docs/pilot/provider-client-journey-validation.md` with brand-new provider and
client accounts. No tokens or provider credentials are handled through the agent.

## 9. Release record template (non-secret)

```text
Gate-B release record — DRAFT
Repository / SHA:                sbtheg17-market/foot @ 9710454ef0b864071bcba387b5cf56f0d79ae36d
Target class:                    managed production
Target descriptors (SQL §0):     database_name=<value>  server_major_version=<value>
Operator / Approver / Stop owner: <names>
Change window:                   <start> – <end> <tz>
Backup evidence reference:       <provider reference id, no URL/credential>
PITR coverage / RPO / RTO:       <values>
Existing-artifact provenance:    PREVENTED_BOOKING_RECORDS_V1: <who/when/hash or "unknown, accepted">
                                 PROVIDER_APPLICATION_REJECTION_REASON_V1: <who/when/hash or "unknown, accepted">
Exact-definition comparison:     §4.1–§4.5 all MATCH  (attach result grids)
Apply set and order (approved):  <list with hashes and transaction mode>
Dry-run target / result:         <major version, per-artifact status>
Application compatibility:       <statement>
Per-artifact apply results:      <name, hash, exit, start, end>
Verification results:            <§6 items>
Release decision:                <released | not released>  by <approver> at <time>
```

---

**Gate-B is prepared for human operator review; production migration and Railway
deployment remain unexecuted.**
