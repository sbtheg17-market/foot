#!/usr/bin/env python3
"""
Backend API tests for OnCall Foot marketplace client booking lifecycle.
Tests duplicate protection, cancellation flow, and review rules.
"""

import requests
import sys
from datetime import datetime, timedelta
import json
import time

BASE_URL = "http://localhost:8002/api"

class BookingLifecycleTest:
    def __init__(self):
        self.jane_token = None
        self.tom_token = None
        self.sarah_token = None
        self.provider_id = None
        self.service_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, passed, message=""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ PASS: {test_name}")
            self.test_results.append({"test": test_name, "status": "PASS", "message": message})
        else:
            print(f"❌ FAIL: {test_name} - {message}")
            self.test_results.append({"test": test_name, "status": "FAIL", "message": message})

    def login(self, email, password="demo1234"):
        """Login and return token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                return response.json().get("token")
            else:
                print(f"Login failed for {email}: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Login error for {email}: {e}")
            return None

    def setup(self):
        """Setup test users and get provider/service IDs"""
        print("\n🔧 Setting up test environment...")
        
        # Login all users
        self.jane_token = self.login("jane@oncallfoot.com")
        self.tom_token = self.login("tom@oncallfoot.com")
        self.sarah_token = self.login("sarah@oncallfoot.com")
        
        if not all([self.jane_token, self.tom_token, self.sarah_token]):
            print("❌ Failed to login all test users")
            return False
        
        print("✅ All users logged in successfully")
        
        # Get provider profile
        try:
            response = requests.get(
                f"{BASE_URL}/providers/me",
                headers={"Authorization": f"Bearer {self.sarah_token}"},
                timeout=10
            )
            if response.status_code == 200:
                self.provider_id = response.json()["provider"]["id"]
                print(f"✅ Provider ID: {self.provider_id}")
            else:
                print(f"❌ Failed to get provider profile: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting provider profile: {e}")
            return False
        
        # Get service ID
        try:
            response = requests.get(
                f"{BASE_URL}/providers/{self.provider_id}/services",
                headers={"Authorization": f"Bearer {self.sarah_token}"},
                timeout=10
            )
            if response.status_code == 200:
                services = response.json()["services"]
                if services:
                    self.service_id = services[0]["id"]
                    print(f"✅ Service ID: {self.service_id}")
                else:
                    print("❌ No services found")
                    return False
            else:
                print(f"❌ Failed to get services: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting services: {e}")
            return False
        
        return True

    def create_booking(self, scheduled_at, token=None, address="123 Test St", city="Toronto"):
        """Create a booking"""
        if token is None:
            token = self.jane_token
        
        payload = {
            "providerId": self.provider_id,
            "serviceId": self.service_id,
            "scheduledAt": scheduled_at,
            "address": address,
            "city": city,
            "postalCode": "M5V 1A1"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/bookings",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15
            )
            return response
        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout creating booking")
            return None
        except Exception as e:
            print(f"⚠️  Error creating booking: {e}")
            return None

    def update_booking_status(self, booking_id, status, token, cancellation_reason=None):
        """Update booking status"""
        payload = {"status": status}
        if cancellation_reason:
            payload["cancellationReason"] = cancellation_reason
        
        try:
            response = requests.patch(
                f"{BASE_URL}/bookings/{booking_id}/status",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15
            )
            return response
        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout updating booking {booking_id} to {status}")
            return None
        except Exception as e:
            print(f"⚠️  Error updating booking status: {e}")
            return None

    def create_review(self, booking_id, rating, comment, token=None):
        """Create a review"""
        if token is None:
            token = self.jane_token
        
        payload = {
            "bookingId": booking_id,
            "rating": rating,
            "comment": comment
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/reviews",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15
            )
            return response
        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout creating review for booking {booking_id}")
            return None
        except Exception as e:
            print(f"⚠️  Error creating review: {e}")
            return None

    def test_duplicate_booking_protection(self):
        """Test that duplicate bookings are rejected with 409"""
        print("\n📋 Testing duplicate booking protection...")
        
        # Use a unique future time
        scheduled_at = (datetime.now() + timedelta(days=100, hours=5)).isoformat()
        
        # Create first booking
        response1 = self.create_booking(scheduled_at)
        if not response1 or response1.status_code != 201:
            self.log_result(
                "Duplicate protection - first booking creation",
                False,
                f"Expected 201, got {response1.status_code if response1 else 'None'}"
            )
            return None
        
        booking_id = response1.json()["booking"]["id"]
        self.log_result("Duplicate protection - first booking creation", True)
        
        # Try to create duplicate
        time.sleep(0.5)  # Small delay to avoid race conditions
        response2 = self.create_booking(scheduled_at)
        if response2 and response2.status_code == 409:
            data = response2.json()
            if "bookingId" in data and data["bookingId"] == booking_id:
                self.log_result(
                    "Duplicate protection - reject duplicate with 409",
                    True,
                    f"Correctly returned 409 with bookingId {booking_id}"
                )
            else:
                self.log_result(
                    "Duplicate protection - reject duplicate with 409",
                    False,
                    "409 returned but bookingId missing or incorrect"
                )
        else:
            self.log_result(
                "Duplicate protection - reject duplicate with 409",
                False,
                f"Expected 409, got {response2.status_code if response2 else 'None'}"
            )
        
        # Test different time works
        different_time = (datetime.now() + timedelta(days=101, hours=5)).isoformat()
        response3 = self.create_booking(different_time)
        self.log_result(
            "Duplicate protection - different time allowed",
            response3 and response3.status_code == 201,
            f"Got {response3.status_code if response3 else 'None'}"
        )
        
        return booking_id

    def test_cancellation_flow(self):
        """Test cancellation requires reason and prevents double-cancel"""
        print("\n📋 Testing cancellation flow...")
        
        # Create a booking
        scheduled_at = (datetime.now() + timedelta(days=102, hours=5)).isoformat()
        response = self.create_booking(scheduled_at)
        if not response or response.status_code != 201:
            self.log_result("Cancellation - create test booking", False, "Failed to create booking")
            return
        
        booking_id = response.json()["booking"]["id"]
        self.log_result("Cancellation - create test booking", True)
        
        # Try to cancel without reason
        time.sleep(0.5)
        response = self.update_booking_status(booking_id, "cancelled", self.jane_token)
        self.log_result(
            "Cancellation - reject without reason (400)",
            response and response.status_code == 400,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Cancel with reason
        response = self.update_booking_status(
            booking_id, "cancelled", self.jane_token, "Test cancellation"
        )
        self.log_result(
            "Cancellation - accept with reason (200)",
            response and response.status_code == 200,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Try to cancel again
        time.sleep(0.5)
        response = self.update_booking_status(
            booking_id, "cancelled", self.jane_token, "Second cancel"
        )
        self.log_result(
            "Cancellation - reject double-cancel (409)",
            response and response.status_code == 409,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Test re-requesting same slot after cancel
        response = self.create_booking(scheduled_at)
        self.log_result(
            "Cancellation - allow re-request after cancel",
            response and response.status_code == 201,
            f"Got {response.status_code if response else 'None'}"
        )

    def test_foreign_client_isolation(self):
        """Test that one client cannot cancel another's booking"""
        print("\n📋 Testing foreign client isolation...")
        
        # Jane creates a booking
        scheduled_at = (datetime.now() + timedelta(days=103, hours=5)).isoformat()
        response = self.create_booking(scheduled_at, self.jane_token)
        if not response or response.status_code != 201:
            self.log_result("Foreign client - create Jane's booking", False, "Failed to create")
            return
        
        booking_id = response.json()["booking"]["id"]
        self.log_result("Foreign client - create Jane's booking", True)
        
        # Tom tries to cancel Jane's booking
        time.sleep(0.5)
        response = self.update_booking_status(
            booking_id, "cancelled", self.tom_token, "Not my booking"
        )
        self.log_result(
            "Foreign client - reject Tom cancelling Jane's booking (403/404)",
            response and response.status_code in [403, 404],
            f"Got {response.status_code if response else 'None'}"
        )

    def test_review_rules(self):
        """Test one review per completed booking"""
        print("\n📋 Testing review rules...")
        
        # Create and complete a booking
        scheduled_at = (datetime.now() + timedelta(days=104, hours=5)).isoformat()
        response = self.create_booking(scheduled_at)
        if not response or response.status_code != 201:
            self.log_result("Review - create booking", False, "Failed to create")
            return
        
        booking_id = response.json()["booking"]["id"]
        self.log_result("Review - create booking", True)
        
        # Provider confirms
        response = self.update_booking_status(booking_id, "confirmed", self.sarah_token)
        self.log_result(
            "Review - provider confirms",
            response and response.status_code == 200,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Provider completes
        response = self.update_booking_status(booking_id, "completed", self.sarah_token)
        self.log_result(
            "Review - provider completes",
            response and response.status_code == 200,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Client submits review
        response = self.create_review(booking_id, 5, "Great service!")
        self.log_result(
            "Review - first review accepted (201)",
            response and response.status_code == 201,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Try duplicate review
        time.sleep(0.5)
        response = self.create_review(booking_id, 4, "Trying again")
        self.log_result(
            "Review - duplicate rejected (409)",
            response and response.status_code == 409,
            f"Got {response.status_code if response else 'None'}"
        )
        
        # Test review on non-completed booking
        scheduled_at2 = (datetime.now() + timedelta(days=105, hours=5)).isoformat()
        response = self.create_booking(scheduled_at2)
        if response and response.status_code == 201:
            booking_id2 = response.json()["booking"]["id"]
            response = self.create_review(booking_id2, 5, "Too early")
            self.log_result(
                "Review - reject on non-completed booking (400/409)",
                response and response.status_code in [400, 409, 422],
                f"Got {response.status_code if response else 'None'}"
            )

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("🧪 OnCall Foot Backend API Tests - Client Booking Lifecycle")
        print("=" * 60)
        
        if not self.setup():
            print("\n❌ Setup failed, cannot continue")
            return False
        
        self.test_duplicate_booking_protection()
        self.test_cancellation_flow()
        self.test_foreign_client_isolation()
        self.test_review_rules()
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        print("=" * 60)
        
        return self.tests_passed == self.tests_run

def main():
    tester = BookingLifecycleTest()
    success = tester.run_all_tests()
    
    # Save results
    with open("/app/backend_test_results.json", "w") as f:
        json.dump({
            "total": tester.tests_run,
            "passed": tester.tests_passed,
            "failed": tester.tests_run - tester.tests_passed,
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
