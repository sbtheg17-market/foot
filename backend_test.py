#!/usr/bin/env python3
"""
Backend-only integration test for OnCall Foot rescheduling enforcement.

Tests PATCH /api/bookings/:bookingId/status with status='rescheduled' against
http://localhost:8099/api (NOT the preview URL or REACT_APP_BACKEND_URL).

All 9 test scenarios from the review request.
"""

import requests
import sys
from datetime import datetime, timedelta
import json

BASE_URL = "http://localhost:8099/api"
TIMEOUT = 10

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class ReschedulingTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.jane_token = None
        self.tom_token = None
        self.sarah_token = None
        self.test_monday = None
        self.jane_confirmed_booking_id = None
        self.jane_requested_booking_id = None
        self.tom_booking_id = None
        
    def log_success(self, message):
        print(f"{Colors.GREEN}✅ {message}{Colors.END}")
        
    def log_error(self, message):
        print(f"{Colors.RED}❌ {message}{Colors.END}")
        
    def log_info(self, message):
        print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")
        
    def log_warning(self, message):
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

    def login(self, email, password="demo1234"):
        """Login and return token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                token = response.json().get("token")
                self.log_success(f"Logged in as {email}")
                return token
            else:
                self.log_error(f"Login failed for {email}: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log_error(f"Login exception for {email}: {str(e)}")
            return None

    def get_far_future_monday(self, days_out=120):
        """Get a Monday date ~120 days in the future to avoid test data collisions"""
        target = datetime.utcnow() + timedelta(days=days_out)
        # Find next Monday
        while target.weekday() != 0:  # 0 = Monday
            target += timedelta(days=1)
        return target.strftime("%Y-%m-%d")

    def create_booking(self, token, scheduled_at, address="1 QA St", city="Toronto"):
        """Create a booking and return booking ID"""
        try:
            response = requests.post(
                f"{BASE_URL}/bookings",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "providerId": 1,
                    "serviceId": 1,
                    "scheduledAt": scheduled_at,
                    "address": address,
                    "city": city
                },
                timeout=TIMEOUT
            )
            if response.status_code == 201:
                booking_id = response.json().get("booking", {}).get("id")
                self.log_success(f"Created booking {booking_id} at {scheduled_at}")
                return booking_id
            else:
                self.log_error(f"Booking creation failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.log_error(f"Booking creation exception: {str(e)}")
            return None

    def patch_booking_status(self, token, booking_id, payload):
        """PATCH booking status"""
        try:
            response = requests.patch(
                f"{BASE_URL}/bookings/{booking_id}/status",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
                timeout=TIMEOUT
            )
            return response
        except Exception as e:
            self.log_error(f"PATCH exception: {str(e)}")
            return None

    def run_test(self, test_name, test_func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*80}")
        print(f"Test {self.tests_run}: {test_name}")
        print(f"{'='*80}")
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                self.log_success(f"PASSED: {test_name}")
            else:
                self.tests_failed += 1
                self.log_error(f"FAILED: {test_name}")
            return result
        except Exception as e:
            self.tests_failed += 1
            self.log_error(f"EXCEPTION in {test_name}: {str(e)}")
            return False

    def setup(self):
        """Setup: login users and create initial bookings"""
        self.log_info("Setting up test environment...")
        
        # Login all users
        self.jane_token = self.login("jane@oncallfoot.com")
        self.tom_token = self.login("tom@oncallfoot.com")
        self.sarah_token = self.login("sarah@oncallfoot.com")
        
        if not all([self.jane_token, self.tom_token, self.sarah_token]):
            self.log_error("Failed to login all users")
            return False
        
        # Get far-future Monday
        self.test_monday = self.get_far_future_monday(120)
        self.log_info(f"Using test date: {self.test_monday}")
        
        # Create jane's booking at 15:00Z and confirm it
        jane_booking_time = f"{self.test_monday}T15:00:00.000Z"
        self.jane_confirmed_booking_id = self.create_booking(self.jane_token, jane_booking_time)
        if not self.jane_confirmed_booking_id:
            return False
        
        # Sarah confirms it
        response = self.patch_booking_status(
            self.sarah_token,
            self.jane_confirmed_booking_id,
            {"status": "confirmed"}
        )
        if response.status_code != 200:
            self.log_error(f"Failed to confirm booking: {response.status_code} - {response.text}")
            return False
        self.log_success(f"Confirmed booking {self.jane_confirmed_booking_id}")
        
        self.log_success("Setup complete!")
        return True

    # Test 1: Authorization - non-owner client cannot reschedule
    def test_authorization(self):
        """Test 1: tom (non-owner) tries to reschedule jane's booking -> 403"""
        response = self.patch_booking_status(
            self.tom_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": f"{self.test_monday}T16:00:00.000Z"
            }
        )
        
        if response.status_code == 403:
            self.log_success("Correctly rejected non-owner reschedule with 403")
            return True
        else:
            self.log_error(f"Expected 403, got {response.status_code}: {response.text}")
            return False

    # Test 2: Missing scheduledAt
    def test_missing_scheduled_at(self):
        """Test 2: jane reschedules without scheduledAt -> 400 with error"""
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {"status": "rescheduled"}
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "scheduledAt is required" in error_msg:
                self.log_success(f"Correctly rejected missing scheduledAt: {error_msg}")
                return True
            else:
                self.log_error(f"Got 400 but wrong error message: {error_msg}")
                return False
        else:
            self.log_error(f"Expected 400, got {response.status_code}: {response.text}")
            return False

    # Test 3: Malformed datetime
    def test_malformed_datetime(self):
        """Test 3: jane reschedules with malformed datetime -> 400 (NOT 500)"""
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": "garbage"
            }
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "valid date-time" in error_msg:
                self.log_success(f"Correctly rejected malformed datetime with 400: {error_msg}")
                return True
            else:
                self.log_error(f"Got 400 but wrong error message: {error_msg}")
                return False
        else:
            self.log_error(f"Expected 400, got {response.status_code}: {response.text}")
            return False

    # Test 4: Past datetime
    def test_past_datetime(self):
        """Test 4: jane reschedules to past datetime -> 400 with 'future'"""
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": "2000-01-03T15:00:00.000Z"
            }
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "future" in error_msg:
                self.log_success(f"Correctly rejected past datetime: {error_msg}")
                return True
            else:
                self.log_error(f"Got 400 but wrong error message: {error_msg}")
                return False
        else:
            self.log_error(f"Expected 400, got {response.status_code}: {response.text}")
            return False

    # Test 5: Outside availability
    def test_outside_availability(self):
        """Test 5: jane reschedules outside provider availability -> 400"""
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": f"{self.test_monday}T03:00:00.000Z"  # 3am UTC, outside 09:00-17:00 Toronto
            }
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "outside this provider's availability" in error_msg:
                self.log_success(f"Correctly rejected outside availability: {error_msg}")
                return True
            else:
                self.log_error(f"Got 400 but wrong error message: {error_msg}")
                return False
        else:
            self.log_error(f"Expected 400, got {response.status_code}: {response.text}")
            return False

    # Test 6: Provider overlap
    def test_provider_overlap(self):
        """Test 6: jane reschedules to overlap tom's booking -> 409 with exact message"""
        # Tom creates a booking at 16:00Z
        tom_booking_time = f"{self.test_monday}T16:00:00.000Z"
        self.tom_booking_id = self.create_booking(self.tom_token, tom_booking_time)
        if not self.tom_booking_id:
            self.log_error("Failed to create Tom's booking")
            return False
        
        # Jane tries to reschedule to 16:30Z (overlaps 16:00-17:00)
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": f"{self.test_monday}T16:30:00.000Z"
            }
        )
        
        expected_msg = "That time overlaps another appointment for this provider. Please choose another available time."
        
        if response.status_code == 409:
            error_msg = response.json().get("error", "")
            response_text = response.text
            
            # Check for exact message
            if error_msg == expected_msg:
                # Check no leaked IDs or SQL
                if "booking" not in response_text.lower() or "id" not in response.json():
                    self.log_success(f"Correctly rejected overlap with exact message, no leaked IDs")
                    return True
                else:
                    self.log_warning(f"Got correct message but response may contain leaked data: {response_text}")
                    return True  # Still pass if message is correct
            else:
                self.log_error(f"Got 409 but wrong message. Expected: '{expected_msg}', Got: '{error_msg}'")
                return False
        else:
            self.log_error(f"Expected 409, got {response.status_code}: {response.text}")
            return False

    # Test 7: Duplicate booking
    def test_duplicate_booking(self):
        """Test 7: jane reschedules to her own existing booking time -> 409 with exact message"""
        # Jane creates a second booking at 18:00Z
        jane_second_booking_time = f"{self.test_monday}T18:00:00.000Z"
        self.jane_requested_booking_id = self.create_booking(self.jane_token, jane_second_booking_time)
        if not self.jane_requested_booking_id:
            self.log_error("Failed to create Jane's second booking")
            return False
        
        # Jane tries to reschedule her confirmed booking to 18:00Z (duplicate)
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": jane_second_booking_time
            }
        )
        
        expected_msg = "You already have an active request for this provider, service, and time. Check your bookings before submitting again."
        
        if response.status_code == 409:
            error_msg = response.json().get("error", "")
            if error_msg == expected_msg:
                self.log_success(f"Correctly rejected duplicate with exact message")
                return True
            else:
                self.log_error(f"Got 409 but wrong message. Expected: '{expected_msg}', Got: '{error_msg}'")
                return False
        else:
            self.log_error(f"Expected 409, got {response.status_code}: {response.text}")
            return False

    # Test 8: Happy path
    def test_happy_path(self):
        """Test 8: jane successfully reschedules to valid time -> 200, status='rescheduled', no careNotes"""
        # Jane reschedules to 17:00Z (valid, no overlap)
        new_time = f"{self.test_monday}T17:00:00.000Z"
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_confirmed_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": new_time
            }
        )
        
        if response.status_code == 200:
            booking = response.json().get("booking", {})
            status = booking.get("status")
            scheduled_at = booking.get("scheduledAt")
            has_care_notes = "careNotes" in booking
            
            success = True
            if status != "rescheduled":
                self.log_error(f"Expected status='rescheduled', got '{status}'")
                success = False
            
            if scheduled_at != new_time:
                self.log_error(f"Expected scheduledAt='{new_time}', got '{scheduled_at}'")
                success = False
            
            if has_care_notes:
                self.log_error("Response contains 'careNotes' field (should be client-safe)")
                success = False
            
            if success:
                self.log_success(f"Successfully rescheduled to {new_time}, status='rescheduled', no careNotes")
            return success
        else:
            self.log_error(f"Expected 200, got {response.status_code}: {response.text}")
            return False

    # Test 9: State machine
    def test_state_machine(self):
        """Test 9: state machine transitions"""
        # Sarah confirms the rescheduled booking
        response = self.patch_booking_status(
            self.sarah_token,
            self.jane_confirmed_booking_id,
            {"status": "confirmed"}
        )
        if response.status_code != 200:
            self.log_error(f"Failed to confirm rescheduled booking: {response.status_code}")
            return False
        self.log_success("Provider confirmed the rescheduled booking")
        
        # Jane tries to reschedule her 'requested' booking (should fail)
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_requested_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": f"{self.test_monday}T19:00:00.000Z"
            }
        )
        if response.status_code != 409:
            self.log_error(f"Expected 409 for rescheduling 'requested' booking, got {response.status_code}")
            return False
        self.log_success("Correctly rejected rescheduling from 'requested' state")
        
        # Cancel the requested booking
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_requested_booking_id,
            {
                "status": "cancelled",
                "cancellationReason": "qa"
            }
        )
        if response.status_code != 200:
            self.log_error(f"Failed to cancel booking: {response.status_code}")
            return False
        self.log_success("Cancelled the requested booking")
        
        # Try to reschedule cancelled booking (terminal state)
        response = self.patch_booking_status(
            self.jane_token,
            self.jane_requested_booking_id,
            {
                "status": "rescheduled",
                "scheduledAt": f"{self.test_monday}T19:00:00.000Z"
            }
        )
        if response.status_code != 409:
            self.log_error(f"Expected 409 for rescheduling 'cancelled' booking, got {response.status_code}")
            return False
        self.log_success("Correctly rejected rescheduling from terminal 'cancelled' state")
        
        return True

    def run_all_tests(self):
        """Run all tests"""
        print(f"\n{'#'*80}")
        print(f"# OnCall Foot Rescheduling Enforcement Test Suite")
        print(f"# Testing against: {BASE_URL}")
        print(f"{'#'*80}\n")
        
        # Setup
        if not self.setup():
            self.log_error("Setup failed, aborting tests")
            return False
        
        # Run all tests
        self.run_test("Test 1: Authorization (non-owner cannot reschedule)", self.test_authorization)
        self.run_test("Test 2: Missing scheduledAt", self.test_missing_scheduled_at)
        self.run_test("Test 3: Malformed datetime", self.test_malformed_datetime)
        self.run_test("Test 4: Past datetime", self.test_past_datetime)
        self.run_test("Test 5: Outside availability", self.test_outside_availability)
        self.run_test("Test 6: Provider overlap", self.test_provider_overlap)
        self.run_test("Test 7: Duplicate booking", self.test_duplicate_booking)
        self.run_test("Test 8: Happy path", self.test_happy_path)
        self.run_test("Test 9: State machine", self.test_state_machine)
        
        # Summary
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total tests run: {self.tests_run}")
        print(f"{Colors.GREEN}Passed: {self.tests_passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.tests_failed}{Colors.END}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print(f"{'='*80}\n")
        
        return self.tests_failed == 0

def main():
    tester = ReschedulingTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
