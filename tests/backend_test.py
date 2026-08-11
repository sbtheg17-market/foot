#!/usr/bin/env python3
"""
Backend API tests for OnCall Foot Client Booking Lifecycle
Tests duplicate-submit protection, cancellation logic, and review constraints
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

BASE_URL = "http://localhost:8081/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class BookingTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.jane_token = None
        self.tom_token = None
        self.sarah_token = None
        self.test_results = []

    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"{Colors.GREEN}✓{Colors.END} {name}")
            if details:
                print(f"  {details}")
        else:
            self.tests_failed += 1
            print(f"{Colors.RED}✗{Colors.END} {name}")
            if details:
                print(f"  {Colors.RED}{details}{Colors.END}")
        
        self.test_results.append({
            "test": name,
            "passed": passed,
            "details": details
        })

    def login(self, email: str, password: str) -> Optional[str]:
        """Login and return token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                return response.json()["token"]
            else:
                print(f"{Colors.RED}Login failed for {email}: {response.status_code}{Colors.END}")
                return None
        except Exception as e:
            print(f"{Colors.RED}Login error for {email}: {str(e)}{Colors.END}")
            return None

    def setup_auth(self) -> bool:
        """Setup authentication tokens for all test users"""
        print(f"\n{Colors.BLUE}=== Setting up authentication ==={Colors.END}")
        
        self.jane_token = self.login("jane@oncallfoot.com", "demo1234")
        self.tom_token = self.login("tom@oncallfoot.com", "demo1234")
        self.sarah_token = self.login("sarah@oncallfoot.com", "demo1234")
        
        if not all([self.jane_token, self.tom_token, self.sarah_token]):
            print(f"{Colors.RED}Failed to authenticate all users{Colors.END}")
            return False
        
        print(f"{Colors.GREEN}✓ All users authenticated{Colors.END}")
        return True

    def create_booking(self, token: str, provider_id: int, service_id: int, 
                      scheduled_at: str, address: str, city: str) -> tuple[int, Dict[str, Any]]:
        """Create a booking and return (status_code, response_json)"""
        try:
            response = requests.post(
                f"{BASE_URL}/bookings",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "providerId": provider_id,
                    "serviceId": service_id,
                    "scheduledAt": scheduled_at,
                    "address": address,
                    "city": city
                },
                timeout=10
            )
            return response.status_code, response.json()
        except Exception as e:
            return 0, {"error": str(e)}

    def update_booking_status(self, token: str, booking_id: int, 
                             status: str, cancellation_reason: Optional[str] = None) -> tuple[int, Dict[str, Any]]:
        """Update booking status and return (status_code, response_json)"""
        try:
            data = {"status": status}
            if cancellation_reason:
                data["cancellationReason"] = cancellation_reason
            
            response = requests.patch(
                f"{BASE_URL}/bookings/{booking_id}/status",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json=data,
                timeout=10
            )
            return response.status_code, response.json()
        except Exception as e:
            return 0, {"error": str(e)}

    def create_review(self, token: str, booking_id: int, rating: int, comment: str) -> tuple[int, Dict[str, Any]]:
        """Create a review and return (status_code, response_json)"""
        try:
            response = requests.post(
                f"{BASE_URL}/reviews",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                json={
                    "bookingId": booking_id,
                    "rating": rating,
                    "comment": comment
                },
                timeout=10
            )
            return response.status_code, response.json()
        except Exception as e:
            return 0, {"error": str(e)}

    def test_duplicate_booking_protection(self):
        """Test that duplicate bookings return 409"""
        print(f"\n{Colors.BLUE}=== Test: Duplicate Booking Protection ==={Colors.END}")
        
        # Use a far-future unique timestamp to avoid collisions
        future_time = datetime.now() + timedelta(days=30, hours=10, minutes=15)
        scheduled_at = future_time.isoformat()
        
        # First booking should succeed (201)
        status1, resp1 = self.create_booking(
            self.jane_token, 1, 1, scheduled_at, 
            "123 Test St", "Toronto"
        )
        
        if status1 == 201 and "booking" in resp1:
            booking_id = resp1["booking"]["id"]
            self.log_test(
                "First booking creation returns 201",
                True,
                f"Booking ID: {booking_id}"
            )
        else:
            self.log_test(
                "First booking creation returns 201",
                False,
                f"Expected 201, got {status1}: {resp1}"
            )
            return None
        
        # Second identical booking should fail (409)
        status2, resp2 = self.create_booking(
            self.jane_token, 1, 1, scheduled_at,
            "123 Test St", "Toronto"
        )
        
        if status2 == 409:
            if "bookingId" in resp2 and resp2["bookingId"] == booking_id:
                self.log_test(
                    "Duplicate booking returns 409 with original bookingId",
                    True,
                    f"Returned bookingId: {resp2['bookingId']}"
                )
            else:
                self.log_test(
                    "Duplicate booking returns 409 with original bookingId",
                    False,
                    f"Missing or wrong bookingId in response: {resp2}"
                )
        else:
            self.log_test(
                "Duplicate booking returns 409",
                False,
                f"Expected 409, got {status2}: {resp2}"
            )
        
        return booking_id

    def test_different_scheduled_at_allowed(self):
        """Test that different scheduledAt returns 201 (no false positives)"""
        print(f"\n{Colors.BLUE}=== Test: Different scheduledAt Allowed ==={Colors.END}")
        
        # Two different times should both succeed
        time1 = (datetime.now() + timedelta(days=31, hours=10)).isoformat()
        time2 = (datetime.now() + timedelta(days=31, hours=14)).isoformat()
        
        status1, resp1 = self.create_booking(
            self.jane_token, 1, 1, time1,
            "456 Test Ave", "Toronto"
        )
        
        status2, resp2 = self.create_booking(
            self.jane_token, 1, 1, time2,
            "456 Test Ave", "Toronto"
        )
        
        if status1 == 201 and status2 == 201:
            self.log_test(
                "Different scheduledAt times both return 201",
                True,
                f"Booking IDs: {resp1.get('booking', {}).get('id')}, {resp2.get('booking', {}).get('id')}"
            )
        else:
            self.log_test(
                "Different scheduledAt times both return 201",
                False,
                f"Status codes: {status1}, {status2}"
            )

    def test_different_client_same_slot(self):
        """Test that different client can book the same slot (201)"""
        print(f"\n{Colors.BLUE}=== Test: Different Client Same Slot ==={Colors.END}")
        
        # Use a unique far-future time
        scheduled_at = (datetime.now() + timedelta(days=32, hours=15)).isoformat()
        
        # Jane books first
        status1, resp1 = self.create_booking(
            self.jane_token, 1, 1, scheduled_at,
            "789 Test Blvd", "Toronto"
        )
        
        # Tom books the same slot - should succeed
        status2, resp2 = self.create_booking(
            self.tom_token, 1, 1, scheduled_at,
            "321 Test Lane", "Toronto"
        )
        
        if status1 == 201 and status2 == 201:
            self.log_test(
                "Different client booking same slot returns 201",
                True,
                f"Jane's booking: {resp1.get('booking', {}).get('id')}, Tom's booking: {resp2.get('booking', {}).get('id')}"
            )
        else:
            self.log_test(
                "Different client booking same slot returns 201",
                False,
                f"Jane: {status1}, Tom: {status2}"
            )

    def test_cancellation_logic(self):
        """Test cancellation requires cancellationReason and prevents duplicates"""
        print(f"\n{Colors.BLUE}=== Test: Cancellation Logic ==={Colors.END}")
        
        # Create a booking to cancel
        scheduled_at = (datetime.now() + timedelta(days=33, hours=10)).isoformat()
        status, resp = self.create_booking(
            self.jane_token, 1, 1, scheduled_at,
            "111 Cancel St", "Toronto"
        )
        
        if status != 201:
            self.log_test(
                "Setup: Create booking for cancellation test",
                False,
                f"Failed to create booking: {status}"
            )
            return
        
        booking_id = resp["booking"]["id"]
        self.log_test(
            "Setup: Create booking for cancellation test",
            True,
            f"Booking ID: {booking_id}"
        )
        
        # Try to cancel WITHOUT cancellationReason - should fail (400)
        status1, resp1 = self.update_booking_status(
            self.jane_token, booking_id, "cancelled", None
        )
        
        if status1 == 400:
            self.log_test(
                "Cancel without cancellationReason returns 400",
                True,
                f"Error: {resp1.get('error', '')}"
            )
        else:
            self.log_test(
                "Cancel without cancellationReason returns 400",
                False,
                f"Expected 400, got {status1}: {resp1}"
            )
        
        # Cancel WITH cancellationReason - should succeed (200)
        status2, resp2 = self.update_booking_status(
            self.jane_token, booking_id, "cancelled", "Test cancellation"
        )
        
        if status2 == 200:
            self.log_test(
                "Cancel with cancellationReason returns 200",
                True,
                f"Booking {booking_id} cancelled"
            )
        else:
            self.log_test(
                "Cancel with cancellationReason returns 200",
                False,
                f"Expected 200, got {status2}: {resp2}"
            )
        
        # Try to cancel again - should fail (409)
        status3, resp3 = self.update_booking_status(
            self.jane_token, booking_id, "cancelled", "Second cancel attempt"
        )
        
        if status3 == 409:
            self.log_test(
                "Repeat cancel returns 409",
                True,
                f"Error: {resp3.get('error', '')}"
            )
        else:
            self.log_test(
                "Repeat cancel returns 409",
                False,
                f"Expected 409, got {status3}: {resp3}"
            )
        
        # After cancellation, same client can re-book the identical slot (201)
        status4, resp4 = self.create_booking(
            self.jane_token, 1, 1, scheduled_at,
            "111 Cancel St", "Toronto"
        )
        
        if status4 == 201:
            self.log_test(
                "Re-booking same slot after cancellation returns 201",
                True,
                f"New booking ID: {resp4.get('booking', {}).get('id')}"
            )
        else:
            self.log_test(
                "Re-booking same slot after cancellation returns 201",
                False,
                f"Expected 201, got {status4}: {resp4}"
            )

    def test_one_review_per_booking(self):
        """Test that only one review per completed booking is allowed"""
        print(f"\n{Colors.BLUE}=== Test: One Review Per Completed Booking ==={Colors.END}")
        
        # Create a booking
        scheduled_at = (datetime.now() + timedelta(days=34, hours=10)).isoformat()
        status, resp = self.create_booking(
            self.jane_token, 1, 1, scheduled_at,
            "222 Review St", "Toronto"
        )
        
        if status != 201:
            self.log_test(
                "Setup: Create booking for review test",
                False,
                f"Failed to create booking: {status}"
            )
            return
        
        booking_id = resp["booking"]["id"]
        self.log_test(
            "Setup: Create booking for review test",
            True,
            f"Booking ID: {booking_id}"
        )
        
        # Provider confirms the booking
        status1, resp1 = self.update_booking_status(
            self.sarah_token, booking_id, "confirmed"
        )
        
        if status1 == 200:
            self.log_test(
                "Provider confirms booking",
                True,
                f"Booking {booking_id} confirmed"
            )
        else:
            self.log_test(
                "Provider confirms booking",
                False,
                f"Expected 200, got {status1}: {resp1}"
            )
            return
        
        # Provider completes the booking
        status2, resp2 = self.update_booking_status(
            self.sarah_token, booking_id, "completed"
        )
        
        if status2 == 200:
            self.log_test(
                "Provider completes booking",
                True,
                f"Booking {booking_id} completed"
            )
        else:
            self.log_test(
                "Provider completes booking",
                False,
                f"Expected 200, got {status2}: {resp2}"
            )
            return
        
        # Client posts first review - should succeed (201)
        status3, resp3 = self.create_review(
            self.jane_token, booking_id, 5, "Great service!"
        )
        
        if status3 == 201:
            self.log_test(
                "First review returns 201",
                True,
                f"Review ID: {resp3.get('review', {}).get('id')}"
            )
        else:
            self.log_test(
                "First review returns 201",
                False,
                f"Expected 201, got {status3}: {resp3}"
            )
        
        # Client posts second review - should fail (409)
        status4, resp4 = self.create_review(
            self.jane_token, booking_id, 4, "Another review"
        )
        
        if status4 == 409:
            self.log_test(
                "Duplicate review returns 409",
                True,
                f"Error: {resp4.get('error', '')}"
            )
        else:
            self.log_test(
                "Duplicate review returns 409",
                False,
                f"Expected 409, got {status4}: {resp4}"
            )

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
        print(f"{Colors.BLUE}OnCall Foot Backend API Tests{Colors.END}")
        print(f"{Colors.BLUE}{'='*60}{Colors.END}")
        
        if not self.setup_auth():
            print(f"\n{Colors.RED}Authentication setup failed. Cannot proceed with tests.{Colors.END}")
            return False
        
        # Run all test suites
        self.test_duplicate_booking_protection()
        self.test_different_scheduled_at_allowed()
        self.test_different_client_same_slot()
        self.test_cancellation_logic()
        self.test_one_review_per_booking()
        
        # Print summary
        print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
        print(f"{Colors.BLUE}Test Summary{Colors.END}")
        print(f"{Colors.BLUE}{'='*60}{Colors.END}")
        print(f"Total tests: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.END}")
        if self.tests_failed > 0:
            print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.END}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        return self.tests_failed == 0

def main():
    tester = BookingTester()
    success = tester.run_all_tests()
    
    # Save results to JSON
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed": tester.tests_passed,
        "failed": tester.tests_failed,
        "success_rate": f"{(tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0:.1f}%",
        "test_results": tester.test_results
    }
    
    with open("/app/tests/backend_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{Colors.BLUE}Results saved to /app/tests/backend_test_results.json{Colors.END}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
