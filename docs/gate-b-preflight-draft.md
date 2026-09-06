# Gate-B preflight — DRAFT readiness report (read-only evidence)

**Status: DRAFT — for human operator review. No migration applied. No deployment performed.**

This document was produced by a scoped release-preparation session with read-only
repository access and no database, GitHub, Railway, Supabase, or SSH access of its
own. Every managed-database fact below was supplied by the human operator from a
read-only catalog query they executed themselves; none was obtained by the agent.
It contains no credentials, hostnames, ports, usernames, connection strings, or row
contents. It does not authorize any action; `docs/managed-db-release-gate.md`
remains the governing procedure.

## 1. Repository state

| Item | Value | Status |
|---|---|---|
| Repository | `sbtheg17-market/foot` | — |
| Baseline branch | `main` | — |
| Approved release SHA | `9710454ef0b864071bcba387b5cf56f0d79ae36d` | HEAD **matches** |
| Working tree at preflight start | `git status --short` empty | **clean** |
| Local `origin/main` ref | `9710454ef0b864071bcba387b5cf56f0d79ae36d` | equals HEAD (local ref only; GitHub was **not** contacted in this session) |
| Preparation branch | `neo/gate-b-preflight` (local only, created from the approved SHA) | uncommitted drafts only |
| `docs/migrations/` since hash-recomputation commit `98a1811` | no diff | unchanged |

## 2. Frozen artifacts — hash status (recomputed at HEAD `9710454`)

Reference values: `docs/managed-db-release-gate.md` §"Full frozen-artifact inventory
recomputed at `98a1811`". All ten recomputed values are byte-identical to the
documented values.

| Artifact | SHA-256 (recomputed) | vs. gate document | Self-wrapped `BEGIN/COMMIT` |
|---|---|---|---|
| `CANCELLATION_NO_SHOW_SUPPORT_V1.sql` | `b6f253c1e5917ffa0e7cdc038486c5d16fb6cdc04d1f8b6772cb003ea11c8a2b` | MATCH | no |
| `PILOT_PROVIDER_RETENTION_V1.sql` | `ceaac6d50e6336fe4c13281ab7de5fc36eca7d96262a771c16a3f8647bf90cad` | MATCH | no |
| `PREVENTED_BOOKINGS_DAILY_V1.sql` | `c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876` | MATCH | **yes** |
| `PREVENTED_BOOKING_RECORDS_V1.sql` | `138982a19c7427044dfea167ffdbbcc72e6647130cc565f1d23621aef70e29ce` | MATCH | **yes** |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` | `dc978ccac702affed54c95449a06ed43b30e913a8583208d263d359a9c36f06b` | MATCH | no |
| `PROVIDER_BLOCKED_RANGES_V1.sql` | `820c079ebc7ed6bb979b0b5b0ff5b853164be16d24e7d68b70ba564dbe79469f` | MATCH | no |
| `PROVIDER_EMERGENCY_OPENINGS_V1.sql` | `9c903becb3ac436687b2de347fb48216c2ba611b82cfa7c8ac6c9928e7280622` | MATCH | no |
| `PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql` | `139d6b41430d7110d481e3ec3257d9544cdcbfb5f2474f51ea16e411a0ac34dc` | MATCH | no |
| `PROVIDER_SERVICE_AREAS_V1.sql` | `07031aa88d454c7e1f0a5502433ac25e1f5680977984bdd3d66733957396b633` | MATCH | no |
| `RESCHEDULE_PROPOSALS_HISTORY_V1.sql` | `b8a8c5c7facf6dc01ce893360efe28b8fd6a7036847433f3abece308a6bc1ba5` | MATCH | no |

Additional review facts (names only; no SQL bodies reproduced):

- CI's destructive-DDL scan (`DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM`) is clean
  for all ten. The only `DELETE`/`UPDATE` tokens are `ON DELETE …`/`ON UPDATE …`
  foreign-key clauses or comment text.
- No artifact uses `IF NOT EXISTS` (policy: drift fails loudly). **Consequence:
  re-applying an artifact whose objects already exist will fail — this is the
  intended behavior, and those artifacts must be excluded from the apply set, not
  "retried".**
- None of the ten artifacts references or writes to any relation named
  `migrations`. The repository defines **no** migration-history relation and no
  Drizzle journal (`docs/managed-db-release-gate.md` line 28).

### Object footprint per artifact (names only)

| Artifact | Creates | Alters (adds columns / constraints to existing tables) |
|---|---|---|
| `PREVENTED_BOOKING_RECORDS_V1` | type `prevented_booking_path`; table `prevented_booking_records`; indexes `prevented_booking_records_correlation_unique_idx` (unique), `prevented_booking_records_marketplace_provider_occurred_idx` | — |
| `PREVENTED_BOOKINGS_DAILY_V1` | table `prevented_bookings_daily` (inline CHECK + `UNIQUE NULLS NOT DISTINCT`) | — |
| `CANCELLATION_NO_SHOW_SUPPORT_V1` | type `booking_outcome_action`; table `booking_outcome_history`; index `booking_outcome_history_booking_created_idx` | `bookings` (+`cancellation_category`, `no_show_marked_by`, `no_show_marked_at`); `support_tickets` (+`booking_id`); FKs on `booking_outcome_history` |
| `PILOT_PROVIDER_RETENTION_V1` | type `pilot_retention_intent`; table `pilot_provider_retention` | — |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1` | — | `provider_applications` (+`rejection_reason`) |
| `PROVIDER_PUBLIC_BOOKING_PAGES_V1` | index `provider_profiles_public_slug_unique_idx` (unique) | `provider_profiles` (+`public_slug`, `booking_page_published`, `booking_page_published_at`); `bookings` (+`source`) |
| `PROVIDER_SERVICE_AREAS_V1` | tables `provider_service_areas`, `provider_coverage_areas`; indexes `provider_coverage_areas_active_prefix_unique_idx` (unique), `provider_coverage_areas_provider_active_idx` | — |
| `PROVIDER_BLOCKED_RANGES_V1` | table `provider_blocked_ranges`; index `provider_blocked_ranges_provider_end_idx` | — |
| `PROVIDER_EMERGENCY_OPENINGS_V1` | table `provider_emergency_openings`; index `provider_emergency_openings_provider_date_idx` | — |
| `RESCHEDULE_PROPOSALS_HISTORY_V1` | types `reschedule_proposal_status`, `reschedule_notification_outcome`; tables `booking_reschedule_proposals`, `booking_reschedule_history`; indexes `reschedule_proposals_single_pending_idx` (unique), `reschedule_proposals_requester_idempotency_idx` (unique), `reschedule_proposals_booking_created_idx`, `reschedule_history_booking_created_idx` | FKs on the two new tables |

