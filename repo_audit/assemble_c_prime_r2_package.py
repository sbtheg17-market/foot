#!/usr/bin/env python3
"""Assemble the C' r2 standalone downloadable patch package (local-only, zero remote writes)."""
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

OUT = "/app/handoff/downloads/C_prime_r2_package"
LEDGER = "/app/memory/evidence/LEDGER.jsonl"
LOGS = "/app/memory/evidence/logs"
PATCH_SRC = "/app/handoff/candidates/C-prime-r2-lockfile-reproducibility.patch"
PATCH_NAME = "C-prime-r2-lockfile-reproducibility.patch"
EXPECTED_PATCH_SHA = "ea3eb8ed962753db7b5d6846c9b90bd7d2b5da7cecc397f9be088e49da8d3456"

SECRET_PATTERNS = [
    r"ghp_[A-Za-z0-9]{20,}", r"github_pat_[A-Za-z0-9_]{20,}",
    r"gho_[A-Za-z0-9]{20,}", r"AKIA[0-9A-Z]{16}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----", r"ssh-rsa AAAA",
    r"postgres(ql)?://[^\s\"']*:[^\s\"']*@", r"mongodb(\+srv)?://[^\s\"']*:[^\s\"']*@",
    r"xox[baprs]-[A-Za-z0-9-]{10,}", r"sk-[A-Za-z0-9]{20,}",
    r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}",
]
ALLOWLIST = {"postgres://foot:foot@127.0.0.1:5432/foot_test"}  # local throwaway test DB only


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

    shutil.copy2(PATCH_SRC, os.path.join(OUT, PATCH_NAME))
    patch_sha = sha256(os.path.join(OUT, PATCH_NAME))
    assert patch_sha == EXPECTED_PATCH_SHA, patch_sha

    evidence_logs = {
        "CD-002": "CD-002_c_prime_r2_frozen_install__pnpm_install_.log",
        "CD-003": "CD-003_c_prime_r2_lockfile_diff__pnpm_lock_yaml.log",
        "CD-005": "CD-005_supersedes_cd_004__env_bootstrap_missing.log",
        "CD-006": "CD-006_c_prime_r2_publication_gate__verify_publ.log",
    }
    for rid, fn in evidence_logs.items():
        shutil.copy2(os.path.join(LOGS, fn), os.path.join(OUT, "evidence", fn))

    wanted = {"CD-001", "CD-002", "CD-003", "CD-004", "CD-005", "CD-006",
              "PB-001", "PB-002", "AC-002", "RG-002"}
    extract = [l for l in open(LEDGER) if json.loads(l).get("id") in wanted]
    with open(os.path.join(OUT, "evidence", "LEDGER_EXTRACT_C_prime_r2.jsonl"), "w") as f:
        f.writelines(extract)

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
                    if match.group(0) in ALLOWLIST or "foot:foot@127.0.0.1" in match.group(0):
                        continue  # local throwaway test credential, documented
                    findings.append(f"{os.path.relpath(p, OUT)}: {match.group(0)[:12]}…")
    scan_result = "CLEAN (local throwaway test-DB URL foot:foot@127.0.0.1 allowlisted, documented)"
    if findings:
        print("SECRET SCAN FINDINGS:")
        print("\n".join(findings))
        sys.exit(4)

    manifest = {
        "package": "C' r2 standalone transport package — lockfile reproducibility (re-derived)",
        "transport_route": ("Emergent local build -> /app/handoff/patch_package -> user download "
                            "-> Replit application and validation -> approved GitHub publication "
                            "-> Emergent read-only verification"),
        "generated_utc": now,
        "repository": "sbtheg17-market/foot",
        "target_ref": "refs/heads/main",
        "base_sha": "0938c440c7defafed7fdbeaa3839616e231ec9f4",
        "parent_sha": "0938c440c7defafed7fdbeaa3839616e231ec9f4",
        "supersedes": {
            "old_candidate": "2c6d0248569b9c3f99213a19a40eaade81e69a4a",
            "old_base": "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a",
            "note": ("old identity retired after A' landed as 0938c440; "
                     "do NOT apply the old patch — same 2-file content re-derived "
                     "via git am onto the new tip with a fresh commit identity"),
        },
        "candidate": {
            "key": "C_prime_r2",
            "title": "C' r2 — frozen-install reproducibility: pin packageManager pnpm@10.18.3",
            "commit": "f905a1518803342a4e3bc5c20a92660443fd005b",
            "tree": "bc28a5c1571af56c25394ac907e440d928a780dc",
            "source_branch": "candidate/C-prime-lockfile-r2 (local derive worktree; NOT on any remote ref)",
            "changed_files": [".agents/SETUP.md", "package.json"],
            "commit_identity_reproducible": True,
            "reproduction_recipe": ("GIT_AUTHOR_NAME='E2 Agent (Emergent)' "
                                    "GIT_AUTHOR_EMAIL='github@emergent.sh' "
                                    "GIT_COMMITTER_NAME='E2 Agent (Emergent)' "
                                    "GIT_COMMITTER_EMAIL='github@emergent.sh' "
                                    "GIT_COMMITTER_DATE='2026-08-11T00:31:07+00:00' "
                                    "git am C-prime-r2-lockfile-reproducibility.patch  # on 0938c440"),
        },
        "patch_file": PATCH_NAME,
        "patch_sha256": patch_sha,
        "patch_creation": "git format-patch -1 --binary --stdout f905a151… (2026-08-11)",
        "tests_and_gates": [
            {"name": "frozen install (pnpm install --frozen-lockfile, pinned pnpm@10.18.3) — the defect under fix",
             "ledger_ids": ["CD-002"], "counts": "exit 0 (previously failed with lockfile-config mismatch under pnpm 9.15.0)",
             "exit_code": 0, "duration_seconds": 20.649,
             "log": "evidence/CD-002_c_prime_r2_frozen_install__pnpm_install_.log"},
            {"name": "lockfile diff (pnpm-lock.yaml byte-identical after install)",
             "ledger_ids": ["CD-003"], "counts": "git diff --exit-code clean",
             "exit_code": 0, "duration_seconds": 0.29,
             "log": "evidence/CD-003_c_prime_r2_lockfile_diff__pnpm_lock_yaml.log"},
            {"name": "full battery: 17 api-server suites (build+seed+server on :8899, postgres 15.18)",
             "ledger_ids": ["CD-005 (supersedes CD-004, an env-bootstrap FAIL kept on record)"],
             "counts": "229/229 PASS, 0 fail, 17/17 suites green",
             "exit_code": 0, "duration_seconds": 144.39,
             "log": "evidence/CD-005_supersedes_cd_004__env_bootstrap_missing.log"},
            {"name": "publication gate (scripts/verify-publication.sh, --allow .agents/SETUP.md --allow package.json)",
             "ledger_ids": ["CD-006"], "counts": "12/12 PASS",
             "exit_code": 0, "duration_seconds": 0.094,
             "log": "evidence/CD-006_c_prime_r2_publication_gate__verify_publ.log"},
        ],
        "runtime": {
            "node": "v20.20.2",
            "pnpm": "10.18.3 (corepack 0.34.6)",
            "postgresql": "15.18 (Debian 15.18-0+deb12u1) — matches recorded project runtime family",
            "os_container": ("Debian 12 bookworm, image "
                             "fastapi_react_mongo_shadcn_base_image_cloud_arm:release-07082026-2, linux/arm64"),
        },
        "capture_ledger_ids": ["CD-001", "CD-002", "CD-003", "CD-004 (superseded FAIL)",
                               "CD-005", "CD-006", "PB-001", "PB-002"],
        "secret_scan": {"result": scan_result, "patterns_checked": len(SECRET_PATTERNS),
                        "scanned_utc": now},
        "expected_remote_effect": ("main advances fast-forward by exactly one commit f905a151… "
                                   "(tree bc28a5c1…); scope .agents/SETUP.md + package.json only; "
                                   "no other ref changes; no force-push; all 20 conflict branches untouched"),
        "approval_status": ("BLOCKED — STOPPED for separate C' publication approval per protocol. "
                            "Requires: explicit C'-specific approval + a NEW bounded "
                            "repository-scoped write credential for a NEW window (the A' window "
                            "credential must be revoked and must NOT be reused). "
                            "Do NOT bundle with B', Phase 4C, or Rule 12."),
        "base_advance_rule": "If origin/main != 0938c440c7de… STOP; C' must be re-derived again.",
    }
    with open(os.path.join(OUT, "MANIFEST.json"), "w") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    print(f"assembled at {now}; patch sha256 {patch_sha}; secret scan {scan_result}")


if __name__ == "__main__":
    main()
