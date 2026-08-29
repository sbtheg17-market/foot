# Restore Rehearsal Design — Disposable-Target-Only

**Added:** 2026-08-29. Companion to
`docs/provider-export-and-recovery-backup-architecture.md` (§4–§5),
`docs/backup-supabase-instance.md`, and `docs/backup-restore-runbook.md`.
Design only — no restore script is implemented or executed by this task.

Core rule:

```text
A backup is not recovery-ready until a controlled restore rehearsal succeeds
on a separately provisioned, disposable, non-production database.
A non-empty dump file is necessary evidence, never sufficient evidence.
```

---

## Requirements for the future restore script and manual procedure

```text
- accepts a local backup path and a target DB URL only from environment variables;
- requires an explicit --confirm-disposable-target acknowledgement;
- requires a second typed confirmation;
- rejects identical source and target identities when detectable;
- requires a target label with a disposable/test convention;
- refuses to run if safety checks cannot pass;
- never logs either URL or credentials;
- records only non-secret success/failure metadata;
- performs non-destructive post-restore verification;
- provides required cleanup/deletion of the disposable target;
- never runs automatically from provider UI;
- never restores into production.
```

## Proposed interface (design — verify at implementation time)

```text
Environment (never CLI arguments, never printed):
  RESTORE_BACKUP_PATH   local path to the .sql backup file
  RESTORE_TARGET_DB_URL connection string of the DISPOSABLE target only

Invocation:
  scripts/restore-rehearsal.sh --confirm-disposable-target
  → prompts: type the exact phrase "restore to disposable target" to continue
```

## Safety checks (all must pass; any failure = refuse and exit non-zero)

1. `--confirm-disposable-target` flag present.
2. Second typed confirmation matches exactly.
3. Backup file exists, is non-empty, and looks like a plain-SQL dump
   (header sniff), without printing its contents.
4. Target URL is set via environment and is non-empty.
5. **Identity mismatch:** where detectable, the target host/database identity
   must differ from any known production identity for the instance; if the
   script cannot demonstrate the destination is non-production/disposable, it
   halts.
6. **Disposable naming convention:** the target database name (or an explicit
   operator-supplied target label) must match a disposable/test convention
   (e.g. contains `disposable`, `rehearsal`, or `resttest`); otherwise refuse.
7. `psql`/restore client major version compatible with the target server
   (same preflight philosophy as backup: client major ≥ server major).
8. Target database is empty or explicitly acknowledged as overwritable test
   data — never a database containing production-shaped live data.

## Execution and verification

- Restore runs against the disposable target only; neither URL nor credential
  is ever logged, echoed, or stored.
- Non-destructive post-restore verification (read-only):
  - expected application tables exist;
  - representative row counts are non-zero where the source had data;
  - a small set of sanity queries succeed (no writes).
- Outcome recorded as **non-secret metadata only** (aligns with the
  architecture doc's metadata list): `restore_rehearsal_status`,
  `restore_rehearsal_date`, backup `artifact_label`, checksum match result,
  verification summary (counts only), operator role label, purpose code.

## Mandatory cleanup

- The disposable target database/project is deleted after verification;
  deletion is part of the rehearsal definition, not optional hygiene.
- Local working copies of the backup made for the rehearsal are removed;
  the canonical private backup copy remains in its encrypted storage.
- Cleanup completion is recorded in the same non-secret metadata record.

## Prohibitions

- Never target production, staging-shared, or any database serving real
  users.
- Never run from, or be triggered by, the provider dashboard or any
  application UI.
- Never store the backup, the target URL, credentials, or restored data in
  Git, Graphify, the instance registry, screenshots, tickets, or chat.
- Never treat rehearsal success on one instance as evidence for another
  instance's backups.
