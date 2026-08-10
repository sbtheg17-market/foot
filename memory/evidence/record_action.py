#!/usr/bin/env python3
"""
Append-only provenance ledger for Neo sessions (sbtheg17-market/foot workspace).

Subcommands:
  append <record.json|->   validate + redact + append one record to LEDGER.jsonl
  verify                   validate every record, recompute artifact checksums,
                           secret-scan the whole ledger (exit 1 on any problem)
  summary                  regenerate LEDGER_SUMMARY.md from the ledger
  search <keyword>         print matching records (id, status, name) so already
                           captured PASSes are not repeated unnecessarily

Design rules:
  - append-only: never rewrites existing lines; corrections use "supersedes"
  - redaction happens on EVERY string field before persistence
  - no secrets: tokens, passwords, credentialed URLs, private keys are replaced
"""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

EVIDENCE_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(EVIDENCE_DIR, "LEDGER.jsonl")
SUMMARY = os.path.join(EVIDENCE_DIR, "LEDGER_SUMMARY.md")

STATUSES = {"PASS", "FAIL", "BLOCKED", "UNRECORDED", "NOT_RUN"}
ACTION_TYPES = {
    "setup", "build", "test", "gate", "reconstruction", "handoff",
    "inspection", "commit", "publication", "verification",
}

REQUIRED_TOP = [
    "schema_version", "id", "timestamp_utc", "agent", "repo", "runtime",
    "action", "duration_seconds", "exit_code", "status", "tests",
    "artifacts", "effects", "reproducible", "next_action",
    "approval_required", "backfilled", "notes",
]
REQUIRED_AGENT = ["name", "session", "workspace"]
REQUIRED_REPO = ["repository", "branch", "commit"]
REQUIRED_RUNTIME = ["node", "pnpm", "postgresql", "os_container"]
REQUIRED_ACTION = ["type", "name", "command"]
REQUIRED_EFFECTS = ["files_changed", "refs_changed", "remote_changed"]

# --- redaction -------------------------------------------------------------
REDACTIONS = [
    # credentialed connection URLs (scheme://user:pass@host → scheme://<REDACTED>@host)
    (re.compile(r"\b(postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis|amqp)://[^\s/@]+@", re.I),
     r"\1://<REDACTED>@"),
    # env-style assignments
    (re.compile(r"\b(JWT_SECRET|SESSION_SECRET|PASSWORD|PASSWD|TOKEN|SECRET|API_KEY|DATABASE_URL|ACCESS_KEY|PRIVATE_KEY)(=)[^\s'\"]+", re.I),
     r"\1\2<REDACTED>"),
    # well-known token shapes
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"), "<REDACTED-GH-TOKEN>"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"), "<REDACTED-GH-TOKEN>"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "<REDACTED-AWS-KEY>"),
    (re.compile(r"\bsk-[A-Za-z0-9\-_]{16,}\b"), "<REDACTED-API-KEY>"),
    (re.compile(r"Bearer\s+[A-Za-z0-9\-_\.=]{12,}"), "Bearer <REDACTED>"),
    (re.compile(r"eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{5,}"), "<REDACTED-JWT>"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
     "<REDACTED-PRIVATE-KEY-BLOCK>"),
]
# patterns that must never survive in the persisted ledger
FORBIDDEN = [
    re.compile(r"://[^\s/@<]+:[^\s/@<]+@"),          # user:pass@ in any URL
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\."),
]


def redact(value):
    if isinstance(value, str):
        for pattern, repl in REDACTIONS:
            value = pattern.sub(repl, value)
        return value
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    return value


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def validate(record, line_no=None):
    where = f"line {line_no}" if line_no else "record"
    errors = []
    for key in REQUIRED_TOP:
        if key not in record:
            errors.append(f"{where}: missing field '{key}'")
    if errors:
        return errors
    for key in REQUIRED_AGENT:
        if key not in record["agent"]:
            errors.append(f"{where}: agent missing '{key}'")
    for key in REQUIRED_REPO:
        if key not in record["repo"]:
            errors.append(f"{where}: repo missing '{key}'")
    for key in REQUIRED_RUNTIME:
        if key not in record["runtime"]:
            errors.append(f"{where}: runtime missing '{key}'")
    for key in REQUIRED_ACTION:
        if key not in record["action"]:
            errors.append(f"{where}: action missing '{key}'")
    for key in REQUIRED_EFFECTS:
        if key not in record["effects"]:
            errors.append(f"{where}: effects missing '{key}'")
    if record["status"] not in STATUSES:
        errors.append(f"{where}: invalid status '{record['status']}' (must be one of {sorted(STATUSES)})")
    if record["action"].get("type") not in ACTION_TYPES:
        errors.append(f"{where}: invalid action.type '{record['action'].get('type')}'")
    try:
        ts = record["timestamp_utc"]
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if not ts.endswith("Z"):
            errors.append(f"{where}: timestamp_utc must be UTC ('Z' suffix)")
    except Exception:
        errors.append(f"{where}: unparseable timestamp_utc")
    if not isinstance(record["artifacts"], list):
        errors.append(f"{where}: artifacts must be a list")
    else:
        for art in record["artifacts"]:
            if not isinstance(art, dict) or "path" not in art or "sha256" not in art:
                errors.append(f"{where}: each artifact needs path + sha256")
    if record["status"] == "FAIL":
        tests = record.get("tests") or {}
        diag = (record.get("notes") or "") + json.dumps(tests.get("failed_details", []))
        if len(diag.strip()) < 10:
            errors.append(f"{where}: FAIL requires a diagnosis in notes/failed_details")
    if record["status"] == "UNRECORDED" and "rerun" not in (record.get("next_action") or "").lower():
        errors.append(f"{where}: UNRECORDED requires next_action to schedule a rerun")
    return errors


