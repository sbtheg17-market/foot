# Gate-B release record — OPEN (read-only evidence recorded; release BLOCKED)

**Status: OPEN. No migration applied. No deployment performed. Nothing in this
record is an approval.** `docs/managed-db-release-gate.md` and
`docs/backup-restore-runbook.md` govern; this record only attaches evidence to
the gates they define. It contains no credentials, hostnames, ports, usernames,
connection strings, or row contents.

Evidence in §2–§4 was supplied by the human operator from a read-only catalog
session they executed themselves using `docs/gate-b-catalog-queries-readonly.sql`
one section at a time. The agent had no database access. Evidence wording is
deliberately bounded: a `MATCH` grid is **"catalog evidence consistent with the
frozen artifact footprint"** — it is not provenance proof, not approval, not
proof of exact artifact bytes, and not permission to apply a migration.

Record opened: 2026-09-05 (workspace clock). Record owner: _TBD — release approver_.

Companion documents: `docs/gate-b-catalog-queries-readonly.sql` (byte-identical
to the `neo/gate-b-preflight` draft), `docs/gate-b-preflight-draft.md` and
`docs/gate-b-operator-runbook-draft.md` (edited versions of those drafts; only
their status sections were updated to point at this record).

## 1. Repository baseline

| Item | Value | Status |
|---|---|---|
| Repository | `sbtheg17-market/foot` | — |
| Branch baseline | `main` | — |
| Approved release SHA | `9710454ef0b864071bcba387b5cf56f0d79ae36d` | recorded |
| Frozen artifact integrity | 10/10 `docs/migrations/*.sql` SHA-256 values equal the inventory in `docs/managed-db-release-gate.md` §"Full frozen-artifact inventory recomputed at `98a1811`" | MATCH (recomputed 2026-09-05; per-artifact values in `docs/gate-b-preflight-draft.md` §2) |
| `docs/migrations/` | unchanged since hash-recomputation commit `98a1811` | unchanged |
| Operator re-run of this section on the operator machine inside the change window | — | **OPEN** |

## 2. Target and catalog evidence (operator-supplied, read-only)

| Fact | Observed value | Source section |
|---|---|---|
| Database name | `postgres` | §0 |
| PostgreSQL major version | 17 | §0 |
| PostgreSQL 15+ requirement (`UNIQUE NULLS NOT DISTINCT`, `PREVENTED_BOOKINGS_DAILY_V1`) | met | §0 |
| Required base tables (`users`, `bookings`, `provider_profiles`, `services`, `support_tickets`, `provider_applications`) | 6/6 present in `public` | §2 |
| Relation named `migrations` | exists as `storage.migrations`; metadata relation only; observed columns `id integer`, `name varchar(100)`, `hash varchar(40)`, `executed_at timestamptz` | §1.1, §1.2 |
| `storage.migrations` row count | 65 | §1.4 |

`storage.migrations` is **corroborating evidence only**. It is not defined by this
repository, is not written by any frozen artifact, and is not the repository's
authoritative Gate-B journal. The authoritative state test is expected-object
presence plus exact-definition comparison (§3–§4 below).

Database name and server major version are **descriptors for the record, not
identity proof**; target identity confirmation remains OPEN (§6, B3).

## 3. Artifact presence (catalog file §3.2 rollup)

| State | Artifacts | Count |
|---|---|---|
| APPLIED (every expected object present) | `PREVENTED_BOOKING_RECORDS_V1`, `PROVIDER_APPLICATION_REJECTION_REASON_V1` | 2 |
| ABSENT (no expected object present) | `CANCELLATION_NO_SHOW_SUPPORT_V1`, `PILOT_PROVIDER_RETENTION_V1`, `PREVENTED_BOOKINGS_DAILY_V1`, `PROVIDER_BLOCKED_RANGES_V1`, `PROVIDER_EMERGENCY_OPENINGS_V1`, `PROVIDER_PUBLIC_BOOKING_PAGES_V1`, `PROVIDER_SERVICE_AREAS_V1`, `RESCHEDULE_PROPOSALS_HISTORY_V1` | 8 |
| PARTIAL (hard stop) | none | 0 |

"APPLIED" is the catalog file's rollup label for object presence. It does not
assert who applied the objects or from which artifact bytes (see §5). The eight
ABSENT artifacts are **catalog-absent as of the read-only check; still blocked
pending all remaining release gates** — they are not approved candidates to
apply.

## 4. Definition evidence for the two present artifacts

### 4.1 `PREVENTED_BOOKING_RECORDS_V1` — catalog evidence consistent with the frozen artifact footprint

