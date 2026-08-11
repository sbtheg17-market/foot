#!/usr/bin/env python3
"""
Backend API Test Suite for Git Repository Recovery Workspace
Tests read-only download endpoints serving forensic recovery artifacts.
"""

import requests
import hashlib
import sys
import os
import tarfile
import tempfile
from pathlib import Path

# Base URL from frontend/.env
BASE_URL = "https://musing-darwin-10.preview.emergentagent.com"

class RecoveryEndpointTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.temp_dir = tempfile.mkdtemp(prefix="recovery_test_")
        print(f"📁 Using temp directory: {self.temp_dir}\n")

    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ PASS: {name}")
        else:
            print(f"❌ FAIL: {name}")
        if details:
            print(f"   {details}")
        print()

    def download_file(self, endpoint, output_path):
        """Download file from endpoint to output_path, return response object"""
        url = f"{self.base_url}{endpoint}"
        print(f"   Downloading from: {url}")
        
        try:
            response = requests.get(url, stream=True, timeout=60)
            
            if response.status_code != 200:
                return response, None
            
            # Stream to file
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            file_size = os.path.getsize(output_path)
            print(f"   Downloaded {file_size:,} bytes")
            
            return response, file_size
            
        except Exception as e:
            print(f"   Exception during download: {str(e)}")
            return None, None

    def calculate_sha256(self, file_path):
        """Calculate SHA-256 checksum of a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def test_root_endpoint(self):
        """Test GET /api/ returns hello message"""
        print("🔍 Testing root endpoint...")
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Hello" in data["message"]:
                    self.log_test("Root endpoint /api/", True, f"Response: {data}")
                    return True
                else:
                    self.log_test("Root endpoint /api/", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Root endpoint /api/", False, f"Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Root endpoint /api/", False, f"Exception: {str(e)}")
            return False

    def test_checksum_endpoint(self, endpoint, expected_hash, expected_filename):
        """Test a .sha256 checksum endpoint"""
        print(f"🔍 Testing checksum endpoint: {endpoint}")
        try:
            response = requests.get(f"{self.base_url}{endpoint}", timeout=10)
            
            if response.status_code != 200:
                self.log_test(f"Checksum endpoint {endpoint}", False, f"Status code: {response.status_code}")
                return None
            
            content = response.text.strip()
            print(f"   Content: {content}")
            
            # Parse the checksum line (format: "hash  filename")
            parts = content.split()
            if len(parts) >= 2:
                hash_value = parts[0]
                filename = parts[-1]  # Last part is filename
                
                # Check if hash matches expected
                hash_matches = hash_value == expected_hash
                # Check if filename is mentioned
                filename_present = expected_filename in content
                
                if hash_matches and filename_present:
                    self.log_test(f"Checksum endpoint {endpoint}", True, 
                                f"Hash: {hash_value}, Filename: {filename}")
                    return hash_value
                else:
                    self.log_test(f"Checksum endpoint {endpoint}", False,
                                f"Hash match: {hash_matches}, Filename present: {filename_present}")
                    return None
            else:
                self.log_test(f"Checksum endpoint {endpoint}", False, f"Invalid format: {content}")
                return None
                
        except Exception as e:
            self.log_test(f"Checksum endpoint {endpoint}", False, f"Exception: {str(e)}")
            return None

    def test_archive_download(self, endpoint, checksum_endpoint, expected_hash, 
                            expected_filename, archive_name, check_contents=False):
        """Test downloading an archive and verifying its checksum"""
        print(f"🔍 Testing archive download: {endpoint}")
        
        # First, get the expected checksum from the checksum endpoint
        print(f"   Step 1: Fetching checksum from {checksum_endpoint}")
        checksum_from_api = self.test_checksum_endpoint(checksum_endpoint, expected_hash, expected_filename)
        
        if not checksum_from_api:
            print(f"   ⚠️  Checksum endpoint failed, but continuing with download test...")
        
        # Download the archive
        print(f"   Step 2: Downloading archive from {endpoint}")
        output_path = os.path.join(self.temp_dir, expected_filename)
        response, file_size = self.download_file(endpoint, output_path)
        
        if response is None or response.status_code != 200:
            status = response.status_code if response else "No response"
            self.log_test(f"Archive download {archive_name}", False, 
                        f"Download failed with status: {status}")
            return False
        
        # Check Content-Disposition header
        print(f"   Step 3: Checking Content-Disposition header")
        content_disposition = response.headers.get('content-disposition', '')
        has_attachment = 'attachment' in content_disposition.lower()
        has_filename = expected_filename in content_disposition
        
        print(f"   Content-Disposition: {content_disposition}")
        print(f"   Has 'attachment': {has_attachment}, Has filename: {has_filename}")
        
        if not has_attachment:
            print(f"   ⚠️  Warning: Content-Disposition missing 'attachment'")
        
        # Calculate SHA-256
        print(f"   Step 4: Calculating SHA-256 checksum")
        calculated_hash = self.calculate_sha256(output_path)
        print(f"   Calculated: {calculated_hash}")
        print(f"   Expected:   {expected_hash}")
        
        hash_matches = calculated_hash == expected_hash
        
        # Verify it's a valid gzip archive
        print(f"   Step 5: Verifying archive is valid gzip")
        is_valid_gzip = False
        try:
            with tarfile.open(output_path, 'r:gz') as tar:
                members = tar.getnames()
                is_valid_gzip = True
                print(f"   ✓ Valid gzip archive with {len(members)} files/directories")
                
                # If requested, check for specific contents
                if check_contents:
                    print(f"   Step 6: Checking archive contents")
                    required_files = ['MANIFEST.json', 'PROVENANCE.md', 'STATUS.txt', 'CHECKSUMS.sha256']
                    found_files = []
                    has_evidence_dir = False
                    
                    for member in members:
                        basename = os.path.basename(member)
                        if basename in required_files:
                            found_files.append(basename)
                        if 'evidence' in member.lower() and tar.getmember(member).isdir():
                            has_evidence_dir = True
                    
                    print(f"   Required files found: {found_files}")
                    print(f"   Has evidence/ directory: {has_evidence_dir}")
                    
                    all_required_present = len(found_files) == len(required_files) and has_evidence_dir
                    
                    if not all_required_present:
                        missing = set(required_files) - set(found_files)
                        if missing:
                            print(f"   ⚠️  Missing required files: {missing}")
                        if not has_evidence_dir:
                            print(f"   ⚠️  Missing evidence/ directory")
                    
                    # Overall test result
                    test_passed = hash_matches and is_valid_gzip and all_required_present
                    self.log_test(f"Archive download {archive_name}", test_passed,
                                f"Hash match: {hash_matches}, Valid gzip: {is_valid_gzip}, "
                                f"Required contents: {all_required_present}, Size: {file_size:,} bytes")
                    return test_passed
                    
        except Exception as e:
            print(f"   ✗ Failed to open as gzip: {str(e)}")
            is_valid_gzip = False
        
        # Overall test result (without content check)
        if not check_contents:
            test_passed = hash_matches and is_valid_gzip
            self.log_test(f"Archive download {archive_name}", test_passed,
                        f"Hash match: {hash_matches}, Valid gzip: {is_valid_gzip}, Size: {file_size:,} bytes")
            return test_passed
        
        return False

    def run_all_tests(self):
        """Run all endpoint tests"""
        print("=" * 80)
        print("GIT REPOSITORY RECOVERY WORKSPACE - BACKEND API TEST SUITE")
        print("=" * 80)
        print()
        
        # Test 1: Root endpoint
        self.test_root_endpoint()
        
        # Test 2: Main export bundle (12MB)
        self.test_archive_download(
            endpoint="/api/recovery/export",
            checksum_endpoint="/api/recovery/export.sha256",
            expected_hash="e6385b3c1ad972d16c1672efbbd4a6ff4df432cafb966f1ef4ddd2ca06611d8d",
            expected_filename="foot-handoff-bundle-sealed-2026-08-11.tar.gz",
            archive_name="foot-handoff-bundle",
            check_contents=False  # Main bundle - don't check internal structure
        )
        
        # Test 3: Phase4c-r3 package
        self.test_archive_download(
            endpoint="/api/recovery/phase4c-r3",
            checksum_endpoint="/api/recovery/phase4c-r3.sha256",
            expected_hash="2a981539f79ca4448d4fdea39d80dd7b4e36c0ba0b1cb7af2a52a14aceb5e803",
            expected_filename="phase4c-r3-package-2026-08-11.tar.gz",
            archive_name="phase4c-r3",
            check_contents=True  # Check for required files
        )
        
        # Test 4: Rule12-r3 package
        self.test_archive_download(
            endpoint="/api/recovery/rule12-r3",
            checksum_endpoint="/api/recovery/rule12-r3.sha256",
            expected_hash="fedacb17c94411ff63727ab090dd8fa2dee663761fa0107232e99403f4a858aa",
            expected_filename="rule12-r3-package-2026-08-11.tar.gz",
            archive_name="rule12-r3",
            check_contents=True  # Check for required files
        )
        
        # Print summary
        print("=" * 80)
        print(f"TEST SUMMARY: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 80)
        
        # Cleanup
        print(f"\n🧹 Cleaning up temp directory: {self.temp_dir}")
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
        return self.tests_passed == self.tests_run

def main():
    tester = RecoveryEndpointTester(BASE_URL)
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
