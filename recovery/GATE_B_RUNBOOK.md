# GATE B RUNBOOK — Managed Database Verification (one page, owner-facing)

Purpose: verify the managed database is the expected instance, reachable, and in the
expected pre-persistence state — WITHOUT ever exposing the credential.
Environment: MANAGED ENVIRONMENT ONLY. Never run from a development pod or laptop.

## 1. Secret handling (hard rules)
- DATABASE_URL is injected at runtime by the platform (env var). You never type it,
  paste it, or store it.
- Never print, echo, log, checksum, or persist the value. Never pass it as a CLI
  argument (process lists leak). Tools must read it from the environment only.
- All command output goes through capture.py, which redacts credentialed URLs and
  token-shaped strings BEFORE anything is written. If a tool prints a connection
  string on failure, the capture layer redacts it; do not bypass capture.py.
- On completion the injected variable dies with the session. Do not export it to
  files, shell profiles, or child environments beyond the check commands.

## 2. Pre-flight
- [ ] You are in the managed environment (hostname/pod identity recorded).
- [ ] `test -n "$DATABASE_URL"` returns 0 (presence check only — value never shown).
- [ ] capture.py + record_action.py present; ledger path writable; append-only confirmed.

## 3. Catalog checks (run each under capture.py; psql reads $DATABASE_URL itself)
Each: `python3 capture.py --name "gate B <check>" --type gate -- psql -X -A -t -c "<SQL>"`
1. Identity     — `SELECT current_database(), version();`
                  EXPECT: expected database name; PostgreSQL 15.x.
2. Connectivity — `SELECT 1;`  EXPECT: 1 row, value 1, exit 0.
3. Role & perms — `SELECT current_user, session_user;` then
                  `SELECT has_database_privilege(current_database(),'CREATE');`
                  EXPECT: the bounded verification role, NOT a superuser; CREATE
                  matches the role contract (normally false for verify-only).
4. Catalog      — `SELECT schema_name FROM information_schema.schemata ORDER BY 1;`
                  EXPECT: baseline schemas only (public + platform schemas).
5. Schema state — `SELECT table_name FROM information_schema.tables WHERE
                  table_schema='public' ORDER BY 1;`
                  EXPECT: the exact pre-migration table set (empty if Phase 4C
                  persistence has not been approved — comfort tables MUST NOT exist).
6. Migrations   — `SELECT * FROM <migrations_table> ORDER BY applied_at DESC LIMIT 5;`
                  EXPECT: last applied migration equals the recorded baseline; if the
                  table is absent, record that finding — absence is itself the state.

## 4. Output, evidence, classification
- Redaction: capture.py redacts every string before persisting; spot-check each log
  for `postgres://` remnants — any hit is a capture defect: delete nothing, record a
  superseding entry, fix, rerun.
- Each check records: command, start time, duration, exit code, redacted output tail,
  artifact log path + checksum — one ledger record per check (append-only).
- PASS       expected result, exit 0.
- FAIL       wrong identity/permissions/schema state, exit != 0 — stop; do not "fix"
             the database from this runbook; escalate with the record id.
- BLOCKED    environment or injection unavailable (record reason; command not run).
- UNRECORDED output lost/timeout — schedule rerun; never reconstruct from memory.
- Gate B overall = PASS only if checks 1–6 are individually PASS in the same session.

## 5. After the run
- `python3 record_action.py verify && python3 record_action.py summary`
- Export ONLY the redacted logs + ledger lines as evidence. The DATABASE_URL value
  appears nowhere; its existence is proven by the successful connection records.
- Gate B PASS unlocks nothing by itself: schema/migrations/storage remain blocked
  until their own prerequisites and approvals are met.
