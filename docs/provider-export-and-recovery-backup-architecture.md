# Provider Data Export and Operator Recovery Backup — Architecture

**Added:** 2026-08-29 (branch `docs/provider-export-recovery-architecture`).
**Status:** authoritative design; documentation only — no runtime behavior,
schema, deployment, account, or secret was touched by this task.
**Companions:** `docs/provider-data-export-spec.md` (provider-facing wording),
`docs/provider-export-implementation-plan.md` (technical plan),
`docs/restore-rehearsal-design.md` (disposable restore rehearsal),
`docs/backup-supabase-instance.md` (existing operator backup script guide),
`docs/canonical-prototype-and-instance-model.md` (instance model).

Standing separation this document enforces:

```text
Provider export ≠ production SQL backup.
Provider export ≠ GitHub repository access.
Provider export ≠ Railway access.
Provider export ≠ Supabase credential access.
Operator recovery backup ≠ Git commit.
Operator recovery backup ≠ Git push.
Operator recovery backup ≠ GitHub release artifact.
Operator recovery backup ≠ Graphify input.
Operator recovery backup ≠ provider dashboard download.
```

---

## 1. Decision summary

```text
Foot has two separate future capabilities:

Provider Data Export:
A provider receives only authorized, portable business data in application-level
formats such as CSV and JSON, delivered securely from Foot.

Operator Recovery Backup:
An authorized platform operator creates a full PostgreSQL logical recovery backup
through a controlled recovery workflow. The raw SQL artifact is never delivered
through the normal provider dashboard and never stored in GitHub or Graphify.
```

Supporting decisions (non-negotiable):

- The Foot application **never** receives GitHub repository-admin access. No
  application button creates repositories, commits/pushes/uploads SQL into
  Git, starts arbitrary Codespaces, reads Codespaces files, creates/reads
  Codespaces secrets, stores GitHub PATs or admin-scoped OAuth tokens, lets a
  provider browse GitHub artifacts, or depends on GitHub as an export/backup
  data store. If GitHub OAuth is ever used by the application, its scope must
  be minimal, optional, separately reviewed, and unrelated to database
  backup/recovery.
- The application **never** exposes database credentials. The browser,
  provider, vendor, agents, Graphify, Git, logs, support messages, Google
  Sheets, analytics, and normal dashboard responses never receive
  `SUPABASE_DB_URL`, PostgreSQL passwords, connection strings, Supabase
  service-role keys, JWT signing secrets, Railway tokens, GitHub
  administrative tokens, recovery codes, or raw SQL backup files.
- OnCall Foot remains the canonical prototype; every future provider instance
  remains isolated (one GitHub account/repository + one Railway
  account/project + one Supabase project/database + one private
  provider/client dataset + one instance registry entry + one
  release/migration/backup/recovery record).
- Stack roles stay fixed: GitHub = source control and approved release
  history; Railway = application hosting/runtime; Supabase = PostgreSQL
  database and auth/data services; GitHub Codespaces = optional temporary
  operator-controlled recovery workspace only, never a provider-facing backup
  delivery system.

### Capability separation at a glance

| Capability | Provider dashboard | Operator recovery process | GitHub workflow |
|---|---:|---:|---:|
| Export own business data | Yes (future) | No | No |
| Download raw SQL database dump | No | Yes, controlled | No |
| Read DB URL or service key | No | Runtime secret only | No |
| Commit/push source code | No | No | Authorized developer only |
| Create PR/merge code | No | No | Authorized developer with review/CI |
| Create Codespace secret | No | Authorized operator only | GitHub settings action |
| Use a temporary Codespace recovery workspace | No | Yes, transitional | No backup artifact committed |

Commit/push/PR/merge permissions belong to the development/release workflow
only. They are never part of any backend "backup button," provider feature, or
export flow.

---

## 2. Roles and permissions matrix

Roles map to the existing model (`docs/roles-and-permissions.md`): `client`,
`provider` (includes vendor usage), `admin` (platform operator). "Automated
recovery runner" is a future non-interactive job identity used only inside the
operator recovery control plane (Phase C) — it is not an application user role.

