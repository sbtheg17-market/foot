"""
Backend API Test Suite for Comfort Wiring App
Tests consent-first comfort profile with scoped sharing, provider auth, and consent history.
"""
import requests
import sys
import hashlib
from datetime import datetime

class ComfortWiringAPITester:
    def __init__(self, base_url="https://repo-instructions.preview.emergentagent.com"):
        self.base_url = base_url
        self.patient_token = None
        self.patient_id = None
        self.provider_token = None
        self.provider_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   Details: {details}")
        self.test_results.append({"name": name, "passed": passed, "details": details})

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        if headers:
            req_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=10)

            success = response.status_code == expected_status
            result_data = None
            try:
                result_data = response.json()
            except Exception:
                pass

            if not success:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}")
            else:
                self.log_result(name, True)

            return success, result_data, response.status_code

        except Exception as e:
            self.log_result(name, False, f"Error: {str(e)}")
            return False, None, None

    def test_patient_register(self):
        """Test patient registration"""
        timestamp = datetime.now().strftime('%H%M%S%f')
        email = f"patient-{timestamp}@test.dev"
        success, data, _ = self.run_test(
            "Patient Register",
            "POST",
            "auth/register",
            201,
            data={"email": email, "password": "testpass123", "name": "Test Patient"}
        )
        if success and data:
            self.patient_token = data.get('token')
            self.patient_id = data.get('patient', {}).get('id')
            return True
        return False

    def test_patient_login(self, email, password):
        """Test patient login"""
        success, data, _ = self.run_test(
            "Patient Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and data:
            self.patient_token = data.get('token')
            self.patient_id = data.get('patient', {}).get('id')
            return True
        return False

    def test_consent_history_unauthorized(self):
        """Test consent history returns 401 without identity"""
        self.run_test(
            "Consent History - 401 without auth",
            "GET",
            "comfort-profile/consent/history",
            401
        )

    def test_consent_history_with_auth(self):
        """Test consent history returns 200 with Bearer token and includes hash"""
        if not self.patient_token:
            self.log_result("Consent History - with auth", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Consent History - 200 with Bearer",
            "GET",
            "comfort-profile/consent/history",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        if success and data:
            # Verify hash consistency
            consent_text = data.get('consentText', '')
            consent_hash = data.get('consentTextHash', '')
            expected_hash = hashlib.sha256(consent_text.encode()).hexdigest()
            
            if consent_hash == expected_hash:
                self.log_result("Consent History - hash verification", True)
            else:
                self.log_result("Consent History - hash verification", False, 
                              f"Hash mismatch: {consent_hash[:12]}... != {expected_hash[:12]}...")
            
            # Verify version
            if data.get('consentTextVersion') == '1':
                self.log_result("Consent History - version check", True)
            else:
                self.log_result("Consent History - version check", False, 
                              f"Version: {data.get('consentTextVersion')}")
            
            return True
        return False

    def test_grant_consent_partial_scope(self):
        """Test granting consent with partial scope"""
        if not self.patient_token:
            self.log_result("Grant Consent - partial scope", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Grant Consent - partial scope ['temperature','noise']",
            "POST",
            "comfort-profile/consent",
            201,
            data={"scope": ["temperature", "noise"]},
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        if success and data:
            # Verify scope in response
            if data.get('scope') == ["temperature", "noise"]:
                self.log_result("Grant Consent - scope verification", True)
            else:
                self.log_result("Grant Consent - scope verification", False, 
                              f"Scope: {data.get('scope')}")
            return True
        return False

    def test_consent_history_after_grant(self):
        """Test consent history shows grant with version and hash"""
        if not self.patient_token:
            self.log_result("Consent History - after grant", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Consent History - after grant",
            "GET",
            "comfort-profile/consent/history",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        if success and data:
            history = data.get('history', [])
            if len(history) >= 1:
                latest = history[0]
                if latest.get('status') == 'ACTIVE' and latest.get('consentVersion') == '1':
                    self.log_result("Consent History - grant recorded with version", True)
                else:
                    self.log_result("Consent History - grant recorded with version", False,
                                  f"Status: {latest.get('status')}, Version: {latest.get('consentVersion')}")
            else:
                self.log_result("Consent History - grant recorded", False, "No history entries")
            return True
        return False

    def test_save_preferences(self):
        """Test saving preferences"""
        if not self.patient_token:
            self.log_result("Save Preferences", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Save Preferences - temperature Warm + note",
            "PUT",
            "comfort-profile/preferences",
            200,
            data={"temperature": "warm", "notes": "Private note - should not leak"},
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )
        return success

    def test_withdraw_consent(self):
        """Test withdrawing consent"""
        if not self.patient_token:
            self.log_result("Withdraw Consent", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Withdraw Consent",
            "POST",
            "comfort-profile/consent/withdraw",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )
        return success

    def test_consent_history_after_withdraw(self):
        """Test consent history shows withdraw on top (newest first)"""
        if not self.patient_token:
            self.log_result("Consent History - after withdraw", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Consent History - after withdraw (newest first)",
            "GET",
            "comfort-profile/consent/history",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        if success and data:
            history = data.get('history', [])
            if len(history) >= 2:
                if history[0].get('status') == 'WITHDRAWN' and history[1].get('status') == 'ACTIVE':
                    self.log_result("Consent History - withdraw on top", True)
                else:
                    self.log_result("Consent History - withdraw on top", False,
                                  f"Order: {history[0].get('status')}, {history[1].get('status')}")
            else:
                self.log_result("Consent History - withdraw recorded", False, 
                              f"History length: {len(history)}")
            return True
        return False

    def test_data_preserved_after_withdraw(self):
        """Test that profile data is preserved after withdraw"""
        if not self.patient_token:
            self.log_result("Data Preserved - after withdraw", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Get Profile - data preserved after withdraw",
            "GET",
            "comfort-profile",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        if success and data:
            prefs = data.get('preferences', {})
            if prefs.get('temperature') == 'warm':
                self.log_result("Data Preserved - temperature still 'warm'", True)
            else:
                self.log_result("Data Preserved - temperature check", False,
                              f"Temperature: {prefs.get('temperature')}")
            return True
        return False

    def test_provider_register(self):
        """Test provider registration"""
        timestamp = datetime.now().strftime('%H%M%S%f')
        email = f"provider-{timestamp}@test.dev"
        success, data, _ = self.run_test(
            "Provider Register",
            "POST",
            "auth/provider/register",
            201,
            data={"email": email, "password": "testpass123", "name": "Test Provider"}
        )
        if success and data:
            self.provider_token = data.get('token')
            self.provider_id = data.get('provider', {}).get('id')
            return True
        return False

    def test_provider_login(self, email, password):
        """Test provider login"""
        success, data, _ = self.run_test(
            "Provider Login",
            "POST",
            "auth/provider/login",
            200,
            data={"email": email, "password": password}
        )
        if success and data:
            self.provider_token = data.get('token')
            return True
        return False

    def test_provider_me_role_enforced(self):
        """Test GET /api/auth/provider/me with patient token returns 401"""
        if not self.patient_token:
            self.log_result("Provider /me - role enforcement", False, "No patient token")
            return False

        success, data, status = self.run_test(
            "Provider /me - patient token rejected (401)",
            "GET",
            "auth/provider/me",
            401,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )
        return success

    def test_provider_projection_404_only(self):
        """Test provider projection returns 404 (never 403)"""
        if not self.provider_token:
            self.log_result("Provider Projection - 404 semantics", False, "No provider token")
            return False

        # Test with random UUID (should be 404)
        import uuid
        random_id = str(uuid.uuid4())
        success, data, status = self.run_test(
            "Provider Projection - 404 for non-existent patient",
            "GET",
            f"provider/comfort-projection/{random_id}",
            404,
            headers={'Authorization': f'Bearer {self.provider_token}'}
        )
        return success

    def test_provider_projection_notes_excluded(self):
        """Test provider projection excludes notes when not in scope"""
        if not self.provider_token or not self.patient_id:
            self.log_result("Provider Projection - notes excluded", False, 
                          "Missing provider token or patient ID")
            return False

        # First, re-grant consent WITHOUT notes
        self.run_test(
            "Re-grant Consent - without notes",
            "POST",
            "comfort-profile/consent",
            201,
            data={"scope": ["temperature", "lighting", "noise"]},
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )

        # Provider looks up patient
        success, data, _ = self.run_test(
            "Provider Projection - lookup patient",
            "GET",
            f"provider/comfort-projection/{self.patient_id}",
            200,
            headers={'Authorization': f'Bearer {self.provider_token}'}
        )

        if success and data:
            projection = data.get('projection', {})
            if 'temperature' in projection and 'notes' not in projection:
                self.log_result("Provider Projection - notes excluded from scope", True)
            else:
                self.log_result("Provider Projection - notes excluded from scope", False,
                              f"Projection keys: {list(projection.keys())}")
            return True
        return False

    def test_patient_logout(self):
        """Test patient logout (hardened - always 200)"""
        if not self.patient_token:
            self.log_result("Patient Logout", False, "No patient token")
            return False

        success, data, _ = self.run_test(
            "Patient Logout - hardened (always 200)",
            "POST",
            "auth/logout",
            200,
            headers={'Authorization': f'Bearer {self.patient_token}'}
        )
        return success

    def test_provider_logout(self):
        """Test provider logout"""
        if not self.provider_token:
            self.log_result("Provider Logout", False, "No provider token")
            return False

        success, data, _ = self.run_test(
            "Provider Logout",
            "POST",
            "auth/logout",
            200,
            headers={'Authorization': f'Bearer {self.provider_token}'}
        )
        return success

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        print("="*60)
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed!")
            return 0
        else:
            print(f"❌ {self.tests_run - self.tests_passed} test(s) failed")
            return 1


def main():
    print("🧪 Starting Comfort Wiring Backend API Tests")
    print("="*60)
    
    tester = ComfortWiringAPITester()

    # Patient auth flow
    print("\n📋 Patient Authentication Tests")
    if not tester.test_patient_register():
        print("❌ Patient registration failed, stopping tests")
        return 1

    # Consent history tests
    print("\n📋 Consent History Tests")
    tester.test_consent_history_unauthorized()
    tester.test_consent_history_with_auth()

    # Grant consent with partial scope
    print("\n📋 Consent Grant Tests (Partial Scope)")
    tester.test_grant_consent_partial_scope()
    tester.test_consent_history_after_grant()

    # Save preferences
    print("\n📋 Preferences Tests")
    tester.test_save_preferences()

    # Withdraw consent
    print("\n📋 Consent Withdraw Tests")
    tester.test_withdraw_consent()
    tester.test_consent_history_after_withdraw()
    tester.test_data_preserved_after_withdraw()

    # Provider auth tests
    print("\n📋 Provider Authentication Tests")
    if not tester.test_provider_register():
        print("❌ Provider registration failed, stopping provider tests")
        return tester.print_summary()

    tester.test_provider_me_role_enforced()

    # Provider projection tests
    print("\n📋 Provider Projection Tests")
    tester.test_provider_projection_404_only()
    tester.test_provider_projection_notes_excluded()

    # Logout tests
    print("\n📋 Logout Tests")
    tester.test_patient_logout()
    tester.test_provider_logout()

    return tester.print_summary()


if __name__ == "__main__":
    sys.exit(main())