| Check | Section | Result |
|---|---|---|
| Enum `prevented_booking_path` labels and order | §4.1 | matched |
| `prevented_booking_records` checked columns (name, order, type, nullability, default) | §4.2 | matched |
| Checked constraints (PK + four FKs with `ON DELETE SET NULL`) | §4.3 | matched and validated |
| All three indexes (PK, correlation unique, marketplace/provider/occurred) | §4.4 | matched; all valid |
| Sequence `prevented_booking_records_id_seq` | §4.7b | found; integer; start 1; increment 1; owned by the expected column |
| Row-level security / policies / user triggers on `prevented_booking_records` | §4.7 | RLS disabled; RLS not forced; zero policies; zero user triggers |

### 4.2 `PROVIDER_APPLICATION_REJECTION_REASON_V1` — catalog evidence consistent with the frozen artifact footprint

| Check | Section | Result |
|---|---|---|
| `provider_applications.rejection_reason` | §4.5 | `text`, nullable, no default; matched |
| Row-level security / policies / user triggers on `provider_applications` | §4.7 | RLS disabled; RLS not forced; zero policies; zero user triggers |

### 4.3 Drift scan

| Check | Section | Result |
|---|---|---|
| Tables/enums in `public` within the Gate-B name spaces but outside the expected set | §5 | zero unexpected Gate-B-named objects |

### 4.4 What §4 does and does not establish

- Establishes: the checked names, types, nullability, defaults, constraint
  definitions, index definitions and validity, sequence metadata, and the absence
  of RLS/policies/user triggers on the checked tables are consistent with an
  artifact-based apply of the two frozen files at the recorded hashes.
- Does not establish: who applied the objects, when, or from which bytes
  (PostgreSQL records no object creation time); that the objects were produced by
  the exact frozen artifact bytes; ownership or grants; that the hand-transcribed
  expected values in the catalog file are complete; any permission to apply a
  migration. The reviewer re-reads the expected values against the artifact files
  before accepting the grids.
- Read-only catalog state can drift after this session; every check in §6 marked
  `CLOSED (read-only evidence; rerun required in change window; not approval)`
  must be re-run inside the change window before any apply.

## 5. Provenance of the two present artifacts — OPEN

The repository's last recorded disposition is `No migration applied.` The two
present footprints therefore have **no recorded Gate-B apply**. Catalog evidence
cannot recover provenance. Required before any apply: operator records naming who
applied each, when, and from which artifact hash — or an explicit, signed
approver acceptance of "provenance unknown". Neither exists in this record.

