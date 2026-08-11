#!/usr/bin/env python3
"""
Auto-capture wrapper for the provenance ledger.

Runs a command, captures redacted output, measures duration, classifies the
result, and appends one ledger record via record_action's validate+redact path.

Usage:
  python3 capture.py --name "battery suite X" --type test \
      [--session "..."] [--branch B] [--commit C] [--repo R] \
      [--timeout SECONDS] [--artifact PATH]... [--parse-tap] \
      [--next "action"] [--approval] [--force] [--id ID] \
      -- <command> [args...]

  python3 capture.py --blocked "missing branch-protection export" --name "A' publication" --type publication [...]
  python3 capture.py --not-run "deferred per owner instruction" --name "..." --type test [...]

Classification (owner taxonomy):
  PASS       exit code 0 (captured + reproducible)
  FAIL       nonzero exit (diagnosis auto-extracted from redacted tail)
  UNRECORDED timeout / output loss -> next_action schedules a rerun
  BLOCKED    --blocked <reason>   (command not executed)
  NOT_RUN    --not-run <reason>   (command not executed)

Duplicate guard (search-before-rerun):
  Before running, the ledger is searched for a PASS record with the same
  action.command. If found and --force is absent, the wrapper refuses to rerun
  (exit 3) and prints the prior evidence so captured successes are not
  repeated unnecessarily.

Secrets: the command line and ALL captured output are redacted BEFORE being
written anywhere. Raw environment variables are never recorded.
"""
import argparse
import hashlib
import json
import os
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import record_action as ra  # noqa: E402

LOGS_DIR = os.path.join(ra.EVIDENCE_DIR, "logs")

DEFAULT_RUNTIME = {
    "node": "v20.20.2",
    "pnpm": "10.18.3 (corepack 0.34.6)",
    "postgresql": "15 (Debian 15+248+deb12u1); cluster state per record",
    "os_container": "Debian 12 bookworm container, image fastapi_react_mongo_shadcn_base_image_cloud_arm:release-07082026-2, linux/arm64",
}
DEFAULT_AGENT = {
    "name": "Neo (E2/Emergent)",
    "session": "workspace-session 2026-08-10 (post-handoff continuation)",
    "workspace": "emergent pod market-foot-staging",
}


def utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def next_id(prefix="AC"):
    seq = 0
    for _, line in ra.iter_ledger():
        try:
            rid = json.loads(line).get("id", "")
        except json.JSONDecodeError:
            continue
        if rid.startswith(prefix + "-"):
            try:
                seq = max(seq, int(rid.split("-")[1]))
            except (IndexError, ValueError):
                pass
    return f"{prefix}-{seq + 1:03d}"


def find_prior_pass(command):
    hits = []
    for _, line in ra.iter_ledger():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if rec.get("status") == "PASS" and rec.get("action", {}).get("command") == command:
            hits.append(rec)
    return hits


def parse_tap_counts(text):
    total = passed = failed = None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# tests "):
            total = int(stripped.split()[-1])
        elif stripped.startswith("# pass "):
            passed = int(stripped.split()[-1])
        elif stripped.startswith("# fail "):
            failed = int(stripped.split()[-1])
    if total is None and passed is None:
        return None
    return {"total": total, "passed": passed, "failed": failed or 0, "failed_details": []}


def build_record(args, command_str, status, exit_code, duration, tests, artifacts, notes, nxt):
    return {
        "schema_version": 1,
        "id": args.id or next_id(),
        "timestamp_utc": utcnow(),
        "agent": dict(DEFAULT_AGENT, session=args.session or DEFAULT_AGENT["session"]),
        "repo": {"repository": args.repo, "branch": args.branch, "commit": args.commit},
        "runtime": DEFAULT_RUNTIME,
        "action": {"type": args.type, "name": args.name, "command": command_str},
        "duration_seconds": duration,
        "exit_code": exit_code,
        "status": status,
        "tests": tests,
        "artifacts": artifacts,
        "effects": {
            "files_changed": args.files_changed,
            "refs_changed": args.refs_changed,
            "remote_changed": False,
        },
        "reproducible": status == "PASS",
        "next_action": nxt,
        "approval_required": bool(args.approval),
        "backfilled": False,
        "notes": notes,
    }


