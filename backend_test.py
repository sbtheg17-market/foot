#!/usr/bin/env python3
"""
OnCall Foot API Testing Suite
Tests all backend endpoints via the preview URL
"""

import requests
import sys
from datetime import datetime
import json

class OnCallFootAPITester:
    def __init__(self, base_url="https://build-resume-40.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
        self.test_results.append({
            "name": name,
            "passed": passed,
            "details": details
        })

    def test_health(self):
        """Test health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            passed = response.status_code == 200
            self.log_test("Health Check", passed, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test("Health Check", False, f"Error: {str(e)}")
            return False

    def test_login(self, email, password, role):
        """Test login endpoint"""
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.tokens[role] = data["token"]
                    self.log_test(f"Login as {role} ({email})", True, f"Token received")
                    return True
                else:
                    self.log_test(f"Login as {role} ({email})", False, "No token in response")
                    return False
            else:
                self.log_test(f"Login as {role} ({email})", False, f"Status: {response.status_code}, Body: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_test(f"Login as {role} ({email})", False, f"Error: {str(e)}")
            return False

    def test_auth_me(self, role):
        """Test /api/auth/me endpoint"""
        if role not in self.tokens:
            self.log_test(f"Auth Me ({role})", False, "No token available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/api/auth/me",
                headers={"Authorization": f"Bearer {self.tokens[role]}"},
                timeout=10
            )
            
            passed = response.status_code == 200
            if passed:
                data = response.json()
                self.log_test(f"Auth Me ({role})", True, f"User: {data.get('email', 'N/A')}")
            else:
                self.log_test(f"Auth Me ({role})", False, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test(f"Auth Me ({role})", False, f"Error: {str(e)}")
            return False

    def test_unauthenticated_me(self):
        """Test /api/auth/me without token (should return 401)"""
        try:
            response = requests.get(
                f"{self.base_url}/api/auth/me",
                timeout=10
            )
            
            passed = response.status_code == 401
            self.log_test("Unauthenticated Auth Me", passed, f"Status: {response.status_code} (expected 401)")
            return passed
        except Exception as e:
            self.log_test("Unauthenticated Auth Me", False, f"Error: {str(e)}")
            return False

    def test_providers_list(self):
        """Test providers list endpoint (public)"""
        try:
            response = requests.get(
                f"{self.base_url}/api/providers",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                providers = data if isinstance(data, list) else data.get('providers', [])
                self.log_test("Get Providers List", True, f"Found {len(providers)} providers")
                return True
            else:
                self.log_test("Get Providers List", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Providers List", False, f"Error: {str(e)}")
            return False

    def test_provider_profile(self, provider_id="1"):
        """Test getting a specific provider profile"""
        try:
            response = requests.get(
                f"{self.base_url}/api/providers/{provider_id}",
                timeout=10
            )
            
            passed = response.status_code == 200
            if passed:
                data = response.json()
                self.log_test(f"Get Provider Profile ({provider_id})", True, f"Provider: {data.get('name', 'N/A')}")
            else:
                self.log_test(f"Get Provider Profile ({provider_id})", False, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test(f"Get Provider Profile ({provider_id})", False, f"Error: {str(e)}")
            return False

    def test_client_bookings(self):
        """Test getting client bookings"""
        if "client" not in self.tokens:
            self.log_test("Get Client Bookings", False, "No client token available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/api/bookings",
                headers={"Authorization": f"Bearer {self.tokens['client']}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                bookings = data if isinstance(data, list) else data.get('bookings', [])
                self.log_test("Get Client Bookings", True, f"Found {len(bookings)} bookings")
                return True
            else:
                self.log_test("Get Client Bookings", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Client Bookings", False, f"Error: {str(e)}")
            return False

    def test_provider_bookings(self):
        """Test getting provider bookings"""
        if "provider" not in self.tokens:
            self.log_test("Get Provider Bookings", False, "No provider token available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/api/bookings",
                headers={"Authorization": f"Bearer {self.tokens['provider']}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                bookings = data if isinstance(data, list) else data.get('bookings', [])
                self.log_test("Get Provider Bookings", True, f"Found {len(bookings)} bookings")
                return True
            else:
                self.log_test("Get Provider Bookings", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Provider Bookings", False, f"Error: {str(e)}")
            return False

    def test_notifications(self, role):
        """Test getting notifications"""
        if role not in self.tokens:
            self.log_test(f"Get Notifications ({role})", False, f"No {role} token available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/api/notifications",
                headers={"Authorization": f"Bearer {self.tokens[role]}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                notifications = data if isinstance(data, list) else data.get('notifications', [])
                self.log_test(f"Get Notifications ({role})", True, f"Found {len(notifications)} notifications")
                return True
            else:
                self.log_test(f"Get Notifications ({role})", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test(f"Get Notifications ({role})", False, f"Error: {str(e)}")
            return False

    def test_provider_services(self):
        """Test getting provider services"""
        if "provider" not in self.tokens:
            self.log_test("Get Provider Services", False, "No provider token available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/api/providers/me/services",
                headers={"Authorization": f"Bearer {self.tokens['provider']}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                services = data if isinstance(data, list) else data.get('services', [])
                self.log_test("Get Provider Services", True, f"Found {len(services)} services")
                return True
            else:
                self.log_test("Get Provider Services", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Provider Services", False, f"Error: {str(e)}")
            return False

    def test_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_email = f"test_client_{timestamp}@test.com"
        
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/register",
                json={
                    "email": test_email,
                    "password": "TestPass123!",
                    "name": "Test Client",
                    "role": "client"
                },
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                self.log_test("User Registration", True, f"Registered {test_email}")
                return True
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}, Body: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")
            return False

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print(f"TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print("="*60)

def main():
    print("="*60)
    print("OnCall Foot API Testing Suite")
    print("Testing via: https://build-resume-40.preview.emergentagent.com")
    print("="*60 + "\n")
    
    tester = OnCallFootAPITester()
    
    # Test 1: Health check
    print("\n--- Basic Health Check ---")
    tester.test_health()
    
    # Test 2: Unauthenticated access
    print("\n--- Unauthenticated Access ---")
    tester.test_unauthenticated_me()
    
    # Test 3: Login flows
    print("\n--- Authentication Tests ---")
    tester.test_login("jane@oncallfoot.com", "demo1234", "client")
    tester.test_login("sarah@oncallfoot.com", "demo1234", "provider")
    tester.test_login("admin@oncallfoot.com", "demo1234", "admin")
    
    # Test 4: Auth me endpoints
    print("\n--- Auth Me Tests ---")
    tester.test_auth_me("client")
    tester.test_auth_me("provider")
    tester.test_auth_me("admin")
    
    # Test 5: Public endpoints
    print("\n--- Public Endpoints ---")
    tester.test_providers_list()
    tester.test_provider_profile("1")
    
    # Test 6: Client endpoints
    print("\n--- Client Endpoints ---")
    tester.test_client_bookings()
    tester.test_notifications("client")
    
    # Test 7: Provider endpoints
    print("\n--- Provider Endpoints ---")
    tester.test_provider_bookings()
    tester.test_provider_services()
    tester.test_notifications("provider")
    
    # Test 8: Registration
    print("\n--- Registration Test ---")
    tester.test_registration()
    
    # Print summary
    tester.print_summary()
    
    # Return exit code
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
