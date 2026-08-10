#!/usr/bin/env python3
"""
Comprehensive test suite for the governance workspace provenance system.

SAFETY: All destructive tests run on /tmp sandbox copies only.
The real ledger /app/memory/evidence/LEDGER.jsonl is NEVER modified.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class ProvenanceSystemTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.sandbox_dir = None
        
    def log(self, message, color=Colors.BLUE):
        print(f"{color}{message}{Colors.END}")
        
    def test(self, name, func):
        """Run a single test"""
        self.tests_run += 1
        self.log(f"\n{'='*70}", Colors.BLUE)
        self.log(f"TEST {self.tests_run}: {name}", Colors.BLUE)
        self.log(f"{'='*70}", Colors.BLUE)
        try:
            func()
            self.tests_passed += 1
            self.log(f"✅ PASS: {name}", Colors.GREEN)
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.failures.append(f"{name}: {str(e)}")
            self.log(f"❌ FAIL: {name}", Colors.RED)
            self.log(f"   Error: {str(e)}", Colors.RED)
            return False
        except Exception as e:
            self.tests_failed += 1
            self.failures.append(f"{name}: Unexpected error: {str(e)}")
            self.log(f"❌ FAIL: {name} (unexpected error)", Colors.RED)
            self.log(f"   Error: {str(e)}", Colors.RED)
            return False
    
    def setup_sandbox(self):
        """Create a sandbox copy of the evidence directory"""
        self.sandbox_dir = tempfile.mkdtemp(prefix="agent_wrap_test_")
        evidence_src = "/app/memory/evidence"
        evidence_dst = os.path.join(self.sandbox_dir, "evidence")
        shutil.copytree(evidence_src, evidence_dst)
        self.log(f"Created sandbox at {self.sandbox_dir}", Colors.YELLOW)
        return evidence_dst
    
    def cleanup_sandbox(self):
        """Remove sandbox directory"""
        if self.sandbox_dir and os.path.exists(self.sandbox_dir):
            shutil.rmtree(self.sandbox_dir)
            self.log(f"Cleaned up sandbox {self.sandbox_dir}", Colors.YELLOW)
    
    def run_capture(self, sandbox_evidence, args, expected_exit=0):
        """Run capture.py in sandbox"""
        capture_py = os.path.join(sandbox_evidence, "capture.py")
        cmd = ["python3", capture_py] + args
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=sandbox_evidence)
        if expected_exit is not None:
            assert result.returncode == expected_exit, \
                f"Expected exit {expected_exit}, got {result.returncode}\nstdout: {result.stdout}\nstderr: {result.stderr}"
        return result
    
    def run_record_action(self, sandbox_evidence, args, expected_exit=0):
        """Run record_action.py in sandbox"""
        record_py = os.path.join(sandbox_evidence, "record_action.py")
        cmd = ["python3", record_py] + args
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=sandbox_evidence)
        if expected_exit is not None:
            assert result.returncode == expected_exit, \
                f"Expected exit {expected_exit}, got {result.returncode}\nstdout: {result.stdout}\nstderr: {result.stderr}"
        return result
    
    def get_ledger_records(self, sandbox_evidence):
        """Read all records from sandbox ledger"""
        ledger_path = os.path.join(sandbox_evidence, "LEDGER.jsonl")
        records = []
        with open(ledger_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records
    
    def get_last_record(self, sandbox_evidence):
        """Get the last record from sandbox ledger"""
        records = self.get_ledger_records(sandbox_evidence)
        return records[-1] if records else None
    
    # ========================================================================
    # WRAPPER TESTS (in sandbox)
    # ========================================================================
    
    def test_wrapper_pass(self):
        """WRAPPER PASS: successful command creates PASS record"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "p1", "--type", "test", "--",
                "echo", "ok"
            ], expected_exit=0)
            
            # Check record was created
            rec = self.get_last_record(sandbox)
            assert rec is not None, "No record created"
            assert rec["status"] == "PASS", f"Expected PASS, got {rec['status']}"
            assert rec["exit_code"] == 0, f"Expected exit 0, got {rec['exit_code']}"
            assert rec["action"]["name"] == "p1", "Name mismatch"
            assert rec["duration_seconds"] is not None, "Duration missing"
            
            # Check artifact exists and checksum matches
            assert len(rec["artifacts"]) > 0, "No artifacts"
            artifact = rec["artifacts"][0]
            log_path = artifact["path"]
            assert os.path.exists(log_path), f"Log file missing: {log_path}"
            
            # Verify checksum
            import hashlib
            h = hashlib.sha256()
            with open(log_path, 'rb') as f:
                h.update(f.read())
            actual_sha = h.hexdigest()
            assert actual_sha == artifact["sha256"], \
                f"Checksum mismatch: expected {artifact['sha256']}, got {actual_sha}"
            
            self.log(f"✓ PASS record created: {rec['id']}", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_fail(self):
        """WRAPPER FAIL: nonzero exit creates FAIL record with diagnosis"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "f1", "--type", "test", "--",
                "bash", "-c", "echo diag-line >&2; exit 9"
            ], expected_exit=5)  # wrapper returns 5 for FAIL
            
            rec = self.get_last_record(sandbox)
            assert rec["status"] == "FAIL", f"Expected FAIL, got {rec['status']}"
            assert rec["exit_code"] == 9, f"Expected exit 9, got {rec['exit_code']}"
            assert "diag-line" in rec["notes"], "Diagnosis missing from notes"
            assert rec["tests"] is not None, "tests field missing"
            assert rec["tests"]["failed"] > 0, "failed count should be > 0"
            assert len(rec["tests"]["failed_details"]) > 0, "failed_details empty"
            
            self.log(f"✓ FAIL record created with diagnosis", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_unrecorded_timeout(self):
        """WRAPPER UNRECORDED: timeout creates UNRECORDED with rerun next_action"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "t1", "--type", "test", "--timeout", "1", "--",
                "bash", "-c", "echo partial; sleep 10"
            ], expected_exit=4)  # wrapper returns 4 for UNRECORDED
            
            rec = self.get_last_record(sandbox)
            assert rec["status"] == "UNRECORDED", f"Expected UNRECORDED, got {rec['status']}"
            assert rec["exit_code"] is None, "exit_code should be null for timeout"
            assert "rerun" in rec["next_action"].lower(), "next_action should mention rerun"
            assert "partial" in rec["notes"] or "TIMEOUT" in rec["notes"], "Timeout note missing"
            
            # Check that partial output was saved
            artifact = rec["artifacts"][0]
            with open(artifact["path"], 'r') as f:
                content = f.read()
                assert "partial" in content or "timed_out: True" in content, "Partial output not saved"
            
            self.log(f"✓ UNRECORDED record created for timeout", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_blocked(self):
        """WRAPPER BLOCKED: --blocked creates BLOCKED record without execution"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "b1", "--type", "test",
                "--blocked", "ext prereq missing", "--",
                "echo", "should-not-run"
            ], expected_exit=0)
            
            rec = self.get_last_record(sandbox)
            assert rec["status"] == "BLOCKED", f"Expected BLOCKED, got {rec['status']}"
            assert rec["exit_code"] is None, "exit_code should be null"
            assert "ext prereq missing" in rec["notes"], "Blocked reason missing"
            assert "not executed" in rec["action"]["command"], "Command should show not executed"
            
            self.log(f"✓ BLOCKED record created without execution", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_not_run(self):
        """WRAPPER NOT_RUN: --not-run creates NOT_RUN record without execution"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "n1", "--type", "test",
                "--not-run", "deferred", "--",
                "echo", "should-not-run"
            ], expected_exit=0)
            
            rec = self.get_last_record(sandbox)
            assert rec["status"] == "NOT_RUN", f"Expected NOT_RUN, got {rec['status']}"
            assert rec["exit_code"] is None, "exit_code should be null"
            assert "deferred" in rec["notes"], "NOT_RUN reason missing"
            
            self.log(f"✓ NOT_RUN record created", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_secret_redaction(self):
        """WRAPPER SECRET REDACTION: secrets are redacted in ledger and log"""
        sandbox = self.setup_sandbox()
        try:
            secret_cmd = "echo 'DATABASE_URL=postgres://u:p@h/db JWT_SECRET=zzz9 Bearer QQQQWWWWEEEERRRRTTTT12 ghp_123456789012345678901234567890'"
            result = self.run_capture(sandbox, [
                "--name", "s1", "--type", "test", "--",
                "bash", "-c", secret_cmd
            ], expected_exit=0)
            
            rec = self.get_last_record(sandbox)
            
            # Check ledger line for secrets
            ledger_path = os.path.join(sandbox, "LEDGER.jsonl")
            with open(ledger_path, 'r') as f:
                lines = f.readlines()
                last_line = lines[-1]
                
                # These patterns should NOT appear
                forbidden = ["u:p@h", "zzz9", "QQQQWWWWEEEERRRRTTTT12", "ghp_123456789012345678901234567890"]
                for pattern in forbidden:
                    assert pattern not in last_line, f"Secret '{pattern}' found in ledger!"
                
                # Redaction markers should appear
                assert "<REDACTED" in last_line, "No redaction markers in ledger"
            
            # Check log file for secrets
            artifact = rec["artifacts"][0]
            with open(artifact["path"], 'r') as f:
                log_content = f.read()
                for pattern in forbidden:
                    assert pattern not in log_content, f"Secret '{pattern}' found in log file!"
                assert "<REDACTED" in log_content, "No redaction markers in log"
            
            self.log(f"✓ Secrets redacted in both ledger and log", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_duplicate_guard(self):
        """WRAPPER DUPLICATE GUARD: refuses to rerun PASS without --force"""
        sandbox = self.setup_sandbox()
        try:
            # First run - should succeed
            result1 = self.run_capture(sandbox, [
                "--name", "d1", "--type", "test", "--",
                "echo", "unique-test-12345"
            ], expected_exit=0)
            
            rec1 = self.get_last_record(sandbox)
            assert rec1["status"] == "PASS", "First run should PASS"
            
            # Second run without --force - should refuse with exit 3
            result2 = self.run_capture(sandbox, [
                "--name", "d1-again", "--type", "test", "--",
                "echo", "unique-test-12345"
            ], expected_exit=3)
            
            assert "DUPLICATE GUARD" in result2.stdout, "Duplicate guard message missing"
            assert rec1["id"] in result2.stdout, "Prior record ID not shown"
            
            # Third run with --force - should succeed
            result3 = self.run_capture(sandbox, [
                "--name", "d1-forced", "--type", "test", "--force", "--",
                "echo", "unique-test-12345"
            ], expected_exit=0)
            
            rec3 = self.get_last_record(sandbox)
            assert rec3["status"] == "PASS", "Forced run should PASS"
            assert rec3["id"] != rec1["id"], "Should create new record with --force"
            
            self.log(f"✓ Duplicate guard working correctly", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_wrapper_tap_parsing(self):
        """WRAPPER TAP PARSING: --parse-tap extracts test counts"""
        sandbox = self.setup_sandbox()
        try:
            result = self.run_capture(sandbox, [
                "--name", "tap1", "--type", "test", "--parse-tap", "--",
                "bash", "-c", "printf '# tests 4\\n# pass 4\\n# fail 0\\n'"
            ], expected_exit=0)
            
            rec = self.get_last_record(sandbox)
            assert rec["tests"] is not None, "tests field missing"
            assert rec["tests"]["total"] == 4, f"Expected total=4, got {rec['tests']['total']}"
            assert rec["tests"]["passed"] == 4, f"Expected passed=4, got {rec['tests']['passed']}"
            assert rec["tests"]["failed"] == 0, f"Expected failed=0, got {rec['tests']['failed']}"
            
            self.log(f"✓ TAP parsing extracted counts correctly", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_sandbox_verify_after_appends(self):
        """SANDBOX VERIFY: verify passes after wrapper appends"""
        sandbox = self.setup_sandbox()
        try:
            # Add a few records
            self.run_capture(sandbox, [
                "--name", "v1", "--type", "test", "--",
                "echo", "test1"
            ], expected_exit=0)
            
            self.run_capture(sandbox, [
                "--name", "v2", "--type", "test", "--",
                "echo", "test2"
            ], expected_exit=0)
            
            # Run verify
            result = self.run_record_action(sandbox, ["verify"], expected_exit=0)
            assert "VERIFY PASS" in result.stdout, "Verify should pass"
            
            self.log(f"✓ Verify passes after wrapper appends", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    def test_supersedes_mechanism(self):
        """SUPERSEDES MECHANISM: correction record with supersedes skips artifact checks"""
        sandbox = self.setup_sandbox()
        try:
            # Create a record with an artifact
            self.run_capture(sandbox, [
                "--name", "sup1", "--type", "test", "--",
                "echo", "original"
            ], expected_exit=0)
            
            rec1 = self.get_last_record(sandbox)
            artifact_path = rec1["artifacts"][0]["path"]
            original_id = rec1["id"]
            
            # Modify the artifact (simulate drift)
            with open(artifact_path, 'a') as f:
                f.write("\nDRIFT: additional content\n")
            
            # Verify should fail due to drift
            result = self.run_record_action(sandbox, ["verify"], expected_exit=1)
            assert "checksum drift" in result.stdout.lower(), "Should detect drift"
            
            # Create a correction record with supersedes
            correction = {
                "schema_version": 1,
                "id": "COR-001",
                "timestamp_utc": "2026-08-10T23:59:00Z",
                "agent": {"name": "Test", "session": "test", "workspace": "test"},
                "repo": {"repository": "test", "branch": "test", "commit": "test"},
                "runtime": {"node": "v20", "pnpm": "10", "postgresql": "15", "os_container": "test"},
                "action": {"type": "verification", "name": "correction", "command": "test"},
                "duration_seconds": 0,
                "exit_code": 0,
                "status": "PASS",
                "tests": None,
                "artifacts": [],
                "effects": {"files_changed": False, "refs_changed": False, "remote_changed": False},
                "reproducible": True,
                "next_action": "continue",
                "approval_required": False,
                "backfilled": False,
                "notes": "Correction record",
                "supersedes": original_id
            }
            
            # Append correction record
            ledger_path = os.path.join(sandbox, "LEDGER.jsonl")
            with open(ledger_path, 'a') as f:
                f.write(json.dumps(correction) + "\n")
            
            # Verify should now pass (superseded record's artifacts skipped)
            result = self.run_record_action(sandbox, ["verify"], expected_exit=0)
            assert "VERIFY PASS" in result.stdout, "Verify should pass after correction"
            
            self.log(f"✓ Supersedes mechanism working correctly", Colors.GREEN)
        finally:
            self.cleanup_sandbox()
    
    # ========================================================================
    # REAL LEDGER TESTS (read-only)
    # ========================================================================
    
    def test_real_ledger_verify(self):
        """REAL LEDGER: verify passes with 44 records"""
        result = subprocess.run(
            ["python3", "/app/memory/evidence/record_action.py", "verify"],
            capture_output=True, text=True, cwd="/app/memory/evidence"
        )
        assert result.returncode == 0, f"Verify failed: {result.stdout}\n{result.stderr}"
        assert "VERIFY PASS" in result.stdout, "Expected VERIFY PASS"
        assert "44 records" in result.stdout, f"Expected 44 records, got: {result.stdout}"
        
        self.log(f"✓ Real ledger verify passes with 44 records", Colors.GREEN)
    
    def test_real_ledger_lv007_supersedes(self):
        """REAL LEDGER: LV-007 exists with supersedes=BF-030"""
        with open("/app/memory/evidence/LEDGER.jsonl", 'r') as f:
            lines = f.readlines()
        
        assert len(lines) == 44, f"Expected 44 lines, got {len(lines)}"
        
        # Find LV-007
        lv007 = None
        for line in lines:
            rec = json.loads(line.strip())
            if rec["id"] == "LV-007":
                lv007 = rec
                break
        
        assert lv007 is not None, "LV-007 not found"
        assert lv007.get("supersedes") == "BF-030", \
            f"Expected supersedes=BF-030, got {lv007.get('supersedes')}"
        
        self.log(f"✓ LV-007 exists with supersedes=BF-030", Colors.GREEN)
    
    # ========================================================================
    # PROVENANCE CANDIDATE TESTS (read-only git)
    # ========================================================================
    
    def test_provenance_candidate_branch(self):
        """PROVENANCE CANDIDATE: branch tip and tree match expected values"""
        repo = "/app/repo_audit/main_worktree"
        
        # Check commit hash
        result = subprocess.run(
            ["git", "log", "--format=%H %T", "-1", "candidate/provenance-rule-docs"],
            capture_output=True, text=True, cwd=repo
        )
        assert result.returncode == 0, f"Git log failed: {result.stderr}"
        
        parts = result.stdout.strip().split()
        commit_hash = parts[0]
        tree_hash = parts[1]
        
        assert commit_hash == "b85f71f32202c293c1d7c240ec4af151b22c2c41", \
            f"Expected commit b85f71f3..., got {commit_hash}"
        assert tree_hash == "a4091ce232f5521a7407a95f4eb63a902d6ab582", \
            f"Expected tree a4091ce2..., got {tree_hash}"
        
        # Check parent
        result = subprocess.run(
            ["git", "log", "--format=%P", "-1", "candidate/provenance-rule-docs"],
            capture_output=True, text=True, cwd=repo
        )
        parent = result.stdout.strip()
        assert parent == "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a", \
            f"Expected parent 3e76114c..., got {parent}"
        
        self.log(f"✓ Provenance candidate commit/tree/parent match", Colors.GREEN)
    
    def test_provenance_candidate_changes(self):
        """PROVENANCE CANDIDATE: changes exactly one file with expected content"""
        repo = "/app/repo_audit/main_worktree"
        
        # Check files changed
        result = subprocess.run(
            ["git", "diff", "--name-only", "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a", 
             "candidate/provenance-rule-docs"],
            capture_output=True, text=True, cwd=repo
        )
        files = result.stdout.strip().split('\n')
        assert len(files) == 1, f"Expected 1 file changed, got {len(files)}: {files}"
        assert files[0] == ".agents/AGENT-RULES.md", \
            f"Expected .agents/AGENT-RULES.md, got {files[0]}"
        
        # Check diff stats
        result = subprocess.run(
            ["git", "diff", "--shortstat", "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a",
             "candidate/provenance-rule-docs"],
            capture_output=True, text=True, cwd=repo
        )
        assert "32 insertions" in result.stdout, f"Expected 32 insertions: {result.stdout}"
        
        # Check content contains expected sentence
        result = subprocess.run(
            ["git", "show", "candidate/provenance-rule-docs:.agents/AGENT-RULES.md"],
            capture_output=True, text=True, cwd=repo
        )
        content = result.stdout
        assert "Do not rely on \"I ran it\" as evidence." in content, \
            "Expected sentence not found in AGENT-RULES.md"
        
        # Check all five states are mentioned
        states = ["PASS", "FAIL", "BLOCKED", "UNRECORDED", "NOT_RUN"]
        for state in states:
            assert state in content, f"State '{state}' not found in content"
        
        self.log(f"✓ Provenance candidate changes verified", Colors.GREEN)
    
    def test_provenance_patch_checksum(self):
        """PROVENANCE CANDIDATE: patch checksum matches expected"""
        patch_path = "/app/repo_audit/new_candidates/provenance-rule-docs.patch"
        
        import hashlib
        h = hashlib.sha256()
        with open(patch_path, 'rb') as f:
            h.update(f.read())
        actual = h.hexdigest()
        
        expected = "fca9c42183636ffa9d3d02057f998a31cead3ed37b838a058f1cdadce4a3b120"
        assert actual == expected, f"Patch checksum mismatch: expected {expected}, got {actual}"
        
        self.log(f"✓ Provenance patch checksum matches", Colors.GREEN)
    
    def test_provenance_gate_log(self):
        """PROVENANCE CANDIDATE: gate log contains RESULT: PASS"""
        gate_log = "/app/repo_audit/battery/gate_provenance.log"
        with open(gate_log, 'r') as f:
            content = f.read()
        
        assert "RESULT: PASS" in content, f"Expected RESULT: PASS in gate log"
        
        self.log(f"✓ Gate log contains RESULT: PASS", Colors.GREEN)
    
    # ========================================================================
    # A-PRIME UNCHANGED TEST
    # ========================================================================
    
    def test_aprime_unchanged(self):
        """A-PRIME UNCHANGED: commit and tree hashes match expected"""
        repo = "/app/repo_audit/main_worktree"
        
        result = subprocess.run(
            ["git", "log", "--format=%H %T", "-1", "candidate/A-prime-session063"],
            capture_output=True, text=True, cwd=repo
        )
        assert result.returncode == 0, f"Git log failed: {result.stderr}"
        
        parts = result.stdout.strip().split()
        commit_hash = parts[0]
        tree_hash = parts[1]
        
        assert commit_hash == "f4a5dfeca5af222aeb9dcb1a6da822415397f902", \
            f"A-prime commit changed! Expected f4a5dfec..., got {commit_hash}"
        assert tree_hash == "63dcfbe3080dae65a478c55d8e4bdbebb1832838", \
            f"A-prime tree changed! Expected 63dcfbe3..., got {tree_hash}"
        
        self.log(f"✓ A-prime unchanged (f4a5dfec.../63dcfbe3...)", Colors.GREEN)
    
    # ========================================================================
    # HANDOFF BUNDLE TESTS
    # ========================================================================
    
    def test_handoff_manifest_integrity(self):
        """HANDOFF BUNDLE: manifest checksum verification passes"""
        result = subprocess.run(
            ["sha256sum", "-c", "MANIFEST.sha256", "--quiet"],
            capture_output=True, text=True, cwd="/app/handoff"
        )
        assert result.returncode == 0, \
            f"Manifest verification failed: {result.stdout}\n{result.stderr}"
        
        # Count files in manifest
        with open("/app/handoff/MANIFEST.sha256", 'r') as f:
            lines = [l for l in f.readlines() if l.strip()]
        assert len(lines) == 22, f"Expected 22 files in manifest, got {len(lines)}"
        
        self.log(f"✓ Handoff manifest verified (22 files)", Colors.GREEN)
    
    def test_handoff_bundle_verify(self):
        """HANDOFF BUNDLE: git bundle verify shows complete history"""
        bundle_path = "/app/handoff/candidates/local-branches-2026-08-10.bundle"
        
        result = subprocess.run(
            ["git", "bundle", "verify", bundle_path],
            capture_output=True, text=True
        )
        assert result.returncode == 0, f"Bundle verify failed: {result.stderr}"
        assert "complete" in result.stderr.lower() or "complete" in result.stdout.lower(), \
            f"Bundle not complete: {result.stdout}\n{result.stderr}"
        
        self.log(f"✓ Git bundle verified as complete", Colors.GREEN)
    
    def test_handoff_bundle_restore(self):
        """HANDOFF BUNDLE: restoring bundle yields all 5 branches with correct tips"""
        bundle_path = "/app/handoff/candidates/local-branches-2026-08-10.bundle"
        restore_dir = tempfile.mkdtemp(prefix="bundle_restore_")
        
        try:
            # Clone the bundle
            result = subprocess.run(
                ["git", "clone", bundle_path, restore_dir],
                capture_output=True, text=True
            )
            assert result.returncode == 0, f"Bundle clone failed: {result.stderr}"
            
            # Check branch tips
            expected_branches = {
                "candidate/A-prime-session063": "f4a5dfeca5af222aeb9dcb1a6da822415397f902",
                "candidate/C-prime-lockfile": "2c6d0248569b9c3f99213a19a40eaade81e69a4a",
                "candidate/B-prime-provider-signout": "e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae",
                "phase4c/non-schema-prep": "7009ce66d7c6c888592279ce0f0ff3d9af023d11",
                "candidate/provenance-rule-docs": "b85f71f32202c293c1d7c240ec4af151b22c2c41"
            }
            
            for branch, expected_tip in expected_branches.items():
                result = subprocess.run(
                    ["git", "rev-parse", f"origin/{branch}"],
                    capture_output=True, text=True, cwd=restore_dir
                )
                actual_tip = result.stdout.strip()
                assert actual_tip == expected_tip, \
                    f"Branch {branch}: expected {expected_tip}, got {actual_tip}"
            
            self.log(f"✓ Bundle restored with all 5 branches at correct tips", Colors.GREEN)
        finally:
            shutil.rmtree(restore_dir)
    
    # ========================================================================
    # DURABILITY FACTS TESTS
    # ========================================================================
    
    def test_durability_plain_files(self):
        """DURABILITY: /app/handoff files are plain files (no nested .git)"""
        handoff_git = "/app/handoff/.git"
        assert not os.path.exists(handoff_git), \
            f"/app/handoff/.git should not exist (plain files only)"
        
        # Check that files exist
        assert os.path.exists("/app/handoff/README.md"), "README.md missing"
        assert os.path.exists("/app/handoff/MANIFEST.sha256"), "MANIFEST.sha256 missing"
        assert os.path.exists("/app/handoff/candidates/local-branches-2026-08-10.bundle"), \
            "Bundle missing"
        
        self.log(f"✓ Handoff files are plain files (no nested .git)", Colors.GREEN)
    
    def test_durability_original_artifacts(self):
        """DURABILITY: original artifacts still exist at pod-local paths"""
        artifacts = [
            "/app/memory/evidence/LEDGER.jsonl",
            "/app/memory/evidence/capture.py",
            "/app/memory/evidence/record_action.py",
            "/app/repo_audit/new_candidates/provenance-rule-docs.patch",
            "/app/repo_audit/battery/gate_provenance.log"
        ]
        
        for path in artifacts:
            assert os.path.exists(path), f"Artifact missing: {path}"
        
        self.log(f"✓ All 5 original artifacts exist at pod-local paths", Colors.GREEN)
    
    def test_durability_not_gitignored(self):
        """DURABILITY: handoff files are NOT gitignored (snapshot-eligible)"""
        result = subprocess.run(
            ["git", "-C", "/app", "check-ignore", "handoff/README.md"],
            capture_output=True, text=True
        )
        # check-ignore returns 0 if file IS ignored, 1 if NOT ignored
        assert result.returncode == 1, \
            f"handoff/README.md should NOT be gitignored (snapshot-eligible)"
        
        result = subprocess.run(
            ["git", "-C", "/app", "check-ignore", "handoff/MANIFEST.sha256"],
            capture_output=True, text=True
        )
        assert result.returncode == 1, \
            f"handoff/MANIFEST.sha256 should NOT be gitignored"
        
        self.log(f"✓ Handoff files are NOT gitignored (snapshot-eligible)", Colors.GREEN)
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Total tests: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.END}")
        
        if self.failures:
            print(f"\n{Colors.RED}FAILURES:{Colors.END}")
            for failure in self.failures:
                print(f"  - {failure}")
        
        print("="*70)
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = ProvenanceSystemTester()
    
    print(f"{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}GOVERNANCE WORKSPACE PROVENANCE SYSTEM TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.YELLOW}SAFETY: All destructive tests run in /tmp sandbox copies{Colors.END}")
    print(f"{Colors.YELLOW}Real ledger /app/memory/evidence/LEDGER.jsonl is NEVER modified{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    
    # Wrapper tests (sandbox)
    tester.test("WRAPPER PASS: successful command creates PASS record", 
                tester.test_wrapper_pass)
    tester.test("WRAPPER FAIL: nonzero exit creates FAIL record with diagnosis", 
                tester.test_wrapper_fail)
    tester.test("WRAPPER UNRECORDED: timeout creates UNRECORDED with rerun next_action", 
                tester.test_wrapper_unrecorded_timeout)
    tester.test("WRAPPER BLOCKED: --blocked creates BLOCKED record without execution", 
                tester.test_wrapper_blocked)
    tester.test("WRAPPER NOT_RUN: --not-run creates NOT_RUN record without execution", 
                tester.test_wrapper_not_run)
    tester.test("WRAPPER SECRET REDACTION: secrets redacted in ledger and log", 
                tester.test_wrapper_secret_redaction)
    tester.test("WRAPPER DUPLICATE GUARD: refuses rerun without --force", 
                tester.test_wrapper_duplicate_guard)
    tester.test("WRAPPER TAP PARSING: --parse-tap extracts test counts", 
                tester.test_wrapper_tap_parsing)
    tester.test("SANDBOX VERIFY: verify passes after wrapper appends", 
                tester.test_sandbox_verify_after_appends)
    tester.test("SUPERSEDES MECHANISM: correction record skips artifact checks", 
                tester.test_supersedes_mechanism)
    
    # Real ledger tests (read-only)
    tester.test("REAL LEDGER: verify passes with 44 records", 
                tester.test_real_ledger_verify)
    tester.test("REAL LEDGER: LV-007 exists with supersedes=BF-030", 
                tester.test_real_ledger_lv007_supersedes)
    
    # Provenance candidate tests (read-only git)
    tester.test("PROVENANCE CANDIDATE: branch tip and tree match expected", 
                tester.test_provenance_candidate_branch)
    tester.test("PROVENANCE CANDIDATE: changes exactly one file with expected content", 
                tester.test_provenance_candidate_changes)
    tester.test("PROVENANCE CANDIDATE: patch checksum matches expected", 
                tester.test_provenance_patch_checksum)
    tester.test("PROVENANCE CANDIDATE: gate log contains RESULT: PASS", 
                tester.test_provenance_gate_log)
    
    # A-prime unchanged test
    tester.test("A-PRIME UNCHANGED: commit and tree hashes match expected", 
                tester.test_aprime_unchanged)
    
    # Handoff bundle tests
    tester.test("HANDOFF BUNDLE: manifest checksum verification passes", 
                tester.test_handoff_manifest_integrity)
    tester.test("HANDOFF BUNDLE: git bundle verify shows complete history", 
                tester.test_handoff_bundle_verify)
    tester.test("HANDOFF BUNDLE: restoring bundle yields all 5 branches", 
                tester.test_handoff_bundle_restore)
    
    # Durability facts tests
    tester.test("DURABILITY: /app/handoff files are plain files (no nested .git)", 
                tester.test_durability_plain_files)
    tester.test("DURABILITY: original artifacts exist at pod-local paths", 
                tester.test_durability_original_artifacts)
    tester.test("DURABILITY: handoff files NOT gitignored (snapshot-eligible)", 
                tester.test_durability_not_gitignored)
    
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
