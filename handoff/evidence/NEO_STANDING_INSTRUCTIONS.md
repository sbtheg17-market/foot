# NEO STANDING INSTRUCTIONS — sbtheg17-market/foot workspace
Version 2 — 2026-08-10. Applies to every Neo session in this lineage. Read together with
/app/memory/STATE_MATRIX_v3_2026-08-10.md and the evidence ledger in /app/memory/evidence/.

## Evidence and provenance rule (owner-mandated, verbatim)

> Do not rely on "I ran it" as evidence. Persist the command, environment, exit code,
> counts, duration, artifact path, checksum, and remote-state effect. If stdout or exit
> status is lost, classify the result as UNRECORDED and rerun it. Before rerunning,
> search the handoff logs and artifact index so an already captured successful result
> is not repeated unnecessarily.

## What must be recorded
For EVERY setup, build, test, gate, reconstruction, or handoff action, append one
machine-readable JSONL record to /app/memory/evidence/LEDGER.jsonl via
`python3 /app/memory/evidence/record_action.py append <record.json>` containing:
- timestamp in UTC (ISO 8601);
- agent/session/workspace identifier;
- repository, branch, and exact commit;
- parent, tree, and patch checksum when applicable;
- runtime versions: Node, pnpm, PostgreSQL, OS/container image;
- exact command or tool action (REDACTED before persistence);
- test/gate name;
- duration (seconds; null if not captured — say so in notes);
- exit code;
- status classification (see below);
- test counts and failed-test details;
- artifact/log path and SHA-256 checksum;
- whether the action changed files, refs, or remote state;
- whether the result is reproducible;
- next action and whether approval is required.

## Mandatory status taxonomy (classify every result)
- PASS — captured and reproducible
- FAIL — captured with diagnosis
- BLOCKED — external prerequisite missing
- UNRECORDED — output lost or tool timeout; must rerun
- NOT_RUN — deliberately not executed

## Ledger discipline
- LEDGER.jsonl is APPEND-ONLY. Never edit or delete existing lines; corrections are new
  records with `"supersedes": "<id>"`.
- After appending, run `python3 /app/memory/evidence/record_action.py verify` (validates
  schema, checksums, secret-scan) and regenerate the human summary with
  `python3 /app/memory/evidence/record_action.py summary`.
- Before rerunning any test/gate, run
  `python3 /app/memory/evidence/record_action.py search <keyword>` to find an already
  captured successful result — do not repeat captured PASSes unnecessarily.

## Redaction (hard rule)
Never record tokens, passwords, database URLs with credentials, private keys, secrets,
or unnecessary personal data. The recorder redacts automatically, but redact command
output yourself BEFORE persistence as well. If a secret ever lands in the ledger,
append a correction record and rotate the secret — do not rewrite history.

## Standing repository rules (carried forward)
- Canonical base: origin/main only. Never base work on any conflict_* branch.
- All 19 conflict_* branches are preserved evidence; no deletion without the pinned
  Gate A inventory + authenticated verification.
- No push without: branch-protection export, required audit-log coverage, explicit
  per-candidate owner approval, and a fresh bounded write credential per window
  (never an audit credential). Commit metadata is NOT sufficient attribution.
- Gate B (managed DB) is not passed until verified in the managed environment with a
  runtime-injected DATABASE_URL. No schema/migrations/storage/production events before.
- Publication sequencing: A′ first; C′ and B′ re-derived on the new tip afterwards with
  NEW identities; any rebase creates a new candidate identity.
