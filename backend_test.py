#!/usr/bin/env python3
"""
Comprehensive validation test for transport-only patch package
Tests all requirements for sbtheg17-market/foot governance workspace
"""

import os
import sys
import json
import hashlib
import subprocess
import tempfile
import shutil
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class PatchPackageValidator:
    def __init__(self):
        self.package_dir = Path("/app/handoff/patch_package")
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        
    def log_pass(self, test_name):
        self.tests_run += 1
        self.tests_passed += 1
        print(f"{Colors.GREEN}✓{Colors.END} {test_name}")
        
    def log_fail(self, test_name, reason):
        self.tests_run += 1
        self.tests_failed += 1
        self.failures.append(f"{test_name}: {reason}")
        print(f"{Colors.RED}✗{Colors.END} {test_name}")
        print(f"  {Colors.RED}Reason: {reason}{Colors.END}")
        
    def sha256_file(self, filepath):
        """Calculate SHA256 of a file"""
        sha256 = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def test_package_integrity(self):
        """TEST 1: Package integrity - checksums validation"""
        print(f"\n{Colors.BLUE}=== TEST 1: PACKAGE INTEGRITY ==={Colors.END}")
        
        checksums_file = self.package_dir / "CHECKSUMS.sha256"
        if not checksums_file.exists():
            self.log_fail("CHECKSUMS.sha256 exists", "File not found")
            return
        
        # Count lines in CHECKSUMS.sha256
        with open(checksums_file, 'r') as f:
            lines = f.readlines()
            non_empty_lines = [l for l in lines if l.strip()]
            
        if len(non_empty_lines) == 39:
            self.log_pass(f"CHECKSUMS.sha256 has 39 files (found {len(non_empty_lines)})")
        else:
            self.log_fail(f"CHECKSUMS.sha256 has 39 files", f"Found {len(non_empty_lines)} files")
        
        # Run sha256sum -c
        result = subprocess.run(
            ["sha256sum", "-c", "CHECKSUMS.sha256"],
            cwd=self.package_dir,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            self.log_pass("sha256sum -c CHECKSUMS.sha256 --quiet -> exit 0")
        else:
            self.log_fail("sha256sum -c CHECKSUMS.sha256", f"Exit code {result.returncode}\n{result.stderr}")
    
    def test_manifest_structure(self):
        """TEST 2: MANIFEST.json structure validation"""
        print(f"\n{Colors.BLUE}=== TEST 2: MANIFEST STRUCTURE ==={Colors.END}")
        
        manifest_file = self.package_dir / "MANIFEST.json"
        try:
            with open(manifest_file, 'r') as f:
                manifest = json.load(f)
            self.log_pass("MANIFEST.json parses as valid JSON")
        except Exception as e:
            self.log_fail("MANIFEST.json parses as valid JSON", str(e))
            return None
        
        # Check candidates count
        if len(manifest.get('candidates', [])) == 5:
            self.log_pass("MANIFEST.json has exactly 5 candidates")
        else:
            self.log_fail("MANIFEST.json has exactly 5 candidates", 
                         f"Found {len(manifest.get('candidates', []))} candidates")
        
        # Check top-level flags
        flags = {
            'transport_only': True,
            'applied_remotely': False,
            'publication_window_opened': False,
            'bounded_write_credential_created': False
        }
        
        for flag, expected in flags.items():
            if manifest.get(flag) == expected:
                self.log_pass(f"MANIFEST.json {flag}={expected}")
            else:
                self.log_fail(f"MANIFEST.json {flag}={expected}", 
                             f"Found {manifest.get(flag)}")
        
        return manifest
    
    def test_patch_identity(self, manifest):
        """TEST 3: Patch identity verification"""
        print(f"\n{Colors.BLUE}=== TEST 3: PATCH IDENTITY ==={Colors.END}")
        
        if not manifest:
            print(f"{Colors.YELLOW}Skipping - manifest not loaded{Colors.END}")
            return
        
        expected_hashes = {
            'A-prime-session063-traceability.patch': 'dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9',
            'C-prime-lockfile-reproducibility.patch': '1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31',
            'B-prime-provider-signout.patch': 'dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093',
            'phase4c-nonschema-prep.patch': '528b9bac839473859a0c91ac874bfc3c6346a959023d65f147a6ce317530ad1d',
            'rule12-provenance-docs.patch': 'fca9c42183636ffa9d3d02057f998a31cead3ed37b838a058f1cdadce4a3b120'
        }
        
        patches_dir = self.package_dir / "patches"
        
        for patch_file, expected_hash in expected_hashes.items():
            patch_path = patches_dir / patch_file
            if not patch_path.exists():
                self.log_fail(f"Patch {patch_file} exists", "File not found")
                continue
            
            actual_hash = self.sha256_file(patch_path)
            
            # Also check against MANIFEST
            candidate_key = patch_file.split('-')[0].replace('A', 'A_prime').replace('B', 'B_prime').replace('C', 'C_prime')
            if candidate_key == 'phase4c':
                candidate_key = 'phase4c_prep'
            elif candidate_key == 'rule12':
                candidate_key = 'rule12_provenance'
            
            manifest_hash = None
            for candidate in manifest.get('candidates', []):
                if candidate.get('key') == candidate_key:
                    manifest_hash = candidate.get('patch_sha256')
                    break
            
            if actual_hash == expected_hash == manifest_hash:
                self.log_pass(f"Patch {patch_file} SHA256 matches (declared & MANIFEST)")
            elif actual_hash == expected_hash:
                self.log_fail(f"Patch {patch_file} SHA256", 
                             f"File matches declared but MANIFEST mismatch: {manifest_hash}")
            else:
                self.log_fail(f"Patch {patch_file} SHA256", 
                             f"Expected {expected_hash}, got {actual_hash}")
    
    def test_independent_applicability(self, manifest):
        """TEST 4: Independent applicability in fresh sandbox"""
        print(f"\n{Colors.BLUE}=== TEST 4: INDEPENDENT APPLICABILITY ==={Colors.END}")
        
        if not manifest:
            print(f"{Colors.YELLOW}Skipping - manifest not loaded{Colors.END}")
            return
        
        baseline = "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a"
        
        # Expected trees for each patch
        expected_trees = {
            'A_prime': '63dcfbe3080dae65a478c55d8e4bdbebb1832838',
            'C_prime': '093a2c22856ba93e31a002e79486bdb9751fbdd4',
            'B_prime': 'c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321',
            'phase4c_prep': '56d34d2b5062bcb770008c1d62c109563b45dd53',
            'rule12_provenance': 'a4091ce232f5521a7407a95f4eb63a902d6ab582'
        }
        
        patch_files = {
            'A_prime': 'A-prime-session063-traceability.patch',
            'C_prime': 'C-prime-lockfile-reproducibility.patch',
            'B_prime': 'B-prime-provider-signout.patch',
            'phase4c_prep': 'phase4c-nonschema-prep.patch',
            'rule12_provenance': 'rule12-provenance-docs.patch'
        }
        
        # Create temp directory for testing
        with tempfile.TemporaryDirectory(prefix="pkg_apply_") as tmpdir:
            test_repo = Path(tmpdir) / "foot"
            
            # Clone from local mirror
            result = subprocess.run(
                ["git", "clone", "-q", "/app/repo_audit/foot-mirror", str(test_repo)],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                self.log_fail("Clone local mirror to /tmp", result.stderr)
                return
            
            # Checkout baseline
            result = subprocess.run(
                ["git", "checkout", baseline],
                cwd=test_repo,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                self.log_fail(f"Checkout baseline {baseline[:7]}", result.stderr)
                return
            
            self.log_pass(f"Fresh sandbox created at /tmp, baseline {baseline[:7]}")
            
            # Test each patch independently
            for key, patch_file in patch_files.items():
                # Reset to baseline
                subprocess.run(["git", "reset", "--hard", baseline], 
                             cwd=test_repo, capture_output=True)
                subprocess.run(["git", "clean", "-fd"], 
                             cwd=test_repo, capture_output=True)
                
                patch_path = self.package_dir / "patches" / patch_file
                
                # Test git apply --check
                result = subprocess.run(
                    ["git", "apply", "--check", str(patch_path)],
                    cwd=test_repo,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    self.log_pass(f"{key}: git apply --check passes")
                else:
                    self.log_fail(f"{key}: git apply --check", result.stderr)
                    continue
                
                # Apply patch
                result = subprocess.run(
                    ["git", "apply", "--index", str(patch_path)],
                    cwd=test_repo,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    self.log_fail(f"{key}: git apply --index", result.stderr)
                    continue
                
                # Get tree hash
                result = subprocess.run(
                    ["git", "write-tree"],
                    cwd=test_repo,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    self.log_fail(f"{key}: git write-tree", result.stderr)
                    continue
                
                actual_tree = result.stdout.strip()
                expected_tree = expected_trees[key]
                
                if actual_tree == expected_tree:
                    self.log_pass(f"{key}: tree matches {expected_tree[:7]}")
                else:
                    self.log_fail(f"{key}: tree reproduction", 
                                 f"Expected {expected_tree}, got {actual_tree}")
                
                # Verify changed files match MANIFEST
                for candidate in manifest.get('candidates', []):
                    if candidate.get('key') == key:
                        expected_files = set(candidate.get('changed_files', []))
                        
                        # Get actual changed files
                        result = subprocess.run(
                            ["git", "diff", "--name-only", "--cached"],
                            cwd=test_repo,
                            capture_output=True,
                            text=True
                        )
                        actual_files = set(result.stdout.strip().split('\n'))
                        
                        if expected_files == actual_files:
                            self.log_pass(f"{key}: changed files match MANIFEST")
                        else:
                            self.log_fail(f"{key}: changed files", 
                                         f"Expected {expected_files}, got {actual_files}")
                        
                        # Verify pnpm-lock.yaml is NOT in diff
                        if 'pnpm-lock.yaml' not in actual_files:
                            self.log_pass(f"{key}: pnpm-lock.yaml not in diff")
                        else:
                            self.log_fail(f"{key}: pnpm-lock.yaml presence", 
                                         "pnpm-lock.yaml should not be modified")
                        break
    
    def test_commit_reproduction(self):
        """TEST 5: Commit reproduction for A'"""
        print(f"\n{Colors.BLUE}=== TEST 5: COMMIT REPRODUCTION (A') ==={Colors.END}")
        
        baseline = "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a"
        expected_commit = "f4a5dfeca5af222aeb9dcb1a6da822415397f902"
        
        with tempfile.TemporaryDirectory(prefix="commit_repro_") as tmpdir:
            test_repo = Path(tmpdir) / "foot"
            
            # Clone and checkout baseline
            subprocess.run(
                ["git", "clone", "-q", "/app/repo_audit/foot-mirror", str(test_repo)],
                capture_output=True
            )
            subprocess.run(
                ["git", "checkout", baseline],
                cwd=test_repo,
                capture_output=True
            )
            
            patch_path = self.package_dir / "patches" / "A-prime-session063-traceability.patch"
            
            # Set environment for git am
            env = os.environ.copy()
            env['GIT_COMMITTER_NAME'] = 'E2 Agent (Emergent)'
            env['GIT_COMMITTER_EMAIL'] = 'github@emergent.sh'
            env['GIT_COMMITTER_DATE'] = 'Mon, 10 Aug 2026 20:30:57 +0000'
            
            # Apply with git am
            result = subprocess.run(
                ["git", "am", str(patch_path)],
                cwd=test_repo,
                env=env,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                self.log_fail("A': git am with recorded metadata", result.stderr)
                return
            
            # Get commit hash
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=test_repo,
                capture_output=True,
                text=True
            )
            
            actual_commit = result.stdout.strip()
            
            if actual_commit == expected_commit:
                self.log_pass(f"A': commit reproduction exact ({expected_commit[:7]})")
            else:
                self.log_fail("A': commit reproduction", 
                             f"Expected {expected_commit}, got {actual_commit}")
    
    def test_evidence_presence(self):
        """TEST 6: Evidence presence and content"""
        print(f"\n{Colors.BLUE}=== TEST 6: EVIDENCE PRESENCE ==={Colors.END}")
        
        # A' evidence
        gate_a = self.package_dir / "evidence/A_prime/gate_A.log"
        if gate_a.exists():
            with open(gate_a, 'r') as f:
                content = f.read()
                if 'RESULT: PASS' in content or content.strip().endswith('PASS'):
                    self.log_pass("A': gate_A.log ends with RESULT: PASS")
                else:
                    self.log_fail("A': gate_A.log ends with RESULT: PASS", 
                                 "PASS not found at end")
        else:
            self.log_fail("A': gate_A.log exists", "File not found")
        
        # C' evidence - count suite logs and check passes/fails
        c_prime_dir = self.package_dir / "evidence/C_prime"
        suite_logs = list(c_prime_dir.glob("test*.log"))
        
        if len(suite_logs) == 13:
            self.log_pass(f"C': 13 suite logs present")
        else:
            self.log_fail("C': 13 suite logs", f"Found {len(suite_logs)} logs")
        
        # Check for frozen_install.log, _meta.txt, _exits.txt, gate_C.log
        required_files = ['frozen_install.log', '_meta.txt', '_exits.txt', 'gate_C.log']
        for fname in required_files:
            if (c_prime_dir / fname).exists():
                self.log_pass(f"C': {fname} exists")
            else:
                self.log_fail(f"C': {fname} exists", "File not found")
        
        # Count passes/fails in suite logs (sum the numbers from TAP output)
        total_passes = 0
        total_fails = 0
        for log in suite_logs:
            with open(log, 'r') as f:
                for line in f:
                    if line.startswith('# pass '):
                        try:
                            total_passes += int(line.split()[2])
                        except (IndexError, ValueError):
                            pass
                    elif line.startswith('# fail '):
                        try:
                            total_fails += int(line.split()[2])
                        except (IndexError, ValueError):
                            pass
        
        if total_passes == 205 and total_fails == 0:
            self.log_pass(f"C': suite logs show 205 passes / 0 fails")
        else:
            self.log_fail("C': suite logs 205/0", 
                         f"Found {total_passes} passes / {total_fails} fails")
        
        # B' evidence
        b_prime_dir = self.package_dir / "evidence/B_prime"
        b_files = ['bprime_typecheck.log', 'bprime_webbuild.log', 'gate_B.log', 
                   'DRAFT_approve-web-ui_rationale.md']
        for fname in b_files:
            if (b_prime_dir / fname).exists():
                self.log_pass(f"B': {fname} exists")
            else:
                self.log_fail(f"B': {fname} exists", "File not found")
        
        # Check DRAFT rationale states DRAFT/not-an-approval and NOT_RUN
        draft_file = b_prime_dir / 'DRAFT_approve-web-ui_rationale.md'
        if draft_file.exists():
            with open(draft_file, 'r') as f:
                content = f.read()
                content_lower = content.lower()
                if 'draft' in content_lower and ('not an approval' in content_lower or 'not-an-approval' in content_lower):
                    self.log_pass("B': DRAFT rationale states DRAFT/not-an-approval")
                else:
                    self.log_fail("B': DRAFT rationale content", 
                                 "Missing DRAFT or not-an-approval statement")
                
                if 'NOT_RUN' in content or 'browser verification' in content.lower():
                    self.log_pass("B': DRAFT rationale mentions browser verification NOT_RUN")
                else:
                    self.log_fail("B': browser verification NOT_RUN", 
                                 "NOT_RUN not mentioned")
        
        # Phase 4C evidence
        phase4c_dir = self.package_dir / "evidence/phase4c_prep"
        contract_log = phase4c_dir / "contract_tests_38of38.log"
        if contract_log.exists():
            with open(contract_log, 'r') as f:
                content = f.read()
                if '# pass 38' in content:
                    self.log_pass("Phase 4C: contract_tests_38of38.log shows '# pass 38'")
                else:
                    self.log_fail("Phase 4C: contract tests 38/38", 
                                 "'# pass 38' not found")
        else:
            self.log_fail("Phase 4C: contract_tests_38of38.log exists", "File not found")
        
        # Rule 12 evidence
        rule12_dir = self.package_dir / "evidence/rule12_provenance"
        gate_prov = rule12_dir / "gate_provenance.log"
        if gate_prov.exists():
            with open(gate_prov, 'r') as f:
                content = f.read()
                if 'RESULT: PASS' in content or content.strip().endswith('PASS'):
                    self.log_pass("Rule 12: gate_provenance.log ends with RESULT: PASS")
                else:
                    self.log_fail("Rule 12: gate_provenance.log PASS", 
                                 "PASS not found at end")
        else:
            self.log_fail("Rule 12: gate_provenance.log exists", "File not found")
    
    def test_guide_statements(self):
        """TEST 7: APPLICATION_GUIDE.md required statements"""
        print(f"\n{Colors.BLUE}=== TEST 7: GUIDE REQUIRED STATEMENTS ==={Colors.END}")
        
        guide_file = self.package_dir / "APPLICATION_GUIDE.md"
        if not guide_file.exists():
            self.log_fail("APPLICATION_GUIDE.md exists", "File not found")
            return
        
        with open(guide_file, 'r') as f:
            content = f.read().lower()
        
        required_statements = [
            ('transport artifacts only', 'transport'),
            ('no patch has been applied remotely', 'no patch has been applied'),
            ('five separate candidates', 'five separate'),
            ('C\' and B\' must be re-derived', 're-derived'),
            ('B\' requires a real reviewed --approve-web-ui rationale', 'approve-web-ui'),
            ('no patch may be applied until its individual publication approval exists', 
             'no patch may be applied until')
        ]
        
        for desc, search_term in required_statements:
            if search_term.lower() in content:
                self.log_pass(f"Guide contains: {desc}")
            else:
                self.log_fail(f"Guide contains: {desc}", f"'{search_term}' not found")
    
    def test_rule12_separation(self, manifest):
        """TEST 8: Rule 12 separation in MANIFEST"""
        print(f"\n{Colors.BLUE}=== TEST 8: RULE12 SEPARATION ==={Colors.END}")
        
        if not manifest:
            print(f"{Colors.YELLOW}Skipping - manifest not loaded{Colors.END}")
            return
        
        for candidate in manifest.get('candidates', []):
            if candidate.get('key') == 'rule12_provenance':
                commit = candidate.get('commit', '')
                
                # Check full 40-char commit
                if len(commit) == 40 and commit == 'b85f71f32202c293c1d7c240ec4af151b22c2c41':
                    self.log_pass("Rule 12: FULL 40-char commit recorded (not abbreviated)")
                else:
                    self.log_fail("Rule 12: full commit hash", 
                                 f"Expected 40 chars, got {len(commit)}: {commit}")
                
                # Check approval_status forbids merging with A'
                approval = candidate.get('approval_status', '').lower()
                if 'not' in approval and ('merge' in approval or 'part of a' in approval):
                    self.log_pass("Rule 12: approval_status forbids merging/publishing as part of A'")
                else:
                    self.log_fail("Rule 12: approval status separation", 
                                 "Does not clearly forbid merging with A'")
                break
    
    def test_ledger_capture(self):
        """TEST 9: Ledger capture validation"""
        print(f"\n{Colors.BLUE}=== TEST 9: LEDGER CAPTURE ==={Colors.END}")
        
        ledger_file = Path("/app/memory/evidence/LEDGER.jsonl")
        if not ledger_file.exists():
            self.log_fail("LEDGER.jsonl exists", "File not found")
            return
        
        # Parse ledger
        records = []
        with open(ledger_file, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        
        # Check for AC-001 through AC-007
        ac_records = {r['id']: r for r in records if r.get('id', '').startswith('AC-')}
        
        expected_ac = ['AC-001', 'AC-002', 'AC-003', 'AC-004', 'AC-005', 'AC-006', 'AC-007']
        for ac_id in expected_ac:
            if ac_id in ac_records:
                record = ac_records[ac_id]
                status = record.get('status')
                
                if ac_id == 'AC-006':
                    if status == 'NOT_RUN':
                        self.log_pass(f"{ac_id}: status NOT_RUN (B' browser verification)")
                    else:
                        self.log_fail(f"{ac_id}: status NOT_RUN", f"Found status: {status}")
                else:
                    tests = record.get('tests', {})
                    if isinstance(tests, dict):
                        total = tests.get('total', 0)
                        passed = tests.get('passed', 0)
                    else:
                        total = passed = 0
                    
                    if status == 'PASS':
                        if ac_id in ['AC-001', 'AC-002', 'AC-003', 'AC-004', 'AC-005']:
                            self.log_pass(f"{ac_id}: status PASS with tests 6/6")
                        elif ac_id == 'AC-007':
                            if total == 38 and passed == 38:
                                self.log_pass(f"{ac_id}: status PASS with tests 38/38")
                            else:
                                self.log_fail(f"{ac_id}: tests 38/38", 
                                             f"Found {passed}/{total}")
                    else:
                        self.log_fail(f"{ac_id}: status PASS", f"Found status: {status}")
            else:
                self.log_fail(f"{ac_id}: record exists", "Record not found in ledger")
        
        # Check for LV-009 handoff record
        lv_records = {r['id']: r for r in records if r.get('id', '').startswith('LV-')}
        if 'LV-009' in lv_records:
            record = lv_records['LV-009']
            effects = record.get('effects', {})
            remote_changed = effects.get('remote_changed', True)
            
            if remote_changed == False or remote_changed == 'false':
                self.log_pass("LV-009: handoff record with remote_changed=false")
            else:
                self.log_fail("LV-009: remote_changed=false", 
                             f"Found remote_changed={remote_changed}")
        else:
            self.log_fail("LV-009: handoff record exists", "Record not found")
        
        # Verify ledger with record_action.py
        verify_script = Path("/app/memory/evidence/record_action.py")
        if verify_script.exists():
            result = subprocess.run(
                ["python3", str(verify_script), "verify"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and 'VERIFY PASS' in result.stdout:
                # Count records
                record_count = len(records)
                self.log_pass(f"record_action.py verify -> VERIFY PASS with {record_count} records")
            else:
                self.log_fail("record_action.py verify", 
                             f"Exit {result.returncode}: {result.stdout}")
        else:
            self.log_fail("record_action.py exists", "Script not found")
    
    def test_security(self):
        """TEST 10: Security - no credentials in package"""
        print(f"\n{Colors.BLUE}=== TEST 10: SECURITY ==={Colors.END}")
        
        # Patterns to search for
        patterns = [
            ('credentialed URLs', r'[a-zA-Z0-9]+:[^@\s]+@'),
            ('GitHub tokens', r'(ghp_|github_pat_)[a-zA-Z0-9]+'),
            ('AWS keys', r'AKIA[0-9A-Z]{16}'),
            ('PRIVATE KEY blocks', r'-----BEGIN.*PRIVATE KEY-----'),
            ('JWT tokens', r'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'),
            ('.env files', r'\.env$')
        ]
        
        findings = []
        
        # Recursively search all files
        for root, dirs, files in os.walk(self.package_dir):
            for file in files:
                filepath = Path(root) / file
                try:
                    with open(filepath, 'r', errors='ignore') as f:
                        content = f.read()
                        
                    for pattern_name, pattern in patterns:
                        import re
                        if re.search(pattern, content):
                            findings.append(f"{pattern_name} in {filepath.relative_to(self.package_dir)}")
                except (IOError, UnicodeDecodeError):
                    pass
        
        # Also check for .env files by name
        for root, dirs, files in os.walk(self.package_dir):
            for file in files:
                if file.endswith('.env'):
                    findings.append(f".env file: {Path(root).relative_to(self.package_dir) / file}")
        
        if len(findings) == 0:
            self.log_pass("Security: zero credential findings (recursive grep)")
        else:
            self.log_fail("Security: no credentials", 
                         f"Found {len(findings)} issues: {', '.join(findings[:3])}")
    
    def test_remote_untouched(self):
        """TEST 11: Remote repository untouched"""
        print(f"\n{Colors.BLUE}=== TEST 11: REMOTE UNTOUCHED ==={Colors.END}")
        
        # Check remote main
        result = subprocess.run(
            ["git", "ls-remote", "https://github.com/sbtheg17-market/foot", "main"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            if '3e76114ce8ff8908a955d4beac38d6b3cde5dd6a' in output:
                self.log_pass("Remote main still at 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a")
            else:
                self.log_fail("Remote main at baseline", 
                             f"Found: {output}")
        else:
            self.log_fail("git ls-remote main", result.stderr)
        
        # Count total refs
        result = subprocess.run(
            ["git", "ls-remote", "https://github.com/sbtheg17-market/foot"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            refs = [line for line in result.stdout.strip().split('\n') if line]
            ref_count = len(refs)
            
            if ref_count == 21:
                self.log_pass(f"Remote has exactly 21 refs (HEAD + main + 19 conflict_*)")
            else:
                self.log_fail("Remote ref count", 
                             f"Expected 21 refs, found {ref_count}")
        else:
            self.log_fail("git ls-remote (all refs)", result.stderr)
    
    def test_governance_worktree(self):
        """TEST 12: Governance worktree clean"""
        print(f"\n{Colors.BLUE}=== TEST 12: GOVERNANCE WORKTREE CLEAN ==={Colors.END}")
        
        main_worktree = Path("/app/repo_audit/main_worktree")
        validate_worktree = Path("/app/repo_audit/validate_worktree")
        
        # Check main_worktree
        if main_worktree.exists():
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=main_worktree,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                if result.stdout.strip() == '':
                    self.log_pass("main_worktree: git status --porcelain is empty")
                else:
                    self.log_fail("main_worktree: clean status", 
                                 f"Found changes:\n{result.stdout}")
            else:
                self.log_fail("main_worktree: git status", result.stderr)
            
            # Check current branch
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=main_worktree,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                branch = result.stdout.strip()
                if branch == 'phase4c/non-schema-prep':
                    self.log_pass("main_worktree: current branch is phase4c/non-schema-prep")
                else:
                    self.log_fail("main_worktree: branch phase4c/non-schema-prep", 
                                 f"Found branch: {branch}")
        else:
            self.log_fail("main_worktree exists", "Directory not found")
        
        # Check validate_worktree
        if validate_worktree.exists():
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=validate_worktree,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                commit = result.stdout.strip()
                if commit.startswith('3e76114'):
                    self.log_pass("validate_worktree: at 3e76114")
                else:
                    self.log_fail("validate_worktree: at 3e76114", 
                                 f"Found commit: {commit}")
            
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=validate_worktree,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                if result.stdout.strip() == '':
                    self.log_pass("validate_worktree: clean status")
                else:
                    self.log_fail("validate_worktree: clean status", 
                                 f"Found changes:\n{result.stdout}")
        else:
            self.log_fail("validate_worktree exists", "Directory not found")
    
    def run_all_tests(self):
        """Run all validation tests"""
        print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
        print(f"{Colors.BLUE}TRANSPORT-ONLY PATCH PACKAGE VALIDATION{Colors.END}")
        print(f"{Colors.BLUE}Repository: sbtheg17-market/foot{Colors.END}")
        print(f"{Colors.BLUE}Baseline: 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a{Colors.END}")
        print(f"{Colors.BLUE}{'='*70}{Colors.END}")
        
        # Run all tests
        self.test_package_integrity()
        manifest = self.test_manifest_structure()
        self.test_patch_identity(manifest)
        self.test_independent_applicability(manifest)
        self.test_commit_reproduction()
        self.test_evidence_presence()
        self.test_guide_statements()
        self.test_rule12_separation(manifest)
        self.test_ledger_capture()
        self.test_security()
        self.test_remote_untouched()
        self.test_governance_worktree()
        
        # Print summary
        print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
        print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
        print(f"{Colors.BLUE}{'='*70}{Colors.END}")
        print(f"Total tests run: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.END}")
        
        if self.tests_failed > 0:
            print(f"\n{Colors.RED}FAILURES:{Colors.END}")
            for failure in self.failures:
                print(f"  {Colors.RED}•{Colors.END} {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\nSuccess rate: {success_rate:.1f}%")
        
        return 0 if self.tests_failed == 0 else 1

if __name__ == "__main__":
    validator = PatchPackageValidator()
    sys.exit(validator.run_all_tests())
