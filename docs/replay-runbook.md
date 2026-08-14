# Replay Runbook — `prevented_booking_records` Reconciliation (Gate 3)

This runbook governs every execution of
`artifacts/api-server/src/scripts/replay-prevented-bookings.ts` against a
production database. **Production replay is a separately authorized, operator-
confirmed, one-run-at-a-time operation.** Nothing in this document authorizes
an execution by itself.

The script is idempotent by `correlation_id`, but the safety posture treats
every production write as irreversible: prepare the input carefully, dry-run
first, cap everything, run once, and stop.

---

## 1. Input source: Railway log-explorer export

The production source of truth for missed recording events is the **Railway
log explorer** for the `web` service (project `gallant-commitment`,
environment `production`). Export the structured log lines containing
`"evt":"prevented_booking_record_failed"` for the incident window.

### Why the Railway filesystem must never be relied upon

Railway service filesystems are **ephemeral**: every deployment, restart,
crash, or instance migration replaces the container and discards anything
written to local disk — including the local DLQ file
(`PREVENTED_BOOKING_DLQ_PATH`) between restarts. A DLQ file observed inside a
running container may vanish at any moment and must be treated as a
best-effort buffer, not an archive. The durable record of failed writes is
the **platform log stream**, which Railway retains independently of the
container lifecycle. Always reconstruct replay input from the log-explorer
export, never from an assumption that a container file survived.

### Export and save locally

1. In the Railway log explorer, filter the `web` service logs to the incident
   window and the string `prevented_booking_record_failed`.
2. Download/export the matching lines and save them on the **operator's local
   machine** (never inside a repository, never in object storage shared with
   the application, never back onto the Railway container), e.g.:
   `~/replay-inputs/<date>-prevented-bookings-export.raw.ndjson`.

## 2. Curate the input artifact (credential and PII scrub)

Work on a **copy**; the raw export stays untouched.

1. **Keep only** lines whose JSON contains
   `"evt":"prevented_booking_record_failed"`. Remove every unrelated log
   envelope (request logs, health checks, startup banners, platform wrapper
   JSON around the pino line, etc.). If the export wraps each pino line in a
   platform envelope, unwrap to the original pino JSON line — the replay
   validator tolerates only the standard pino envelope fields
   (`level`, `time`, `pid`, `hostname`, `msg`) plus `evt`/`payload`.
2. **Remove any credential material**: connection strings, passwords, API
   keys, JWT values, session cookies, `Authorization`/`Cookie` headers, and
   any line that even partially embeds them. The expected payload contains
   only numeric ids, UUIDs, ISO timestamps, and the enum `path` — anything
   else does not belong in the artifact.
3. **Remove unrelated PII.** The payload schema is PII-free by design
   (`marketplaceId`, `correlationId`, `occurredAt`, `actorUserId`,
   `subjectBookingId`, `providerId`, `serviceId`, `scheduledAt`, `path`).
   If an exported line carries anything beyond that schema, drop the line —
   the strict validator would reject it anyway, and the `.invalid.ndjson`
   file must never become a PII store.
4. One JSON object per line (NDJSON), UTF-8, no trailing commentary.

### Preserve the original read-only

Keep the raw export exactly as downloaded and mark it read-only:

```bash
chmod 444 ~/replay-inputs/<date>-prevented-bookings-export.raw.ndjson
```

The curated artifact is a separate file, e.g.
`~/replay-inputs/<date>-prevented-bookings.approved.ndjson`. Once approved it
must never be edited again — any change requires re-hashing and
re-authorization. Mark it read-only too:

```bash
chmod 444 ~/replay-inputs/<date>-prevented-bookings.approved.ndjson
```

## 3. Compute and record the input integrity metadata

```bash
shasum -a 256 <approved-file>     # SHA-256 (macOS; use sha256sum on Linux)
wc -c <approved-file>             # byte count
grep -c . <approved-file>         # non-blank record (event) line count
```

**Review the exact event count**: open the file and confirm the number of
event lines equals the count above and matches the incident expectation
(e.g., "the outage window produced 3 failed writes → 3 lines"). If the count
surprises you, stop and re-curate; do not "fix it later with caps".

## 4. Approve the input artifact

The operator records, in the authorization channel:

- the approved file's basename;
- its SHA-256;
- its byte count;
- its exact event (record-line) count;
- the incident window it covers.

Only an artifact with recorded metadata may proceed to a dry-run.

## 5. Dry-run first (always)

The dry-run parses and strictly validates the entire input and classifies
every record as `would_insert` or `already_present` using **read-only
existence checks by `correlation_id`** — that SELECT is the only database
access a dry-run performs. It executes **no INSERT, UPDATE, DELETE, or DDL**,
and its report is labeled `DRY RUN`.