def append_record(record):
    record = ra.redact(record)
    errors = ra.validate(record)
    line = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
    errors += ra.scan_secrets(line)
    if errors:
        print("LEDGER APPEND REFUSED:\n" + "\n".join("  - " + e for e in errors), file=sys.stderr)
        return None
    with open(ra.LEDGER, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    return record


def main():
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--type", required=True, choices=sorted(ra.ACTION_TYPES))
    parser.add_argument("--session", default=None)
    parser.add_argument("--repo", default="sbtheg17-market/foot")
    parser.add_argument("--branch", default="n/a")
    parser.add_argument("--commit", default="n/a")
    parser.add_argument("--timeout", type=float, default=None)
    parser.add_argument("--artifact", action="append", default=[])
    parser.add_argument("--parse-tap", action="store_true")
    parser.add_argument("--next", dest="next_action", default="continue session plan")
    parser.add_argument("--approval", action="store_true")
    parser.add_argument("--force", action="store_true",
                        help="rerun even if an identical command already has a PASS record")
    parser.add_argument("--id", default=None)
    parser.add_argument("--files-changed", default=False)
    parser.add_argument("--refs-changed", default=False)
    parser.add_argument("--blocked", default=None, metavar="REASON")
    parser.add_argument("--not-run", dest="not_run", default=None, metavar="REASON")
    parser.add_argument("command", nargs=argparse.REMAINDER)

    args = parser.parse_args()

    # ---- BLOCKED / NOT_RUN: no execution -----------------------------------
    if args.blocked is not None or args.not_run is not None:
        status = "BLOCKED" if args.blocked is not None else "NOT_RUN"
        reason = args.blocked if args.blocked is not None else args.not_run
        cmd_str = "not executed"
        if args.command:
            cmd = args.command[1:] if args.command and args.command[0] == "--" else args.command
            if cmd:
                cmd_str = "not executed: " + ra.redact(shlex.join(cmd))
        record = build_record(args, cmd_str, status, None, None, None,
                              [], f"{status}: {reason}", args.next_action)
        appended = append_record(record)
        if not appended:
            return 1
        print(f"recorded {appended['id']} ({status}) — {reason}")
        return 0

    cmd = args.command
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    if not cmd:
        print("no command given (use --blocked/--not-run for non-executed records)", file=sys.stderr)
        return 2

    command_str = ra.redact(shlex.join(cmd))

    # ---- duplicate guard: search before rerun ------------------------------
    if not args.force:
        prior = find_prior_pass(command_str)
        if prior:
            print("DUPLICATE GUARD: identical command already captured as PASS — not rerun.")
            for rec in prior[-3:]:
                tests = rec.get("tests") or {}
                print(f"  prior: {rec['id']} @ {rec['timestamp_utc']} exit={rec['exit_code']} "
                      f"tests={tests.get('passed')}/{tests.get('total')} "
                      f"artifacts={[a['path'] for a in rec.get('artifacts', [])]}")
            print("  use --force to rerun anyway.")
            return 3

    # ---- run ---------------------------------------------------------------
    os.makedirs(LOGS_DIR, exist_ok=True)
    rec_id = args.id or next_id()
    slug = "".join(ch if ch.isalnum() else "_" for ch in args.name.lower())[:40]
    log_path = os.path.join(LOGS_DIR, f"{rec_id}_{slug}.log")

    start = time.monotonic()
    timed_out = False
    output = ""
    exit_code = None
    try:
        proc = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            timeout=args.timeout, text=True, errors="replace",
        )
        output = proc.stdout or ""
        exit_code = proc.returncode
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        raw = exc.stdout or b""
        output = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else (raw or "")
    except FileNotFoundError as exc:
        output = f"command not found: {exc}"
        exit_code = 127
    duration = round(time.monotonic() - start, 3)

    # redact BEFORE persisting anything
    redacted_output = ra.redact(output)
    with open(log_path, "w", encoding="utf-8") as fh:
        fh.write(f"# capture {rec_id} — {args.name}\n# command: {command_str}\n"
                 f"# started_utc: {utcnow()} duration_s: {duration} "
                 f"exit: {exit_code} timed_out: {timed_out}\n")
        fh.write(redacted_output)

    artifacts = [{"path": log_path, "sha256": ra.sha256_file(log_path)}]
    for extra in args.artifact:
        artifacts.append({"path": extra,
                          "sha256": ra.sha256_file(extra) if os.path.exists(extra) else "MISSING"})

    tests = parse_tap_counts(redacted_output) if args.parse_tap else None

    if timed_out:
        status = "UNRECORDED"
        notes = (f"TIMEOUT after {args.timeout}s — exit status lost, output truncated at kill; "
                 f"per standing rule this result is UNRECORDED and must be rerun. Partial redacted output kept at {log_path}.")
        nxt = f"rerun '{args.name}' (search ledger first): {command_str}"
        exit_code = None
    elif exit_code == 0:
        status = "PASS"
        notes = f"captured OK; redacted output at {log_path}"
        nxt = args.next_action
    else:
        status = "FAIL"
        tail = "\n".join(redacted_output.strip().splitlines()[-8:])
        notes = f"DIAGNOSIS (last redacted output lines):\n{tail}"
        if tests is None:
            tests = {"total": None, "passed": None, "failed": 1,
                     "failed_details": [f"exit code {exit_code}; see {log_path}"]}
        nxt = args.next_action if args.next_action != "continue session plan" \
            else f"diagnose and fix, then rerun '{args.name}'"

    record = build_record(args, command_str, status, exit_code, duration, tests,
                          artifacts, notes, nxt)
    record["id"] = rec_id
    appended = append_record(record)
    if not appended:
        return 1
    print(f"recorded {rec_id} ({status}) exit={exit_code} duration={duration}s log={log_path}")
    return 0 if status in ("PASS",) else (4 if status == "UNRECORDED" else 5)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(0)
