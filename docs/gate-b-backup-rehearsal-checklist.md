# Gate-B Backup and Restore Rehearsal Checklist (operator-only)

**Added:** 2026-09-06. Operator-facing, end-to-end sequence that connects the
existing local-only backup/restore tooling to the Gate-B release process.
Companions: `docs/backup-supabase-instance.md`,
`docs/restore-supabase-instance-rehearsal.md`, `docs/backup-restore-runbook.md`,
`docs/restore-rehearsal-design.md`, `docs/managed-db-release-gate.md`,
`docs/gate-b-artifact-extraction-review.md`,
`docs/gate-b-catalog-queries-readonly.sql`.

## Authoritative execution model (policy)

```text
Authoritative execution:
  Operator-run local scripts on a trusted machine
  (scripts/backup-supabase-instance.sh|.ps1 and
   scripts/restore-supabase-instance-rehearsal.sh|.ps1)

Never:
  GitHub Actions or any CI execution of backup or restore
  CI-held database credentials
  Unattended or scheduled automation against the managed database
  Backup contents, dumps, exports, or archives committed to Git or Git LFS
  GitHub Actions artifacts as a backup destination
  Vendor-dashboard-triggered restore
```

This checklist does not weaken, reinterpret, or replace the CI prohibition in
the existing scripts. Completing this checklist produces *evidence*; it never
authorizes a production migration or deployment by itself.

## Phase 0 — Preconditions

- [ ] Named operator authorized to run a backup for this change window.
- [ ] Trusted local machine; private terminal session.
- [ ] PostgreSQL client tools installed; `pg_dump --version` and
      `psql --version` report major version **17 or newer** (production server
      is PostgreSQL 17; the script preflight enforces client ≥ server).
- [ ] Connection string obtained privately via the approved Supabase dashboard
      process (see `docs/backup-supabase-instance.md`) and held in a password
      manager only. Never in repository files, chat, tickets, or shell
      profiles.
- [ ] `SUPABASE_DB_URL` exported for the current shell session only.
- [ ] Output directory chosen **outside every Git working tree**.

## Phase 1 — Create and verify the backup

- [ ] Run `bash scripts/backup-supabase-instance.sh --output-dir <private-dir>`
      (or the `.ps1` equivalent). The script fails closed on missing tools,
      version mismatch, dump failure, or an empty output file.
- [ ] Confirm the file exists and is non-empty (script-enforced).
- [ ] Head-sniff the first ~50 lines: PostgreSQL comment headers,
      `CREATE TABLE`, `COPY … FROM stdin` (see
      `docs/backup-supabase-instance.md` → Verifying).
- [ ] Compute and record the plaintext integrity checksum (safe metadata):

      ```bash
      sha256sum <backup-file>.sql
      ```

- [ ] A backup is **not complete** until: file exists, is non-empty, passes the
      head-sniff, and its SHA-256 is recorded in the evidence record.

Scope note (roles/schema/data): the current tooling produces a single plain
SQL export of the `public` schema with `--no-owner --no-privileges`. Database
**roles are not exported**, and custom role passwords are never represented by
logical backups — role/permission reconstruction on a restored target is a
separate operator task. The Supabase CLI `supabase db dump` supports separate
roles / schema / data exports with Supabase-specific filtering; adopting it is
a possible future, operator-approved enhancement — not part of this checklist,
and never run from CI.

## Phase 2 — Encrypt before any off-machine storage (operator-controlled)

Encryption is required before the backup leaves the trusted machine. Keys and
passphrases are operator custody only — never in the repository, never in
command-line arguments, never in logs.

- [ ] Encrypt with an interactive-passphrase or key-file tool, for example:

      ```bash
      # gpg: prompts for the passphrase; never pass it as an argument
      gpg --symmetric --cipher-algo AES256 <backup-file>.sql
      # or age with an operator-held identity/recipient file
      ```

- [ ] Verify the round trip: decrypt to a temporary file, compare its SHA-256
      against the recorded plaintext checksum, then delete the temporary
      plaintext copy.
- [ ] Record the SHA-256 of the **encrypted** file (safe metadata).
- [ ] Remove plaintext working copies per the data-owner's retention policy;
      the canonical private copy is the encrypted one.
- [ ] Key/passphrase custody and rotation owner recorded in the evidence
      record.

## Phase 3 — Store in the approved private destination

- [ ] Destination is an operator decision (encrypted drive, password-manager
      attachment, or owner-controlled private storage — see
      `docs/backup-supabase-instance.md` → Storing). No vendor is selected or
      configured by this repository.
