#!/usr/bin/env python3
"""Assemble the A' standalone downloadable patch package (local-only, zero remote writes).

Route: Emergent local build -> /app/handoff/patch_package -> user download
       -> Replit application and validation -> approved GitHub publication
       -> Emergent read-only verification.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

PKG = "/app/handoff/patch_package"
OUT = "/app/handoff/downloads/A_prime_package"
LEDGER = "/app/memory/evidence/LEDGER.jsonl"
PATCH_NAME = "A-prime-session063-traceability.patch"

SECRET_PATTERNS = [
    r"ghp_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}",
    r"gho_[A-Za-z0-9]{20,}", r"AKIA[0-9A-Z]{16}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----", r"ssh-rsa AAAA",
    r"postgres(ql)?://[^\s\"']*:[^\s\"']*@", r"mongodb(\+srv)?://[^\s\"']*:[^\s\"']*@",
    r"xox[baprs]-[A-Za-z0-9-]{10,}", r"sk-[A-Za-z0-9]{20,}",
    r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}",
    r"(?i)(api[_-]?key|secret|token|password)\s*[=:]\s*['\"][A-Za-z0-9+/=_-]{16,}['\"]",
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "evidence"))

    # 1. patch (byte-identical copy; identity re-verified upstream RG-001 + format-patch repro)
    shutil.copy2(os.path.join(PKG, "patches", PATCH_NAME), os.path.join(OUT, PATCH_NAME))
    patch_sha = sha256(os.path.join(OUT, PATCH_NAME))
    assert patch_sha == "dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9", patch_sha

    # 2. evidence: regenerated logs + ledger extract
    for src, dst in [
        ("evidence/A_prime/RG-001_transport_validation_a_prime.regenerated.log",
         "evidence/RG-001_transport_validation_a_prime.regenerated.log"),
        ("evidence/A_prime/RG-006_gate_A.regenerated.log",
         "evidence/RG-006_gate_A.regenerated.log"),
    ]:
        shutil.copy2(os.path.join(PKG, src), os.path.join(OUT, dst))

    wanted = {"AC-001", "RG-001", "RG-006", "NA-001", "NA-003", "NA-004", "LV-009", "LV-010"}
    extract = [l for l in open(LEDGER)
               if json.loads(l).get("id") in wanted]
    with open(os.path.join(OUT, "evidence", "LEDGER_EXTRACT_A_prime.jsonl"), "w") as f:
        f.writelines(extract)

    # 3. secret scan over every file going into the package (before manifest freeze)
    findings = []
    for root, _, files in os.walk(OUT):
        for fn in files:
            p = os.path.join(root, fn)
            try:
                text = open(p, "r", errors="replace").read()
            except Exception:
                continue
            for pat in SECRET_PATTERNS:
                for match in re.finditer(pat, text):
                    findings.append(f"{os.path.relpath(p, OUT)}: /{pat}/ -> {match.group(0)[:12]}…")
    scan_result = "CLEAN" if not findings else "FINDINGS"
    if findings:
        print("SECRET SCAN FINDINGS:")
        print("\n".join(findings))
        sys.exit(4)

    # 4. candidate manifest (all required transport fields)
    manifest = {
        "package": "A' standalone transport package — first publication candidate",
        "transport_route": ("Emergent local build -> /app/handoff/patch_package -> user download "
                            "-> Replit application and validation -> approved GitHub publication "
                            "-> Emergent read-only verification"),
        "generated_utc": now,
        "repository": "sbtheg17-market/foot",
        "target_ref": "refs/heads/main",
        "base_sha": "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a",
        "parent_sha": "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a",
        "candidate": {
            "key": "A_prime",
            "title": "A' Session 063 traceability (docs-only)",
            "commit": "f4a5dfeca5af222aeb9dcb1a6da822415397f902",
            "tree": "63dcfbe3080dae65a478c55d8e4bdbebb1832838",
            "source_branch": "candidate/A-prime-session063 (transport bundle; NOT on any remote ref)",
            "changed_files": [".agents/LOG.md", ".agents/NEXT_TASK.md"],
            "commit_identity_reproducible": True,
            "reproduction_recipe": ("GIT_COMMITTER_NAME='E2 Agent (Emergent)' "
                                    "GIT_COMMITTER_EMAIL='github@emergent.sh' "
                                    "GIT_COMMITTER_DATE='Mon, 10 Aug 2026 20:30:57 +0000' "
                                    "git am A-prime-session063-traceability.patch  # on 3e76114"),
        },
        "patch_file": PATCH_NAME,
        "patch_sha256": patch_sha,
        "patch_creation": "git format-patch -1 --binary --stdout f4a5dfec… (byte-identity re-verified 2026-08-11)",
        "tests_and_gates": [
            {"name": "transport validation (sha256, apply-check, tree, scope, lockfile, "
                     "commit-identity reproduction)",
             "ledger_ids": ["AC-001 (original)", "RG-001 (regenerated)"],
             "counts": "6/6 PASS", "exit_code": 0, "duration_seconds": 0.118,
             "log": "evidence/RG-001_transport_validation_a_prime.regenerated.log"},
            {"name": "publish:gate (scripts/verify-publication.sh, git-only, local origin)",
             "ledger_ids": ["RG-006 (regenerated; original gate_A.log lost pod-local)"],
             "counts": "12/12 PASS", "exit_code": 0, "duration_seconds": 0.557,
             "log": "evidence/RG-006_gate_A.regenerated.log"},
            {"name": "unit/integration tests", "counts": "n/a — docs-only candidate",
             "ledger_ids": [], "exit_code": None, "duration_seconds": None, "log": None},
        ],
        "runtime": {
            "node": "v20.20.2",
            "pnpm": "10.18.3 (corepack 0.34.6)",
            "postgresql": "not present in regeneration container (not required for docs-only gate)",
            "os_container": ("Debian 12 bookworm, image "
                             "fastapi_react_mongo_shadcn_base_image_cloud_arm:release-07082026-2, linux/arm64"),
        },
        "capture_ledger_ids": ["AC-001", "RG-001", "RG-006", "NA-001", "NA-003", "NA-004",
                               "LV-009", "LV-010"],
        "secret_scan": {"result": scan_result, "patterns_checked": len(SECRET_PATTERNS),
                        "scanned_utc": now},
        "expected_remote_effect": ("main advances fast-forward by exactly one docs-only commit "
                                   "f4a5dfec… (tree 63dcfbe3…); no other ref changes; "
                                   "no force-push; no branch deletion"),
        "approval_status": ("BLOCKED — publication NOT authorized. Requires all four: "
                            "(1) detailed main branch-protection export; "
                            "(2) audit coverage 16:35Z-23:41:50Z incl. newest snapshot attribution; "
                            "(3) explicit A'-specific publication approval; "
                            "(4) new bounded repository-scoped write credential. "
                            "Package is exported for review/preparation only."),
        "base_advance_rule": "If origin/main != 3e76114ce8ff… STOP; A' must be re-derived, not forced.",
        "never_bundle": "Do not combine with C', B', Phase 4C, or Rule 12 in one push.",
    }
    with open(os.path.join(OUT, "MANIFEST.json"), "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")

    print(f"assembled at {now}; patch sha256 {patch_sha}; secret scan {scan_result}")


if __name__ == "__main__":
    main()
