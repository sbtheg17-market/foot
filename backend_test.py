#!/usr/bin/env python3
"""
Backend API sanity tests for OnCall Foot admin provider application decision feature.
CRITICAL: This is a READ-ONLY test against LIVE production database.
NEVER calls approve/reject/purge endpoints.
"""

import requests
import sys
from typing import Optional

BASE_URL = "https://oncall-operations.preview.emergentagent.com"
ADMIN_EMAIL = "admin@oncallfoot.com"
ADMIN_PASSWORD = "demo1234"


class ReadOnlyAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token: Optional[str] = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message: str):
        """Log a test message"""
        print(f"  {message}")

    def test(self, name: str, passed: bool, details: str = ""):
        """Record a test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                self.log(details)
        else:
            print(f"❌ {name}")
            if details:
                self.log(details)

    def login(self) -> bool:
        """Login as admin and get token"""
        print("\n🔐 Logging in as admin...")
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                if self.token:
                    self.log(f"Login successful, token received")
                    return True
                else:
                    self.log("Login response missing token")
                    return False
            else:
                self.log(f"Login failed: {response.status_code} - {response.text[:200]}")
                return False
        except Exception as e:
            self.log(f"Login error: {str(e)}")
            return False

    def test_provider_applications_with_auth(self):
        """Test GET /api/admin/provider-applications with admin token"""
        print("\n📋 Testing provider applications endpoint (authenticated)...")
        try:
            response = requests.get(
                f"{self.base_url}/api/admin/provider-applications",
                headers={"Authorization": f"Bearer {self.token}"},
                params={"status": "under_review", "limit": 10},
                timeout=10
            )
            
            passed = response.status_code == 200
            if passed:
                data = response.json()
                total = data.get("total", 0)
                items_count = len(data.get("items", []))
                self.test(
                    "GET /api/admin/provider-applications (authenticated)",
                    True,
                    f"Status: 200, Total: {total}, Items returned: {items_count}"
                )
            else:
                self.test(
                    "GET /api/admin/provider-applications (authenticated)",
                    False,
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.test(
                "GET /api/admin/provider-applications (authenticated)",
                False,
                f"Error: {str(e)}"
            )

    def test_provider_applications_without_auth(self):
        """Test GET /api/admin/provider-applications without token (should be 401)"""
        print("\n🔒 Testing provider applications endpoint (unauthenticated)...")
        try:
            response = requests.get(
                f"{self.base_url}/api/admin/provider-applications",
                params={"status": "under_review", "limit": 10},
                timeout=10
            )
            
            passed = response.status_code == 401
            if passed:
                self.test(
                    "GET /api/admin/provider-applications (unauthenticated)",
                    True,
                    f"Correctly returned 401 Unauthorized"
                )
            else:
                self.test(
                    "GET /api/admin/provider-applications (unauthenticated)",
                    False,
                    f"Expected 401, got {response.status_code}"
                )
        except Exception as e:
            self.test(
                "GET /api/admin/provider-applications (unauthenticated)",
                False,
                f"Error: {str(e)}"
            )

    def run_all_tests(self):
        """Run all read-only API tests"""
        print("=" * 70)
        print("🧪 OnCall Foot Admin API - Read-Only Sanity Tests")
        print("=" * 70)
        print(f"Base URL: {self.base_url}")
        print(f"Admin: {ADMIN_EMAIL}")
        print("CRITICAL: READ-ONLY tests only, no mutations")
        
        # Login first
        if not self.login():
            print("\n❌ Login failed, cannot proceed with authenticated tests")
            return 1
        
        # Run read-only tests
        self.test_provider_applications_without_auth()
        self.test_provider_applications_with_auth()
        
        # Summary
        print("\n" + "=" * 70)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        print("=" * 70)
        
        return 0 if self.tests_passed == self.tests_run else 1


def main():
    tester = ReadOnlyAPITester()
    return tester.run_all_tests()


if __name__ == "__main__":
    sys.exit(main())