| Artifact | Provenance evidence |
|---|---|
| `PREVENTED_BOOKING_RECORDS_V1` | **OPEN — not recorded** |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1` | **OPEN — not recorded** |

## 6. Gate status

`CLOSED (read-only evidence; rerun required in change window; not approval)`
means the read-only evidence above was recorded from the operator's own catalog
session on 2026-09-05. It never means approved, and it must be re-run inside the
change window. Everything else is OPEN or BLOCKED and blocks release.

| Ref | Control | Status | Evidence / note |
|---|---|---|---|
| B1 | Nine backup/recovery controls (owner, provider/service, frequency, retention, PITR, restore-test cadence, RPO, RTO, escalation owner) | **OPEN** | all `TBD` in `docs/backup-restore-runbook.md`; no value recorded here |
| B2 | Fresh pre-migration recovery point covering the change window (non-secret provider reference; complete, readable, in retention) | **OPEN** | none recorded |
| B3 | Target identity and environment class confirmed without exposing secrets | **OPEN** | descriptors recorded (§2); descriptors are not identity proof; environment class not yet stated in a signed record |
| B4 | Approval record: named production operator, named approver, stop owner, change window, exact hashes and scope | **OPEN** | none recorded |
| B5 | Approved total order for the apply set | **OPEN — DRAFT only** | see §7.1; the repository documents only two partial orders |
| B6 | Dry-run on an identified isolated staging / restored target with captured output | **OPEN** | no target identified; no reproducible pre-Gate-B baseline validated; no harness authorized |
| B7 | Exact-definition comparison for the two present artifacts | **CLOSED (read-only evidence; rerun required in change window; not approval)** | §4.1–§4.3 of this record; evidence, not authorization |
| B8 | Provenance of the two present artifacts | **OPEN** | §5 |
| B9 | Transaction-mode decision per artifact | **OPEN — DRAFT only** | see §7.2 |
| B10a | Server major version ≥ 15 | **CLOSED (read-only evidence; rerun required in change window; not approval)** | major 17 (§2) |
| B10b | Operator `psql`/`pg_dump` client major ≥ server major (17) for the backup preflight | **OPEN** | not recorded |
| B11 | Application compatibility statement for SHA `9710454` against the post-apply schema | **OPEN** | CI proves build/tests against a fully pushed schema only |
| B12 | Production deployment (Railway) authorization | **NOT AUTHORIZED** | separate decision after database release verification |
| — | Base tables 6/6 present | CLOSED (read-only evidence; rerun required in change window; not approval) | §2 |
| — | Per-artifact presence rollup: 2 APPLIED / 8 ABSENT / 0 PARTIAL | CLOSED (read-only evidence; rerun required in change window; not approval) | §3 |
| — | Drift scan zero rows | CLOSED (read-only evidence; rerun required in change window; not approval) | §4.3 |
| — | `storage.migrations` identified (shape, 65 rows) | CLOSED (read-only evidence; rerun required in change window; not approval) | §2; corroborating only |
| — | Post-apply exact-definition verification query package for the eight catalog-absent artifacts | **OPEN** | Must be generated only after an independent repository-only extraction/check of every expected enum, column, constraint, index, sequence, and server-side truncated identifier against the frozen artifact bytes. Hand transcription alone is insufficient. Not created in this session |
| — | Human SQL review of R1 (63-byte identifier truncation, collision check) | **OPEN** | §7.5 |
| — | Explicit production-apply authorization | **OPEN** | not granted |

## 7. Human decisions required (recorded as open; nothing below is approved)

### 7.1 Total order of the eight ABSENT artifacts

Documented constraints (the only ones with repository authority):

1. `PREVENTED_BOOKING_RECORDS_V1` before `PREVENTED_BOOKINGS_DAILY_V1` — already
   satisfied (records present).
2. `PROVIDER_APPLICATION_REJECTION_REASON_V1` → `PROVIDER_PUBLIC_BOOKING_PAGES_V1`
   → `PROVIDER_SERVICE_AREAS_V1` — first step already present; the remaining
   two-step order is documented as a preference; the trio is described as
   mutually independent.
3. `PREVENTED_BOOKINGS_DAILY_V1` requires PostgreSQL 15+ — satisfied (major 17).

Everything beyond these is undocumented. The runbook §3 proposal (merge
chronology) is one candidate ordering and remains **DRAFT**. Alternatives the
approver may consider, with their trade-offs — none is recommended here:

| Option | Description | Constraint check | Risk / review item |
|---|---|---|---|
| A — runbook §3 proposal | merge chronology of the roadmap items | honours 1–3 | rationale is chronology, not dependency; not documented anywhere with authority |
| B — dependency-minimal | any order honouring 1–3; the other five are DDL-independent (no artifact holds a foreign key to another artifact's object) | honours 1–3 | equivalent at the DDL level; application behaviour between applies is not evaluated by the catalog and must be reviewed separately |
| C — smallest-first | apply the single-column / single-table artifacts before multi-object ones to shorten early failure windows | honours 1–3 if the trio order is kept | still requires an explicit written order; "smallest" is a judgement, not a documented rule |
| D — feature-gated subsets | apply only the artifacts a specific release needs; defer the rest | honours 1–3 within the subset | changes the apply set; every subset needs its own approval record and its own post-apply verification scope |

Required: the approver writes the chosen order into §9 with a named author and
timestamp. Filenames and partial dependency chains must not be used to infer the
remainder of the order.

### 7.2 Transaction mode per artifact

Facts: two frozen files (`PREVENTED_BOOKING_RECORDS_V1`, `PREVENTED_BOOKINGS_DAILY_V1`)
contain their own `BEGIN;`/`COMMIT;`; the other eight do not. Only
`PREVENTED_BOOKINGS_DAILY_V1` is both self-wrapped and ABSENT. The gate requires a
single transaction per apply and forbids editing artifacts.

| Option | Mechanism | Review item |
|---|---|---|
| I | self-wrapped file run with `ON_ERROR_STOP` only; the other seven with a psql-supplied single transaction | two mechanisms in one release; the reviewer must confirm each file's actual transaction boundary and that `ON_ERROR_STOP` leaves the self-wrapped file's transaction unfinished-and-rolled-back on error rather than half-committed |
| II | every file with a psql-supplied single transaction | nested `BEGIN` inside a transaction produces a warning and the inner `COMMIT` ends the outer transaction early; the file's `COMMIT` behaviour must be reviewed rather than assumed |
| III | one mechanism enforced by re-freezing the self-wrapped artifact without its wrapper | changes frozen bytes and hashes — requires a new artifact review, new hash record, and is outside this session's prohibitions |

Required: a written SQL-review decision per artifact in §9. No psql flag set is
approved by this record.

### 7.3 Apply set

The DRAFT apply set is the eight catalog-absent artifacts; the two present
artifacts are excluded because re-applying them fails loudly by design. Nothing
in the apply set is approved: every member is still blocked pending all
remaining release gates. Confirmation of the apply set (including whether any
artifact is deferred under option D) is an approver decision.

### 7.4 Dry-run baseline and target

A dry-run is not evidence unless it starts from a baseline that reproduces the
managed pre-Gate-B state, including the two present artifacts, on a PostgreSQL
major equal to the managed server (17), on an isolated target that is not
production. Neither a reproducible baseline procedure nor a target has been
approved. No harness was written or executed in this session.

### 7.5 Review findings from artifact bytes (names only) — OPEN human SQL-review items

| Ref | Finding | Status | Required before any approval |
|---|---|---|---|
| R1 | `RESCHEDULE_PROPOSALS_HISTORY_V1` declares the constraint identifier `booking_reschedule_history_proposal_id_booking_reschedule_proposals_id_fk` (73 characters), which exceeds PostgreSQL's 63-byte identifier limit. PostgreSQL will truncate it; the expected server-side name is `booking_reschedule_history_proposal_id_booking_reschedule_propo`. Truncation is not harmless by default: a truncated name that collides with an existing constraint name would make the apply fail | **OPEN** | (1) the human SQL review explicitly accepts the resulting server identifier; (2) the exact post-truncation name is checked for collisions against all constraint names in the target and staging catalogs; (3) the artifact bytes are not edited; (4) any post-apply verification expects the truncated name. No migration may be approved until (1)–(2) are recorded in §9 |

### 7.6 Post-apply verification package — OPEN

Post-apply verification query package must be generated only after an
independent repository-only extraction/check of every expected enum, column,
constraint, index, sequence, and server-side truncated identifier against the
frozen artifact bytes. Hand transcription alone is insufficient. No such file
exists in the repository as of this record.

## 8. OPEN placeholders (block release; do not fill from memory or chat)

| Item | Value |
|---|---|
| Backup owner | **OPEN** |
| Backup provider/service | **OPEN** |
| Backup frequency | **OPEN** |
| Retention | **OPEN** |
| Point-in-time recovery decision and latest recoverable time | **OPEN** |
| Restore-test cadence and last rehearsal evidence | **OPEN** |
| Recovery point objective (RPO) | **OPEN** |
| Recovery time objective (RTO) | **OPEN** |
| Incident escalation owner | **OPEN** |
| Fresh recovery-point reference (non-secret provider identifier) | **OPEN** |
| Provenance evidence — `PREVENTED_BOOKING_RECORDS_V1` | **OPEN** |
| Provenance evidence — `PROVIDER_APPLICATION_REJECTION_REASON_V1` | **OPEN** |
| Target identity confirmation and environment class statement | **OPEN** |
| Named production operator | **OPEN** |
| Named approver | **OPEN** |
| Stop owner | **OPEN** |
| Change window (start, end, timezone) | **OPEN** |
| Staging / restored-target dry-run evidence | **OPEN** |
| Post-apply verification package (repository-validated, not hand-transcribed) | **OPEN** |
| Human SQL review acceptance of R1 server identifier and collision check | **OPEN** |
| Explicit production-apply authorization | **OPEN — not granted** |
| Railway deployment authorization | **NOT AUTHORIZED** |

## 9. Decisions and approvals (append-only; each entry needs a named author and timestamp)

| Date | Author | Decision | Scope / hashes |
|---|---|---|---|
| — | — | none recorded | — |

## 10. Secret and data handling statement

No password, connection string, token, key, `.env` content, saved connection
profile, backup, dump, or provider/client/booking row was read, printed, stored,
or transmitted in preparing this record. All database facts were supplied by the
operator from catalog-only queries.

## 11. Record history

| Date | Entry |
|---|---|
| 2026-09-05 | Record opened. Read-only catalog evidence (§2–§4) attached from the operator's manual session. Gate status (§6), open decisions (§7), review finding R1 (§7.5), placeholders (§8) recorded. Post-apply verification package deferred (§7.6). No migration applied; no deployment; no approval. |

---

**Read-only Gate-B evidence has been recorded. Production migration and Railway
deployment remain blocked pending the explicitly listed human approvals and
operational evidence.**