| Action | Provider/vendor | Client | Platform operator | Automated recovery runner |
|---|---:|---:|---:|---:|
| Request provider data export | Yes (own data, future) | No | Yes (support-assisted, audited) | No |
| Download own completed export | Yes (short-lived authenticated link) | No | No (metadata only by default; content access is an audited exception) | No |
| View export history/metadata | Yes (own) | No | Yes (non-content metadata) | No |
| Cancel an unexpired export | Yes (own) | No | Yes (audited) | No |
| Request provider-client-data export | Yes (only fields policy entitles the provider to receive) | No (clients get a separate future client-scoped path, not this feature) | Yes (audited) | No |
| Create raw SQL recovery backup | **Never through application UI** | Never | Yes — operator-only controlled workflow | Yes — only as the operator-triggered job identity |
| Access backup storage location | Never | Never | Yes (private encrypted storage) | Write-only to designated private storage |
| Run restore rehearsal | Never | Never | Yes — disposable target only | Yes — disposable target only, operator-initiated |
| View recovery metadata (non-secret) | No | No | Yes | Emits it |
| Configure backup retention | No | No | Yes | No |
| Manage GitHub/Railway/Supabase accounts | No | No | Yes (outside the application) | No |
| Commit/push repositories | No | No | No (developer/release workflow only, with review + CI) | No |
| View database credentials | **Never** | **Never** | Runtime secret injection only — never displayed, logged, or stored in app | Runtime secret injection only |
| Approve a schema migration | No | No | Yes — via the documented release gate (`docs/managed-db-release-gate.md`) | No |

Explicit markings: raw SQL artifacts, database credentials, GitHub admin
privileges, and restore operations are **operator-only** and **never available
through the application UI**. No provider/vendor dashboard role receives
recovery capability by default.

---

## 3. Provider Data Export design (future implementation)

### UX flow

```text
Dashboard Settings
→ Data and privacy
→ Export my business data
→ scope explanation
→ provider confirms request
→ export is prepared server-side
→ time-limited download appears
→ provider can download ZIP package
→ export history displays metadata only
```

Provider-facing wording lives in `docs/provider-data-export-spec.md` (no
infrastructure terminology is ever shown to providers).

### Recommended initial export contents

```text
provider-profile.json
services.csv
availability.csv
schedule-exceptions.csv
travel-zones.csv
bookings.csv
clients.csv (only fields provider is entitled to receive)
README.txt describing export date, scope, format, and privacy warning
manifest.json with non-secret export metadata and version
```

Compatibility mapping to the actual canonical schema (verify at
implementation time; do not assume 1:1 table names):

| Export file | Canonical source (today) | Notes |
|---|---|---|
| `provider-profile.json` | `provider_profiles` (+ public fields of `users`) | Allowlisted fields only; excludes verification internals and reviewer data. |
| `services.csv` | `services` | Provider-owned rows only. |
| `availability.csv` | `availability` | Weekly windows. |
| `schedule-exceptions.csv` | `provider_emergency_openings` + `provider_blocked_ranges` | Two sources, one file with a `type` column; `provider_blocked_ranges.reason` is a private provider note and is included for the owning provider only. |
| `travel-zones.csv` | `travel_zones` (+ `provider_service_areas` / `provider_coverage_areas` labels) | Territory configuration. |
| `bookings.csv` | `bookings` (+ outcome/reschedule summaries where policy permits) | Provider's own bookings only. |
| `clients.csv` | derived from the provider's own bookings | Only client fields the provider already legitimately sees in the app (e.g. name, booking contact context) — never account internals, passwords, or other providers' clients. |

### Mandatory controls for every export

- infer provider identity from the authenticated server-side session;
- never accept an arbitrary provider ID from the browser as sufficient
  authority;
- authorize every queried record server-side;
- scope queries to the authenticated provider's ownership rules;
- use explicit export DTOs/allowlists instead of `SELECT *`;
- exclude passwords, tokens, credentials, internal flags, unrelated users,
  protected notes, service-role data, and schema internals;
- use CSV injection defenses for values beginning with `=`, `+`, `-`, or `@`;
- generate the ZIP in a protected server-side context or secure job runner;
- do not persist a plaintext export longer than necessary;
- use encrypted object storage or equivalent private artifact storage;
- serve via one-time or short-lived, authenticated download URLs;
- prevent caching where practical (`Cache-Control: no-store` on download
  responses);
- rate-limit export creation;
- prevent concurrent duplicate exports;
- add audit events for `requested`, `started`, `completed`, `downloaded`,
  `expired`, `failed`, and `deleted`;
