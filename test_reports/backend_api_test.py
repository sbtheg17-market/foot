#!/usr/bin/env python3
"""
Backend API test for OnCall Foot Race Notice (Task 2)
Tests the duplicate booking 409 response contract.
"""
import requests
import sys
from datetime import datetime, timezone

class BookingAPITester:
    def __init__(self, base_url="http://localhost:8099"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ Passed - Status: {response.status_code}")
            else:
                self.log(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")

            try:
                response_json = response.json()
            except Exception:
                response_json = {}

            return success, response_json, response.status_code

        except Exception as e:
            self.log(f"❌ Failed - Error: {str(e)}")
            return False, {}, 0

    def test_login(self, email, password):
        """Test login and get token"""
        self.log(f"Logging in as {email}...")
        success, response, status = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"✅ Login successful, token obtained")
            return True
        self.log(f"❌ Login failed")
        return False

    def test_create_booking(self, provider_id, service_id, scheduled_at, address, city):
        """Create a booking"""
        self.log(f"Creating booking for provider {provider_id}, service {service_id} at {scheduled_at}...")
        success, response, status = self.run_test(
            "Create Booking",
            "POST",
            "/api/bookings",
            201,
            data={
                "providerId": provider_id,
                "serviceId": service_id,
                "scheduledAt": scheduled_at,
                "address": address,
                "city": city
            }
        )
        if success and 'booking' in response:
            booking_id = response['booking'].get('id')
            self.log(f"✅ Booking created successfully, ID: {booking_id}")
            return booking_id
        return None

    def test_duplicate_booking_409(self, provider_id, service_id, scheduled_at, address, city):
        """Test duplicate booking returns 409 with correct contract"""
        self.log(f"Testing duplicate booking (expecting 409)...")
        success, response, status = self.run_test(
            "Duplicate Booking (409 Expected)",
            "POST",
            "/api/bookings",
            409,
            data={
                "providerId": provider_id,
                "serviceId": service_id,
                "scheduledAt": scheduled_at,
                "address": address,
                "city": city
            }
        )
        
        if not success:
            self.log(f"❌ Expected 409, got {status}")
            return False
        
        # Verify response structure
        self.log("Verifying 409 response contract...")
        
        # Check for numeric bookingId
        if 'bookingId' not in response:
            self.log(f"❌ Missing 'bookingId' in response")
            return False
        
        if not isinstance(response['bookingId'], int):
            self.log(f"❌ bookingId is not numeric: {type(response['bookingId'])}")
            return False
        
        self.log(f"✅ bookingId is numeric: {response['bookingId']}")
        
        # Check for error message
        if 'error' not in response:
            self.log(f"❌ Missing 'error' in response")
            return False
        
        error_msg = response['error']
        self.log(f"Error message: '{error_msg}'")
        
        # Check for PostgreSQL internals (should NOT be present)
        postgres_keywords = ['23505', 'duplicate key', 'bookings_active_booking_unique_idx', 'constraint', 'SQLSTATE']
        found_internals = [kw for kw in postgres_keywords if kw.lower() in error_msg.lower()]
        
        if found_internals:
            self.log(f"❌ PostgreSQL internals found in error message: {found_internals}")
            return False
        
        self.log(f"✅ No PostgreSQL internals in error message")
        
        return True

def main():
    tester = BookingAPITester("http://localhost:8099")
    
    # Test credentials
    client_email = "jane@oncallfoot.com"
    client_password = "demo1234"
    
    # Test data - using a unique future datetime
    provider_id = 1  # Sarah
    service_id = 1   # Assuming service 1 exists
    scheduled_at = "2026-09-25T15:00:00Z"  # Unique future datetime
    address = "99 Test Ave"
    city = "Toronto"
    
    print("\n" + "="*60)
    print("OnCall Foot - Race Notice API Test (Task 2)")
    print("="*60 + "\n")
    
    # Step 1: Login
    if not tester.test_login(client_email, client_password):
        tester.log("❌ Login failed, cannot proceed")
        return 1
    
    print()
    
    # Step 2: Create first booking (should succeed)
    booking_id = tester.test_create_booking(provider_id, service_id, scheduled_at, address, city)
    if not booking_id:
        tester.log("❌ First booking creation failed, cannot test duplicate")
        return 1
    
    print()
    
    # Step 3: Try to create duplicate booking (should return 409)
    if not tester.test_duplicate_booking_409(provider_id, service_id, scheduled_at, address, city):
        tester.log("❌ Duplicate booking 409 test failed")
        return 1
    
    # Print summary
    print("\n" + "="*60)
    print(f"📊 API Tests Summary: {tester.tests_passed}/{tester.tests_run} passed")
    print("="*60 + "\n")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