def scan_secrets(text, line_no=None):
    where = f"line {line_no}" if line_no else "record"
    return [f"{where}: forbidden secret pattern {p.pattern!r} present" for p in FORBIDDEN if p.search(text)]


def cmd_append(path):
    raw = sys.stdin.read() if path == "-" else open(path, "r", encoding="utf-8").read()
    record = json.loads(raw)
    record = redact(record)
    errors = validate(record)
    line = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
    errors += scan_secrets(line)
    if errors:
        print("REFUSED:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    with open(LEDGER, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    print(f"appended {record['id']} ({record['status']})")
    return 0


def iter_ledger():
    if not os.path.exists(LEDGER):
        return
    with open(LEDGER, "r", encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            line = line.strip()
            if line:
                yield i, line


def cmd_verify():
    problems, count, ids = [], 0, set()
    for i, line in iter_ledger():
        count += 1
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            problems.append(f"line {i}: invalid JSON ({exc})")
            continue
        problems += validate(record, i)
        problems += scan_secrets(line, i)
        if record.get("id") in ids:
            problems.append(f"line {i}: duplicate id {record.get('id')}")
        ids.add(record.get("id"))
        for art in record.get("artifacts", []):
            p = art.get("path", "")
            if art.get("sha256") == "MISSING":
                continue
            if os.path.exists(p):
                actual = sha256_file(p)
                if actual != art.get("sha256"):
                    problems.append(f"line {i}: checksum drift for {p}: ledger {art.get('sha256')[:12]}… actual {actual[:12]}…")
            else:
                problems.append(f"line {i}: artifact missing on disk: {p}")
    if problems:
        print(f"VERIFY FAIL — {count} records, {len(problems)} problem(s):")
        for problem in problems:
            print("  - " + problem)
        return 1
    print(f"VERIFY PASS — {count} records, all schemas valid, all artifact checksums match, secret scan clean")
    return 0


def cmd_summary():
    records = []
    for i, line in iter_ledger():
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    counts = {}
    for record in records:
        counts[record["status"]] = counts.get(record["status"], 0) + 1
    lines = [
        "# Evidence Ledger — Human Summary",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} from LEDGER.jsonl (append-only; {len(records)} records).",
        "",
        "Status totals: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())),
        "",
        "| # | UTC time | Type | Action | Status | Exit | Tests | Key artifact |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for record in records:
        tests = record.get("tests") or {}
        tstr = f"{tests.get('passed', '')}/{tests.get('total', '')}" if tests.get("total") is not None else "—"
        arts = record.get("artifacts", [])
        art = arts[0]["path"].replace("/app/", "") if arts else "—"
        lines.append(
            f"| {record['id']} | {record['timestamp_utc']} | {record['action']['type']} | "
            f"{record['action']['name']} | {record['status']} | "
            f"{record['exit_code'] if record['exit_code'] is not None else '—'} | {tstr} | {art} |"
        )
    lines += [
        "",
        "Classification key: PASS = captured and reproducible · FAIL = captured with diagnosis · "
        "BLOCKED = external prerequisite missing · UNRECORDED = output lost, must rerun · NOT_RUN = deliberately not executed.",
        "",
        "No tokens, passwords, database URLs, private keys, or secrets are recorded; commands are redacted before persistence.",
    ]
    with open(SUMMARY, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"wrote {SUMMARY} ({len(records)} records)")
    return 0


def cmd_search(keyword):
    keyword_lower = keyword.lower()
    hits = 0
    for i, line in iter_ledger():
        if keyword_lower in line.lower():
            record = json.loads(line)
            tests = record.get("tests") or {}
            print(f"{record['id']} | {record['timestamp_utc']} | {record['status']} | "
                  f"{record['action']['name']} | exit={record['exit_code']} | "
                  f"tests={tests.get('passed')}/{tests.get('total')}")
            hits += 1
    print(f"({hits} match(es) for '{keyword}')")
    return 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "append" and len(sys.argv) == 3:
        return cmd_append(sys.argv[2])
    if cmd == "verify":
        return cmd_verify()
    if cmd == "summary":
        return cmd_summary()
    if cmd == "search" and len(sys.argv) == 3:
        return cmd_search(sys.argv[2])
    print(__doc__)
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        # allow piping into head/less without a traceback
        try:
            sys.stdout.close()
        except Exception:
            pass
        sys.exit(0)