```bash
DATABASE_URL=<target-from-secret-manager> \
pnpm --filter @workspace/api-server run replay:prevented-bookings -- \
  --input <approved-file> --dry-run
```

The dry-run summary reports the **`target_fingerprint`** — the first
12 hex characters of `SHA-256("host:port/dbname")` derived from
`DATABASE_URL`. Username, password, query parameters, and the raw URI are
never part of the fingerprint input and never appear in any output; the
fingerprint lets the operator confirm the intended target **without exposing
credentials**. Optionally rehearse the full confirmation set (recommended):

```bash
... -- --input <approved-file> --dry-run \
  --confirm-target <fingerprint> \
  --max-events <event-count> --max-writes <expected-inserts> \
  --expect-sha256 <sha256>
```

### Review the dry-run summary

Confirm ALL of the following before requesting live authorization:

- `mode` is `DRY_RUN` and the log line says `DRY RUN`;
- `input_sha256` equals the approved SHA-256; `input_bytes` and
  `input_lines` equal the recorded byte and event counts;
- `invalid = 0` and `failed = 0` (otherwise stop, inspect the local
  `.invalid.ndjson` / `.failed.ndjson`, and re-curate — never live-run an
  input that does not dry-run clean);
- `would_insert` and `already_present` match the incident expectation;
- `target_fingerprint` is the intended target.

## 6. Final execution confirmation (required authorization block)

A live run requires the operator to post this block, completely filled in, in
the authorization channel. There is **no automatic approval mechanism**: the
script cannot store confirmations, and nothing may bypass this explicit
operator step or persist secrets to make it "easier".

```text
REPLAY EXECUTION AUTHORIZATION — one run only
Input basename:        <approved-file basename>
Input SHA-256:         <64-hex>
Input line count:      <exact event count>
Target fingerprint:    <12-hex from the dry-run summary>
--max-events:          <N — equal to the input line count>
--max-writes:          <N — equal to the expected would_insert count>
Dry-run summary:       read=<n> would_insert=<n> already_present=<n>
                       invalid=0 failed=0 input_sha256=<matches>
Single-run rule:       this authorization covers exactly ONE execution.
No-retry rule:         if the run partially fails, DO NOT re-run without a
                       fresh authorization referencing the failure report.
Statement:             production writes are authorized for this one run only.
```

## 7. The one capped live run

```bash
DATABASE_URL=<target-from-secret-manager> \
pnpm --filter @workspace/api-server run replay:prevented-bookings -- \
  --input <approved-file> \
  --confirm-target <fingerprint> \
  --max-events <event-count> \
  --max-writes <expected-inserts> \
  --expect-sha256 <sha256>
```

Enforcement (all validated before any write; violations exit `2`):

- all four safety options are **mandatory** — a missing or malformed option,
  a hash mismatch, or a fingerprint mismatch aborts with exit code `2`;
- if the input holds more record lines than `--max-events`, the run aborts
  **before any write**;
- when inserted rows reach `--max-writes`, the run **stops safely**, reports
  `write_cap_reached: true` plus the `unprocessed` count, and exits nonzero —
  it never silently continues beyond a cap;
- per-record idempotency (`ON CONFLICT (correlation_id) DO NOTHING`) and
  bounded per-record retry (250ms / 1s / 4s, then dead-letter) are unchanged;
  there is no whole-job automatic retry.

## 8. No retry after a partial failure

If the run exits nonzero, reports `failed > 0`, reports `unprocessed > 0`, or
is interrupted: **stop**. Do not re-run, do not raise the caps, do not edit
the input. Collect the summary line and the local `.invalid.ndjson` /
`.failed.ndjson` files, report to the operator, and wait for a fresh
authorization that explicitly references the failure. (Idempotency makes an
authorized follow-up run safe; the authorization gate — not the script — is
what permits it.)

## 9. Preserve the local output files

`<input>.invalid.ndjson` and `<input>.failed.ndjson` are written **next to
the input file on the operator's local machine only**. Preserve them with the
raw export and the approved artifact for the incident record. They may
contain raw exported lines — treat them with the same care as the export
itself, keep them out of Git, chat, tickets, and object storage, and never
paste their contents into reports.

## 10. Credential-free reporting requirements

Every report about a replay (dry-run or live) may contain **only**:

- the summary log line fields (`mode`, counters, `input_sha256`,
  `expected_sha256`, `input_bytes`, `input_lines`, `input_basename`,
  `target_fingerprint`, caps, `write_cap_reached`, `duration_ms`);
- correlation ids and classifications from the audit lines.

Never include: `DATABASE_URL` or any connection string, usernames, passwords,
tokens, cookies, authorization headers, raw input/invalid/failed line
contents, or full local file paths (basename only). The script itself never
prints any of these; reports must not reintroduce them.
