#!/usr/bin/env python3
"""Rebuild patch_package metadata after evidence-log regeneration (local-only).

- Updates MANIFEST.json: per-candidate evidence_artifacts now list the
  regenerated logs (with fresh SHA-256) plus lost_original_artifacts entries
  preserving the historical filenames/checksums that existed only pod-local
  and were never captured in the durable git snapshot.
- Rebuilds CHECKSUMS.sha256 over the files actually present in the package.
- Never touches patches/ contents (patch identities unchanged).
"""
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone

PKG = "/app/handoff/patch_package"
MANIFEST = os.path.join(PKG, "MANIFEST.json")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


REGEN = {
    "A_prime": [
        ("evidence/A_prime/RG-001_transport_validation_a_prime.regenerated.log",
         "RG-001", "regenerates AC-001 transport validation (6/6 PASS)"),
        ("evidence/A_prime/RG-006_gate_A.regenerated.log",
         "RG-006", "regenerates gate_A publish:gate (12/12 PASS, git-only gate, local origin)"),
    ],
    "C_prime": [
        ("evidence/C_prime/RG-002_transport_validation_c_prime.regenerated.log",
         "RG-002", "regenerates AC-002 transport validation (6/6 PASS)"),
    ],
    "B_prime": [
        ("evidence/B_prime/RG-003_transport_validation_b_prime.regenerated.log",
         "RG-003", "regenerates AC-003 transport validation (6/6 PASS)"),
    ],
    "phase4c_prep": [
        ("evidence/phase4c_prep/RG-004_transport_validation_phase4c_prep.regenerated.log",
         "RG-004", "regenerates AC-004 transport validation (6/6 PASS)"),
    ],
    "rule12_provenance": [
        ("evidence/rule12_provenance/RG-005_transport_validation_rule12_provenance.regenerated.log",
         "RG-005", "regenerates AC-005 transport validation (6/6 PASS)"),
    ],
}

with open(MANIFEST) as f:
    m = json.load(f)

now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
m["metadata_rebuilt_utc"] = now
m["evidence_regeneration"] = {
    "reason": ("original AC-00x evidence .log files existed pod-local only and were "
               "not captured in the durable git snapshot (conflict_100826_1941). "
               "Transport validations and the A' gate were re-executed via capture.py "
               "in the new-account workspace; heavier artifacts (C' full battery, "
               "frozen install, B' typecheck/webbuild, phase4c typecheck/contract logs, "
               "rule12 gate) were NOT regenerated in this container and remain "
               "represented by their original PASS ledger records only."),
    "ledger_records": ["RG-001", "RG-002", "RG-003", "RG-004", "RG-005", "RG-006"],
    "ledger": "/app/memory/evidence/LEDGER.jsonl",
    "runtime_note": "node v20.20.2, corepack 0.34.6, no PostgreSQL in this container",
}
m["baseline"]["conflict_branches_preserved"] = 20

for cand in m["candidates"]:
    key = cand["key"]
    lost = cand.pop("evidence_artifacts", [])
    new_entries = []
    for rel, rid, note in REGEN.get(key, []):
        p = os.path.join(PKG, rel)
        new_entries.append({
            "path": rel,
            "sha256": sha256(p),
            "ledger_record": rid,
            "note": note,
            "regenerated": True,
        })
    # keep any evidence file that still exists on disk (e.g. B' rationale, C' exits)
    for e in lost:
        p = os.path.join(PKG, e["path"])
        if os.path.exists(p):
            e["regenerated"] = False
            new_entries.append(e)
        else:
            cand.setdefault("lost_original_artifacts", []).append(
                {**e, "status": "LOST — pod-local only, never durable; "
                                "original PASS remains recorded in ledger"})
    cand["evidence_artifacts"] = new_entries

# also annotate any extra evidence files present but not referenced
with open(MANIFEST, "w") as f:
    json.dump(m, f, indent=1)
    f.write("\n")

# rebuild CHECKSUMS.sha256 over actual contents (excluding CHECKSUMS itself)
entries = []
for root, _, files in os.walk(PKG):
    for fn in sorted(files):
        rel = os.path.relpath(os.path.join(root, fn), PKG)
        if rel == "CHECKSUMS.sha256":
            continue
        entries.append((rel, sha256(os.path.join(PKG, rel))))
entries.sort()
with open(os.path.join(PKG, "CHECKSUMS.sha256"), "w") as f:
    for rel, digest in entries:
        f.write(f"{digest}  ./{rel}\n")

print(f"MANIFEST rebuilt at {now}; CHECKSUMS.sha256 lists {len(entries)} files")
r = subprocess.run(["sha256sum", "-c", "CHECKSUMS.sha256"], cwd=PKG,
                   capture_output=True, text=True)
ok = r.stdout.count(": OK")
print(f"self-verify: {ok}/{len(entries)} OK, exit={r.returncode}")