- [ ] Never: Git, Git LFS, GitHub releases, GitHub Actions artifacts, shared
      or public folders.
- [ ] Record only safe opaque labels (filename, location note without
      credentials or URLs) in the evidence record.

## Phase 4 — Disposable restore rehearsal

- [ ] Provision a **fresh, empty, disposable, non-production** PostgreSQL
      target (major version 17 or newer) under operator control.
- [ ] Confirm the rehearsal target is not the production source. The script
      also refuses to run when `RESTORE_TARGET_DB_URL` equals
      `SUPABASE_DB_URL`.
- [ ] Decrypt the backup locally; verify its SHA-256 matches the recorded
      plaintext checksum **before** restoring.
- [ ] Export `RESTORE_TARGET_DB_URL` (session only) and set
      `RESTORE_EXPECTED_SERVER_MAJOR=17` for the source cross-check.
- [ ] Run `bash scripts/restore-supabase-instance-rehearsal.sh
      --backup-file <path> --target-label <label-containing-disposable>
      --confirm-disposable-target` and complete the typed confirmation
      `RESTORE TO DISPOSABLE TARGET` (all safety gates in
      `docs/restore-supabase-instance-rehearsal.md` apply; single transaction,
      `ON_ERROR_STOP`, private error log, no secret output).

## Phase 5 — Post-restore validation (read-only)

- [ ] Script verification passed (connection, server major version, `public`
      table count).
- [ ] Extension check (read-only; compare against the source's expected list):

      ```sql
      SELECT extname, extversion FROM pg_catalog.pg_extension ORDER BY extname;
      ```

- [ ] Critical tables present: `users`, `bookings`, `provider_profiles`,
      `support_tickets`, plus the two applied Gate-B artifact footprints.
- [ ] Approved safe count/health checks only (counts and schema metadata —
      never row contents into chat, tickets, or documents).
- [ ] Application compatibility checks as approved (build/tests against the
      disposable target only).
- [ ] Reconfirm the restored target is disposable and non-production, and that
      no scheduled jobs, notifications, or external integrations can run from
      it. Storage objects, Edge Functions, auth-provider settings, secrets,
      SMTP, DNS, and domains are **not** restored by a logical database backup
      and would need separate handling in a real recovery.

## Phase 6 — Gate-B handoff (after a successful rehearsal)

1. - [ ] Confirm the target used for Gate-B preflight evidence is
         non-production.
2. - [ ] Confirm artifact state is exactly **2 existing / 8 absent /
         0 partial** (the two applied artifacts
         `PREVENTED_BOOKING_RECORDS_V1` and
         `PROVIDER_APPLICATION_REJECTION_REASON_V1` must never be reapplied).
3. - [ ] Run the §7 prerequisite enum/key catalog check in
         `docs/gate-b-catalog-queries-readonly.sql`; any non-`PASS` row is a
         stop condition.
4. - [ ] Run the deferred §6 R1 collision check in the same file during an
         approved preflight window; review the REQUIRED verdict row and any
         ADVISORY rows with a named human.
5. - [ ] Obtain named human SQL approval for the eight-artifact order
         (draft: `docs/gate-b-artifact-extraction-review.md` §7) **and** for
         transaction/error-stop handling (the self-wrapped
         `PREVENTED_BOOKINGS_DAILY_V1` is reviewed separately).
6. - [ ] Apply **nothing**. Artifact application requires a separate,
         explicit rehearsal/production authorization that this checklist does
         not grant.

## Phase 7 — Cleanup

- [ ] Capture all evidence (safe metadata only) **before** cleanup.
- [ ] Delete the disposable restore target (deletion is part of the rehearsal
      definition — `docs/restore-rehearsal-design.md`).
- [ ] Delete local decrypted working copies and any `.restore-error.log`.
- [ ] `unset SUPABASE_DB_URL RESTORE_TARGET_DB_URL` / close the session.
- [ ] Record cleanup completion in the evidence record.

## Phase 8 — Record the evidence

Fill `docs/backup-release-evidence-template.md` (copy it per release; safe
labels only) and attach it to the release record required by
`docs/backup-restore-runbook.md` and `docs/managed-db-release-gate.md`.

## Prohibitions (non-negotiable)

```text
Never restore to production.
Never run backup or restore from CI, GitHub Actions, application runtime,
  a vendor dashboard, or unattended automation.
Never commit dumps, exports, archives, encrypted payloads, error logs,
  connection strings, keys, or passphrases to Git.
Never print or record hostnames, project references, URLs, credentials,
  or row data in evidence documents.
Never treat this checklist's completion as migration or deployment
  authorization.
```