- document retention default and deletion behavior;
- show honest provider-facing wording, including that an export is a snapshot
  and not a live sync.

### Example export manifest (invented, non-production values only)

```json
{
  "export_version": "1",
  "scope": "provider_business_data",
  "requested_at": "YYYY-MM-DDTHH:MM:SSZ",
  "generated_at": "YYYY-MM-DDTHH:MM:SSZ",
  "format": "zip/csv/json",
  "included_files": [
    "provider-profile.json",
    "services.csv",
    "bookings.csv",
    "README.txt"
  ],
  "privacy_notice": "This export may contain sensitive client information. Store it securely."
}
```

### Provider export must never include

- other providers' records;
- admin-only records;
- system credentials;
- raw audit/security internals;
- internal risk/verification notes unless policy explicitly permits;
- database schema;
- unrelated marketplace records;
- hidden fields not needed for provider portability;
- raw full SQL.

---

## 4. Operator Recovery Backup design

Separate, operator-only disaster-recovery process:

```text
Authorized operator
→ explicit recovery backup request
→ purpose/reason recorded
→ preflight
→ isolated runner
→ runtime-only secret injection
→ pg_dump
→ encryption/private storage
→ non-empty verification
→ checksum/metadata
→ retention scheduling
→ restore rehearsal to disposable target
→ recovery status updated
```

Required gate for every recovery backup:

```text
authenticated platform operator
+ explicit confirmation
+ reason/purpose selection
+ recorded audit event
+ trusted isolated execution environment
+ secure runtime secret injection
+ private encrypted output storage
+ non-secret metadata record
+ retention/deletion policy
```

Explicit distinction:

```text
provider export = business portability package
recovery backup = full operational disaster-recovery artifact
```

A provider export answers "give me my business data in usable files." A
recovery backup answers "rebuild this instance's database after a disaster."
They share no delivery channel, no storage, no permissions, and no UI.

### Recordable non-secret operational metadata

```text
instance_id
backup_event_id
backup_method
runner_type
database_engine_major_version
pg_dump_major_version
backup_started_at
backup_completed_at
artifact_label
artifact_size_bytes
checksum_algorithm
checksum_value
verification_status
retention_class
planned_expiry_date
restore_rehearsal_status
restore_rehearsal_date
operator_role_label
purpose_code
```

Never record a real backup storage path, bucket, connection URL, project
reference, password, token, or client records. A backup is not considered
recovery-ready until a controlled restore rehearsal succeeds on a separately
provisioned, disposable non-production database
(`docs/restore-rehearsal-design.md`).

---

## 5. Codespaces role and limitations

Approved **transitional** pattern:

```text
GitHub Codespaces may be used temporarily by an authorized platform operator
for a manual recovery-backup run when:
- the repository is private;
- access is restricted;
- the database URL is injected as a temporary Codespaces secret;
- compatible pg_dump is installed;
- output is stored outside the repository workspace;
- output is downloaded to private encrypted storage;
- the Codespaces copy is deleted;
- the secret is deleted or rotated;
- the Codespace is stopped/deleted;
- only non-secret metadata is recorded.
```

This is a transitional operator route — **not** an application backend, not a
provider feature, not a GitHub artifact workflow, and not an automated
substitute for proper backup infrastructure at scale.

### PostgreSQL compatibility preflight (mandatory)

```text
Do not create a backup if pg_dump major version is older than the Supabase
PostgreSQL server major version. Install/use a compatible version first.
```

Observed generic failure class (factual context from the first manual attempt
— the canonical Supabase project is a Free-tier project with the application
schema in `public`; a version mismatch between the server and the default
Codespaces client tools was encountered; no identifying details are recorded
here):

```text
server version mismatch
→ no usable backup artifact
→ do not proceed
→ correct client tool version
→ rerun only after preflight passes
```

The existing script (`scripts/backup-supabase-instance.sh` / `.ps1`,
`docs/backup-supabase-instance.md`) already reads the database URL only from a
runtime environment variable, verifies the output is non-empty, and requires
the output to be kept out of the repository. The preflight above must be added
to the operator procedure (and eventually to the script) before the next real
run.

---

## 6. Future implementation boundaries