## 3. Dependency constraints

### 3.1 Documented in the repository

| Constraint | Source |
|---|---|
| `PREVENTED_BOOKING_RECORDS_V1` **before** `PREVENTED_BOOKINGS_DAILY_V1` (daily is a projection whose only source is the records table) | gate doc §"Migration inventory"; artifact header comments |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1` → `PROVIDER_PUBLIC_BOOKING_PAGES_V1` → `PROVIDER_SERVICE_AREAS_V1` (documented order; the three are described as mutually independent) | gate doc §"Preflight verification record — 2026-08-28" |
| `PREVENTED_BOOKINGS_DAILY_V1` requires **PostgreSQL 15+** (`UNIQUE NULLS NOT DISTINCT`) | artifact header; gate doc inventory row |
| Apply exactly once with `psql --set ON_ERROR_STOP=1` and a single transaction | gate doc §"Controlled application" step 6 |

### 3.2 Derived from the artifacts (schema-level prerequisites; names only)

Every foreign key or `ALTER TABLE` in the ten artifacts targets one of these
pre-existing base tables: `users`, `bookings`, `provider_profiles`, `services`,
`support_tickets`, `provider_applications`. No artifact has a foreign key to an
object created by a *different* artifact. Therefore the only hard inter-artifact
ordering constraint at the DDL level is records → daily (semantic, not FK), and the
only documented preference ordering is the return-path trio.

### 3.3 Transaction-wrapping observation (review item, not a decision)

Two artifacts (`PREVENTED_BOOKING_RECORDS_V1`, `PREVENTED_BOOKINGS_DAILY_V1`) contain
their own `BEGIN;`/`COMMIT;`. The other eight do not. The gate requires "a single
transaction" per apply. How that is achieved for the eight (for example psql's
`--single-transaction`) and how the two self-wrapped files are handled without
nested-transaction warnings is a **SQL-review decision** that must be recorded
before any apply. It is marked DRAFT in the operator runbook.

## 4. Total ordering — documented versus missing

- **Documented:** only the two partial orders in §3.1. The gate's required
  preflight record demands an "ordered artifact list and dependency review" for
  the release, and no document in the repository provides a total order for all
  ten artifacts.
- **Missing:** an approved total order. The operator runbook draft proposes one
  (marked **DRAFT**, derived from merge chronology in `docs/TODO-LEDGER.md` and
  respecting both documented partial orders). It must be reviewed and approved by
  the named approver; it must not be inferred as approved from this document.

## 5. Managed catalog evidence (operator-supplied, read-only)

Facts reported by the operator from their own read-only catalog check over the
canonical database (no credentials or connection details were shared with the
agent):

| Fact | Reported value |
|---|---|
| Expected objects for `PREVENTED_BOOKING_RECORDS_V1` | **all present** |
| Expected objects for `PROVIDER_APPLICATION_REJECTION_REASON_V1` | **all present** |
| Expected objects for the remaining eight artifacts | **all absent** (no partial state reported) |
| Relation named `migrations` | found as `storage.migrations` with columns `id integer`, `name varchar(100)`, `hash varchar(40)`, `executed_at timestamptz` |

Second read-only session (2026-09-05; the operator ran the SQL file one section
at a time; results attached to `docs/gate-b-release-record.md` §2–§4):

| Fact | Reported value | Section |
|---|---|---|
| Database name / server major | `postgres` / 17 | §0 |
| PostgreSQL 15+ requirement for `PREVENTED_BOOKINGS_DAILY_V1` | met | §0 |
| Base tables (`users`, `bookings`, `provider_profiles`, `services`, `support_tickets`, `provider_applications`) | 6/6 present | §2 |
| `storage.migrations` row count | 65 | §1.4 |
| Per-artifact rollup | 2 APPLIED, 8 ABSENT, 0 PARTIAL | §3.2 |
| `prevented_booking_path` labels/order; `prevented_booking_records` columns, constraints (validated), three indexes (valid) | all MATCH | §4.1–§4.4 |
| `provider_applications.rejection_reason` (`text`, nullable, no default) | MATCH | §4.5 |
| RLS / policies / user triggers on `prevented_booking_records` and `provider_applications` | RLS disabled, not forced; zero policies; zero user triggers | §4.7 |
| Sequence `prevented_booking_records_id_seq` | integer; start 1; increment 1; owned by the expected column | §4.7b |
| Drift scan | zero unexpected Gate-B-named objects | §5 |

These results are **catalog evidence consistent with the frozen artifact
footprint** for the two present artifacts. They are not provenance proof, not
approval, not proof of exact artifact bytes, and not permission to apply a
migration.

### 5.1 Interpretation (strictly bounded)

1. `storage.migrations` is **not** defined by this repository and is **not** written
   by any frozen artifact. It lives in the `storage` schema, not `public`. Its shape
   is consistent with a service-managed migration journal that belongs to the
   database platform rather than to this application. It is therefore
   **corroborating evidence only**; it must not be used to decide which Gate-B
   artifacts are applied. The catalog-queries file's deferred sections (§1.6–§1.7)
   can compare its `name` values against the ten expected labels purely to
   confirm that no Gate-B label was recorded there; this is not part of the core
   classification and is left to the operator's evidence record.
2. The presence of a table named `migrations` does **not** mean Gate-B is applied.
   The authoritative test is expected-object presence **plus exact definition
   comparison**, which is what `docs/gate-b-catalog-queries-readonly.sql` §3–§4
   produce.
3. Two artifacts' objects exist although the repository has no record of a Gate-B
   apply for either (the gate doc's current disposition is "No migration
   applied"). PostgreSQL does not record object creation time, so **provenance
   cannot be recovered from the catalog**; it must come from operator records
   (who applied what, when, from which artifact hash). Until provenance and an
   exact-definition match are recorded, these objects are "existing with
   unverified provenance", not "applied under Gate-B".
4. The exact-definition comparison (§4.1–§4.5, §4.7, §4.7b) is now recorded as
   all `MATCH` / consistent (2026-09-05). This closes the *definition* half of
   item 3 only. Provenance remains unrecorded; the two artifacts stay "existing
   with unverified provenance" until operator records or an explicit approver
   acceptance of unknown provenance are attached to the release record (B8).

## 6. Existing versus absent artifact objects

| Artifact | Managed state (operator-reported) | Required action before any apply |
|---|---|---|
| `PREVENTED_BOOKING_RECORDS_V1` | **EXISTS** (all expected objects present) | Exact-definition comparison (§4.1–§4.4 of the SQL file) **recorded 2026-09-05: all MATCH, all indexes valid; §4.7/§4.7b consistent** (`docs/gate-b-release-record.md` §4.1). Provenance still **OPEN** (B8). **Exclude from apply set (DRAFT).** |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1` | **EXISTS** (column present) | Column definition comparison (§4.5) **recorded 2026-09-05: MATCH; §4.7 consistent** (`docs/gate-b-release-record.md` §4.2). Provenance still **OPEN** (B8). **Exclude from apply set (DRAFT).** |
| `PREVENTED_BOOKINGS_DAILY_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates (requires PG 15+ — met; source table exists) |
| `CANCELLATION_NO_SHOW_SUPPORT_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates |
| `PILOT_PROVIDER_RETENTION_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates |
| `PROVIDER_PUBLIC_BOOKING_PAGES_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates (documented order: after rejection-reason, which exists) |
| `PROVIDER_SERVICE_AREAS_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates (documented order: after booking-pages) |
| `PROVIDER_BLOCKED_RANGES_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates |
| `PROVIDER_EMERGENCY_OPENINGS_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates |
| `RESCHEDULE_PROPOSALS_HISTORY_V1` | ABSENT | Catalog-absent as of the read-only check; still blocked pending all remaining release gates (review item R1 in §7 must be accepted by the human SQL review first) |

"Catalog-absent" means only that the preflight object-presence check does not
block the artifact. It does **not** mean approved, and it does not make the
artifact a candidate to apply until every remaining release gate is closed.

## 7. Blockers (consolidated from repository documents and this preflight)

Status column updated 2026-09-05 after the operator's read-only catalog session
(`docs/gate-b-release-record.md`). `CLOSED (read-only evidence; rerun required
in change window; not approval)` means evidence was recorded; it must be re-run
inside the change window and never means approved.

| # | Blocker | Source | Status |
|---|---|---|---|
| B1 | Backup/recovery controls (owner, provider, frequency, retention, PITR, RPO, RTO, escalation) are all `TBD` in the repository; "No managed schema release is ready while these decisions are blank." | `docs/backup-restore-runbook.md` | **OPEN** — any operator confirmation given verbally in a session is not yet attached to a release record |
| B2 | Fresh pre-migration recovery point covering the change window, with a non-secret provider evidence reference | runbook §"Pre-migration backup gate" | **OPEN** |
| B3 | Target identity and environment class confirmed without exposing secrets; the connection is operator-asserted, and no credential-free target fingerprint procedure is defined in the repository | gate doc §"Required preflight" | **OPEN** — §0 descriptors recorded (database name `postgres`, server major 17); they are descriptors, not identity proof, and the environment class is not yet stated in a signed record |
| B4 | Approval record: named operator, named approver, change window, stop owner, exact artifact hashes and scope | gate doc §"Required preflight", step 5 | **OPEN** — none exists in the repository |
| B5 | Approved **total order** for the artifacts to be applied | gate doc "ordered artifact list and dependency review" | **OPEN** — only two partial orders documented; runbook proposal is DRAFT; alternatives and required decision recorded in `docs/gate-b-release-record.md` §7.1 |
| B6 | Dry-run on an identified isolated staging target with captured output | gate doc step 4 | **OPEN** — no staging target identified; no reproducible pre-Gate-B baseline validated; no harness authorized |
| B7 | Exact-definition comparison for the two artifacts whose objects already exist | gate doc "an expected object already exists unexpectedly → preflight must fail" | **CLOSED (read-only evidence; rerun required in change window; not approval)** — §4.1–§4.5 all MATCH, §4.7/§4.7b consistent, recorded 2026-09-05 in `docs/gate-b-release-record.md` §4; evidence, not authorization |
| B8 | Provenance of the existing objects (who/when/which hash) | this preflight §5.1 | **OPEN** |
| B9 | Transaction-wrapping decision for artifacts with/without internal `BEGIN/COMMIT` | this preflight §3.3 | **OPEN** (SQL review) — options and review items recorded in `docs/gate-b-release-record.md` §7.2 |
| B10a | Server major version confirmed ≥ 15 (`UNIQUE NULLS NOT DISTINCT`) | artifact header | **CLOSED (read-only evidence; rerun required in change window; not approval)** — server major 17 (§0) |
| B10b | `pg_dump`/`psql` client major ≥ server major (17) for the backup preflight | backup scripts | **OPEN** — operator tooling not recorded |
| B11 | Application compatibility statement for the exact SHA against the post-apply schema | gate doc "application compatibility result" | **OPEN** — CI proves build/tests against a fully pushed schema, not against this specific partial-then-complete managed state |
| B12 | Production deployment authorization | `docs/TODO-LEDGER.md` "Production deployment — NOT AUTHORIZED" | **NOT AUTHORIZED** — separate decision after the database gate |
| R1 | Human SQL-review item: `RESCHEDULE_PROPOSALS_HISTORY_V1` declares a 73-character constraint identifier that exceeds PostgreSQL's 63-byte limit; the server will truncate it to `booking_reschedule_history_proposal_id_booking_reschedule_propo`; a collision of the truncated name with an existing constraint would make the apply fail (`docs/gate-b-release-record.md` §7.5) | artifact bytes | **OPEN** — no migration may be approved until the human SQL review (runbook check 1.11) explicitly accepts the resulting server identifier and records a collision check against all constraint names in the target and staging catalogs; the artifact bytes must not be edited |
| — | Post-apply verification query package for the eight catalog-absent artifacts | `docs/gate-b-release-record.md` §7.6 | **OPEN** — must be generated only after an independent repository-only extraction/check of every expected enum, column, constraint, index, sequence, and server-side truncated identifier against the frozen artifact bytes; hand transcription alone is insufficient; not created |

## 8. What must be checked before any production action (safe description)

1. Re-run §1–§2 of this document on the operator machine: HEAD equals the approved
   SHA, tree clean, ten hashes match the gate document.
2. Run `docs/gate-b-catalog-queries-readonly.sql` **one section at a time** (never
   the whole file) in the read-only VS Code PostgreSQL extension — not from a
   shell — confirming the connection indicator shows the intended database
   first. Core order: §0 → §1.1, §1.2, §1.4 → §2 → §3.2 (before §3.1) → §4.1–§4.5
   only if §3.2 shows no `PARTIAL` row. Stop on any unexpected result.
   Sections §1.3, §1.4a, §1.5–§1.8, §4.6, §4.7, §4.7b and §5 are **deferred**:
   they are read-only but not needed for classification (several read the
   platform-owned `storage.migrations` journal, so the file is read-only rather
   than strictly catalog-only). Record (no secrets): database name, server major
   version, `storage.migrations` shape and row count, per-artifact
   APPLIED/ABSENT/PARTIAL rollup (expect exactly two APPLIED, eight ABSENT, zero
   PARTIAL), and every row of the exact-definition comparison for the two
   existing artifacts (expect all `MATCH`).
   **§4 results are evidence, not authorization:** the expected values were
   transcribed by hand from the artifacts and cover names, types, nullability,
   defaults, constraints and index definitions only — not ownership, grants,
   RLS policies, triggers, or comments (§4.7 surfaces RLS/policy/trigger facts
   for review). A reviewer must re-read the expected values against the artifact
   files and the gate document before accepting any `MATCH`.
3. Any `PARTIAL`, any `MISMATCH`/`MISSING`/`EXTRA`, any unexpected object in the
   drift scan, or any Gate-B label in `storage.migrations` is a **hard stop**:
   investigate; do not apply anything.
4. Close blockers B1–B11 with written, non-secret evidence attached to a release
   record. B12 is a separate decision taken only after the database release is
   verified.
5. Only then follow `docs/gate-b-operator-runbook-draft.md` — after it has been
   reviewed, its DRAFT decisions approved, and its `DO NOT EXECUTE` sections
   re-labelled by the approver for the one-run window.

## 9. Secret and data handling statement

No password, connection string, token, key, `.env` content, saved connection
profile, backup, dump, or provider/client/booking row was read, printed, stored, or
transmitted in preparing this document or its companions. All database facts were
supplied by the operator from catalog-only queries.

---

**Gate-B is prepared for human operator review; production migration and Railway
deployment remain unexecuted.**