```text
Phase A — Documentation and recovery readiness
- existing backup script;
- restore rehearsal script;
- instance registry;
- release/migration gate;
- audit model design;
- no live application backup button.

Phase B — Provider data export MVP
- Settings UI;
- server-side authorization;
- data allowlists/DTOs;
- CSV/JSON generation;
- secure short-lived delivery;
- export audit trail;
- unit/integration tests;
- privacy wording;
- retention/deletion.

Phase C — Operator recovery control plane
- separate authenticated operator function;
- job queue/runner;
- secret manager;
- encrypted artifact store;
- immutable audit events;
- restore rehearsal automation;
- monitoring/alerts;
- key rotation;
- per-instance operational reporting.
```

Phase C is a **platform-operations capability**. It must not be implemented by
issuing the normal Foot app a GitHub repository-admin token, and it never
shares credentials, storage, or UI with the provider dashboard. Phase B is
deferred until canonical production journey validation passes
(`docs/NEXT-STEPS.md` sequencing).

---

## 7. Threat model and controls

| Threat | Primary controls |
|---|---|
| Provider tries to export another provider's data | Identity from server session only; per-record server-side ownership authorization; provider-scoped queries; integration tests mirroring `authorization-hardening.integration.test.ts`. |
| Client tries to export provider data | Role gate (`requireRole('provider')` + approved-provider gate); export routes unavailable to client role; audit events. |
| CSV formula injection | Escape/prefix values starting with `=`, `+`, `-`, `@`; test fixtures include hostile values. |
| Stale/forwarded download link | One-time or short-lived signed URLs bound to the authenticated provider; re-auth on download; `no-store` caching; expiry audit event. |
| Export artifact retained too long | Default retention window + scheduled deletion job + `deleted` audit event; no plaintext persistence beyond need. |
| Raw SQL accidentally returned by API | No API path ever reads dump artifacts; recovery storage is disconnected from app runtime; contract tests assert export responses are DTO-shaped only. |
| Database URL logged | Secrets only via runtime env/secret manager; logging redaction review; scripts never echo the URL; `scripts/secret-scan.sh` in CI. |
| GitHub token over-scoped | No GitHub token in the application at all; any future OAuth is minimal-scope, optional, separately reviewed, unrelated to backup. |
| Secret accidentally committed | Deny-list secret scan (`scripts/secret-scan.sh`) + `.gitignore` + PR review + docs use placeholders only. |
| Codespace left running | Operator checklist requires stop/delete + secret deletion/rotation as completion steps; non-secret metadata records closure. |
| PostgreSQL client/server mismatch | Mandatory version preflight (pg_dump major ≥ server major) before any dump; failure class documented; rerun only after preflight passes. |
| Restore accidentally targets production | Disposable-target-only design: explicit `--confirm-disposable-target`, second typed confirmation, source/destination identity mismatch validation, disposable naming convention, refuse-on-uncertainty (`docs/restore-rehearsal-design.md`). |
| Migration occurs without recovery evidence | Release gate requires recorded fresh backup + verification before DDL (`docs/managed-db-release-gate.md`, instance checklist). |
| Operator account compromise | Operator actions require explicit confirmation + purpose codes + immutable audit events; secrets are runtime-injected (nothing durable to steal from the app); scoped, rotatable credentials; alerting in Phase C. |

---

## 8. Scaling and future isolated instances

```text
Every provider instance gets its own export records and recovery evidence.

The canonical repository defines the implementation and policy.
Each isolated instance uses the same approved release and configuration contract.
No instance's provider/client data, export artifacts, credentials, or recovery
files belong in the canonical repo, Graphify, Google Sheet registry, or another
provider's instance.
```

Per `docs/canonical-prototype-and-instance-model.md`: export/recovery
implementation and policy are canonical core (developed and released here);
each instance's actual export artifacts, backup artifacts, metadata records,
and rehearsal evidence are per-instance operational data recorded in that
instance's own registry row — labels/dates/statuses only, never content.

---

## 9. Explicit non-goals

This design does **not** authorize:

- direct database backup from a provider UI;
- GitHub admin OAuth for Foot application users;
- repository commits/pushes for exports/backups;
- storage of exports/backups in Git;
- SQL dump delivery to providers;
- live database access by agents;
- production deployment;
- migration application;
- account provisioning;
- storing secrets in documentation;
- treating a non-empty dump as a verified restore.
