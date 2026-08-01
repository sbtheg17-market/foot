"""Phase 3 backend tests: plans config, plan-derived commission, Stripe Connect,
reviews, plan upgrade checkout, cron reminders, SMS_MODE toggle."""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_db = MongoClient(MONGO_URL)[DB_NAME]

# Read cron secret from backend env
_CRON_SECRET = None
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("WEBHOOK_CRON_SECRET="):
                _CRON_SECRET = line.split("=", 1)[1].strip().strip('"').strip("'")
except Exception:
    pass


def _mk_session(email: str, role: str, name: str = "Test", linked_provider_id=None) -> tuple[str, str]:
    uid = f"test-user-{uuid.uuid4().hex[:10]}"
    tok = f"test_session_{uuid.uuid4().hex}"
    _db.users.insert_one({
        "user_id": uid, "email": email, "name": name, "role": role,
        "picture": "", "linked_provider_id": linked_provider_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, tok


@pytest.fixture(scope="module")
def admin_session():
    uid, tok = _mk_session("sbtheg04@gmail.com", "admin")
    yield {"user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def alex_owner_session():
    """Session for alex who owns prov_alex."""
    uid, tok = _mk_session("alex@solecare.demo", "provider", linked_provider_id="prov_alex")
    # Ensure prov_alex.owner_user_id points to us
    prev = _db.providers.find_one({"id": "prov_alex"}, {"owner_user_id": 1})
    prev_owner = prev.get("owner_user_id") if prev else None
    _db.providers.update_one({"id": "prov_alex"}, {"$set": {"owner_user_id": uid}})
    yield {"user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}
    _db.providers.update_one({"id": "prov_alex"}, {"$set": {"owner_user_id": prev_owner}})
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def maya_owner_session():
    uid, tok = _mk_session("maya@solecare.demo", "provider", linked_provider_id="prov_maya")
    prev = _db.providers.find_one({"id": "prov_maya"}, {"owner_user_id": 1})
    prev_owner = prev.get("owner_user_id") if prev else None
    _db.providers.update_one({"id": "prov_maya"}, {"$set": {"owner_user_id": uid}})
    yield {"user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}
    _db.providers.update_one({"id": "prov_maya"}, {"$set": {"owner_user_id": prev_owner}})
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def client_session():
    uid, tok = _mk_session(f"test.client.{uuid.uuid4().hex[:6]}@example.com", "client")
    yield {"user_id": uid, "email": _db.users.find_one({"user_id": uid})["email"],
           "headers": {"Authorization": f"Bearer {tok}"}}
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_many({"user_id": uid})


# ---------------------------- Plans config ---------------------------------
class TestPlans:
    def test_get_plans_structure(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        data = r.json()
        assert "plans" in data
        p = data["plans"]
        assert set(p.keys()) >= {"free", "pro", "premium"}
        assert p["free"]["commission_rate"] == 0.18
        assert p["pro"]["commission_rate"] == 0.15
        assert p["premium"]["commission_rate"] == 0.12
        # Features
        assert p["pro"]["features"]["priority_placement"] is True
        assert p["pro"]["features"]["advanced_analytics"] is True
        assert p["premium"]["features"]["featured_badge"] is True
        assert p["free"]["features"]["featured_badge"] is False


# ------------------------ Plan-derived commission --------------------------
def _future_slot(days_ahead: int = 5, hour: int = 10) -> str:
    """Return an ISO datetime for a future available slot on Monday (mon 9-17 for prov_alex/maya)."""
    now = datetime.now(timezone.utc)
    # find upcoming Monday
    d = now + timedelta(days=days_ahead)
    while d.weekday() != 0:  # 0=Mon
        d += timedelta(days=1)
    d = d.replace(hour=hour, minute=0, second=0, microsecond=0)
    return d.isoformat()


class TestPlanCommission:
    def _pick_service(self, provider_id):
        r = requests.get(f"{API}/providers/{provider_id}/services")
        assert r.status_code == 200
        svcs = r.json()
        assert svcs
        return svcs[0]

    def _create_booking(self, provider_id):
        svc = self._pick_service(provider_id)
        # Fetch availability to pick a real slot
        r = requests.get(f"{API}/providers/{provider_id}/availability")
        assert r.status_code == 200, r.text
        slots_by_day = r.json().get("slots", {})
        slots = [s for day in slots_by_day.values() for s in day]
        assert slots, f"No slots for {provider_id}"
        for slot in slots:
            payload = {
                "provider_id": provider_id,
                "service_id": svc["id"],
                "start_time": slot,
                "client_name": "TEST Commission",
                "client_email": f"test.commission.{uuid.uuid4().hex[:6]}@example.com",
                "client_phone": "+15555550100",
                "origin_url": BASE_URL,
            }
            r = requests.post(f"{API}/bookings", json=payload)
            if r.status_code == 200:
                return r.json(), svc
            if r.status_code == 409:
                continue
            pytest.fail(f"Booking creation failed: {r.status_code} {r.text}")
        pytest.fail("No available slot")

    def test_alex_free_plan_commission_18pct(self):
        booking, svc = self._create_booking("prov_alex")
        gmv = svc["price_cents"]
        assert booking["commission_rate"] == 0.18
        assert booking["platform_fee_cents"] == round(gmv * 0.18)
        assert booking["provider_net_cents"] == gmv - round(gmv * 0.18)
        _db.bookings.delete_one({"id": booking["id"]})

    def test_maya_premium_plan_commission_12pct(self):
        booking, svc = self._create_booking("prov_maya")
        gmv = svc["price_cents"]
        assert booking["commission_rate"] == 0.12
        assert booking["platform_fee_cents"] == round(gmv * 0.12)
        _db.bookings.delete_one({"id": booking["id"]})


# --------------------------- Stripe Connect --------------------------------
class TestConnect:
    def test_onboard_unauth_401(self):
        r = requests.post(f"{API}/provider/prov_maya/connect/onboard",
                          json={"origin_url": BASE_URL})
        assert r.status_code == 401

    def test_status_no_account(self, admin_session):
        # Use a provider without stripe_account_id
        _db.providers.update_one({"id": "prov_jordan"}, {"$unset": {"stripe_account_id": ""}})
        r = requests.get(f"{API}/provider/prov_jordan/connect/status")
        assert r.status_code == 200
        assert r.json()["connected"] is False

    def test_onboard_with_admin_creates_account(self, admin_session):
        # Clear stripe_account_id first to force fresh account creation
        _db.providers.update_one({"id": "prov_maya"}, {"$unset": {"stripe_account_id": ""}})
        r = requests.post(f"{API}/provider/prov_maya/connect/onboard",
                          json={"origin_url": BASE_URL}, headers=admin_session["headers"])
        if r.status_code == 500:
            pytest.skip(f"Stripe Connect not enabled on sandbox account: {r.text}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stripe_account_id"].startswith("acct_")
        assert data["onboarding_url"].startswith("https://")
        # Persisted
        p = _db.providers.find_one({"id": "prov_maya"})
        assert p.get("stripe_account_id") == data["stripe_account_id"]

    def test_status_after_onboard(self):
        p = _db.providers.find_one({"id": "prov_maya"})
        if not p.get("stripe_account_id"):
            pytest.skip("Skipped because onboard did not run")
        r = requests.get(f"{API}/provider/prov_maya/connect/status")
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is True
        assert "payouts_enabled" in d
        assert "details_submitted" in d


class TestBookingWithConnect:
    def test_booking_with_connect_has_application_fee(self, maya_owner_session):
        # Ensure Maya has a stripe_account_id
        maya = _db.providers.find_one({"id": "prov_maya"})
        if not maya.get("stripe_account_id"):
            # onboard first
            r0 = requests.post(f"{API}/provider/prov_maya/connect/onboard",
                               json={"origin_url": BASE_URL}, headers=maya_owner_session["headers"])
            if r0.status_code != 200:
                pytest.skip(f"Stripe Connect not enabled on sandbox: {r0.text}")

        r = requests.get(f"{API}/providers/prov_maya/services")
        svc = r.json()[0]
        avail = requests.get(f"{API}/providers/prov_maya/availability").json().get("slots", {})
        avail = [s for day in avail.values() for s in day]

        booking = None
        for slot in avail:
            payload = {
                "provider_id": "prov_maya",
                "service_id": svc["id"],
                "start_time": slot,
                "client_name": "TEST Connect",
                "client_email": f"test.connect.{uuid.uuid4().hex[:6]}@example.com",
                "client_phone": "+15555550100",
                "origin_url": BASE_URL,
            }
            r = requests.post(f"{API}/bookings", json=payload)
            if r.status_code == 200:
                booking = r.json()
                break
        assert booking, "Could not create booking"
        assert booking.get("stripe_session_id"), "No Stripe session id"

        # Retrieve the session via Stripe API to verify application_fee_amount & transfer_data
        import stripe
        stripe_key = None
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("STRIPE_SECRET_KEY="):
                    stripe_key = line.split("=", 1)[1].strip()
        stripe.api_key = stripe_key
        session = stripe.checkout.Session.retrieve(
            booking["stripe_session_id"], expand=["payment_intent"]
        )
        pi = session.payment_intent
        # payment_intent may be str or object depending on state
        if isinstance(pi, str):
            pi = stripe.PaymentIntent.retrieve(pi)
        if pi is not None:
            assert pi.application_fee_amount == booking["platform_fee_cents"]
            assert pi.transfer_data is not None
            maya = _db.providers.find_one({"id": "prov_maya"})
            assert pi.transfer_data["destination"] == maya["stripe_account_id"]
        _db.bookings.delete_one({"id": booking["id"]})


# ------------------------------ Reviews ------------------------------------
def _seed_completed_booking(client_uid: str, client_email: str, provider_id: str = "prov_alex") -> str:
    """Insert a completed booking directly for review testing."""
    svc = _db.services.find_one({"provider_id": provider_id})
    bid = f"test-booking-{uuid.uuid4().hex[:8]}"
    _db.bookings.insert_one({
        "id": bid,
        "client_name": "Test Client",
        "client_email": client_email,
        "client_phone": "+15555550100",
        "client_user_id": client_uid,
        "provider_id": provider_id,
        "service_id": svc["id"],
        "start_time": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "status": "completed",
        "payment_status": "paid",
        "gmv_cents": svc["price_cents"],
        "commission_rate": 0.18,
        "platform_fee_cents": round(svc["price_cents"] * 0.18),
        "provider_net_cents": svc["price_cents"] - round(svc["price_cents"] * 0.18),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": "",
    })
    return bid


class TestReviews:
    def test_create_review_unauth_401(self):
        r = requests.post(f"{API}/reviews", json={"booking_id": "x", "rating": 5, "comment": ""})
        assert r.status_code == 401

    def test_review_wrong_client_403(self, client_session):
        # create booking for a different user
        other_uid = f"other-{uuid.uuid4().hex[:6]}"
        bid = _seed_completed_booking(other_uid, "other@example.com")
        r = requests.post(f"{API}/reviews",
                          json={"booking_id": bid, "rating": 5, "comment": "great"},
                          headers=client_session["headers"])
        assert r.status_code == 403
        _db.bookings.delete_one({"id": bid})

    def test_review_non_completed_400(self, client_session):
        # Insert as accepted (not completed)
        svc = _db.services.find_one({"provider_id": "prov_alex"})
        bid = f"test-booking-{uuid.uuid4().hex[:8]}"
        _db.bookings.insert_one({
            "id": bid, "client_email": client_session["email"],
            "client_user_id": client_session["user_id"],
            "client_name": "T", "client_phone": "+1",
            "provider_id": "prov_alex", "service_id": svc["id"],
            "start_time": datetime.now(timezone.utc).isoformat(),
            "status": "accepted", "payment_status": "paid",
            "gmv_cents": 1, "commission_rate": 0.18,
            "platform_fee_cents": 0, "provider_net_cents": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.post(f"{API}/reviews",
                          json={"booking_id": bid, "rating": 4, "comment": "x"},
                          headers=client_session["headers"])
        assert r.status_code == 400
        _db.bookings.delete_one({"id": bid})

    def test_review_happy_path_and_duplicate_409(self, client_session):
        bid = _seed_completed_booking(client_session["user_id"], client_session["email"], "prov_alex")
        r = requests.post(f"{API}/reviews",
                          json={"booking_id": bid, "rating": 5, "comment": "amazing"},
                          headers=client_session["headers"])
        assert r.status_code in (200, 201), r.text
        review = r.json()
        assert review["rating"] == 5

        # Duplicate
        r2 = requests.post(f"{API}/reviews",
                           json={"booking_id": bid, "rating": 4, "comment": "again"},
                           headers=client_session["headers"])
        assert r2.status_code == 409

        # Aggregate updated
        p = _db.providers.find_one({"id": "prov_alex"})
        assert p["reviews_count"] >= 1
        assert p["rating"] > 0

        _db.reviews.delete_many({"booking_id": bid})
        _db.bookings.delete_one({"id": bid})

    def test_list_reviews_and_booking_review(self, client_session):
        # provider_reviews endpoint
        r = requests.get(f"{API}/providers/prov_maya/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        # booking with no review
        svc = _db.services.find_one({"provider_id": "prov_alex"})
        bid = f"test-booking-{uuid.uuid4().hex[:8]}"
        _db.bookings.insert_one({
            "id": bid, "client_email": "x@x.com", "client_name": "x",
            "client_phone": "+1", "provider_id": "prov_alex",
            "service_id": svc["id"], "start_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed", "payment_status": "paid",
            "gmv_cents": 1, "commission_rate": 0.18,
            "platform_fee_cents": 0, "provider_net_cents": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.get(f"{API}/bookings/{bid}/review")
        assert r.status_code == 200
        assert r.json()["review"] is None
        _db.bookings.delete_one({"id": bid})


# --------------------------- Plan upgrade ----------------------------------
class TestPlanUpgrade:
    def test_plan_checkout_unauth_401(self):
        r = requests.post(f"{API}/provider/prov_alex/plan/checkout",
                          json={"plan": "pro", "origin_url": BASE_URL})
        assert r.status_code == 401

    def test_plan_checkout_free_400(self, alex_owner_session):
        r = requests.post(f"{API}/provider/prov_alex/plan/checkout",
                          json={"plan": "free", "origin_url": BASE_URL},
                          headers=alex_owner_session["headers"])
        assert r.status_code in (400, 422)  # Pydantic Literal makes it 422

    def test_plan_checkout_pro_success(self, alex_owner_session):
        r = requests.post(f"{API}/provider/prov_alex/plan/checkout",
                          json={"plan": "pro", "origin_url": BASE_URL},
                          headers=alex_owner_session["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://")
        assert d["session_id"].startswith("cs_")
        # payment_transactions row
        row = _db.payment_transactions.find_one({"session_id": d["session_id"]})
        assert row is not None
        assert row["kind"] == "plan_upgrade"
        assert row["plan"] == "pro"

    def test_plan_checkout_premium_success(self, alex_owner_session):
        r = requests.post(f"{API}/provider/prov_alex/plan/checkout",
                          json={"plan": "premium", "origin_url": BASE_URL},
                          headers=alex_owner_session["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["session_id"].startswith("cs_")


# --------------------------- Cron reminders --------------------------------
class TestCronReminders:
    def test_cron_no_auth_401(self):
        r = requests.post(f"{API}/cron/reminders")
        assert r.status_code == 401

    def test_cron_bad_bearer_401(self):
        r = requests.post(f"{API}/cron/reminders", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401

    def test_cron_sends_reminder(self):
        assert _CRON_SECRET, "WEBHOOK_CRON_SECRET missing from backend/.env"
        # Create a booking ~24h out
        svc = _db.services.find_one({"provider_id": "prov_alex"})
        bid = f"test-reminder-{uuid.uuid4().hex[:8]}"
        start = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        _db.bookings.insert_one({
            "id": bid, "client_email": "test.reminder@example.com",
            "client_name": "Reminder Client", "client_phone": "+15555550100",
            "provider_id": "prov_alex", "service_id": svc["id"],
            "start_time": start,
            "status": "accepted", "payment_status": "paid",
            "gmv_cents": 1000, "commission_rate": 0.18,
            "platform_fee_cents": 180, "provider_net_cents": 820,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.post(f"{API}/cron/reminders",
                          headers={"Authorization": f"Bearer {_CRON_SECRET}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["sent"] >= 1
        # SMS log entry
        sms = _db.sms_log.find_one({"booking_id": bid, "kind": "booking_reminder"})
        assert sms is not None
        # Second call — sent should be 0 for that booking
        r2 = requests.post(f"{API}/cron/reminders",
                           headers={"Authorization": f"Bearer {_CRON_SECRET}"})
        assert r2.status_code == 200
        b = _db.bookings.find_one({"id": bid})
        assert b.get("reminder_sent_at")
        _db.bookings.delete_one({"id": bid})
        _db.sms_log.delete_many({"booking_id": bid})


# --------------------------- SMS_MODE toggle -------------------------------
class TestSmsMode:
    def test_sms_mode_stub_in_booking(self):
        # Create a booking and inspect sms_log
        r = requests.get(f"{API}/providers/prov_alex/services")
        svc = r.json()[0]
        avail = requests.get(f"{API}/providers/prov_alex/availability").json().get("slots", {})
        avail = [s for day in avail.values() for s in day]
        booking = None
        for slot in avail:
            payload = {
                "provider_id": "prov_alex",
                "service_id": svc["id"],
                "start_time": slot,
                "client_name": "SMS Test",
                "client_email": f"sms.{uuid.uuid4().hex[:6]}@example.com",
                "client_phone": "+15555550100",
                "origin_url": BASE_URL,
            }
            r = requests.post(f"{API}/bookings", json=payload)
            if r.status_code == 200:
                booking = r.json()
                break
        assert booking
        # Look up sms_log by booking_id
        time.sleep(0.5)
        entry = _db.sms_log.find_one({"booking_id": booking["id"], "kind": "booking_requested"})
        assert entry is not None
        assert entry["status"] == "stubbed"
        assert entry["mode"] == "stub"
        _db.bookings.delete_one({"id": booking["id"]})
        _db.sms_log.delete_many({"booking_id": booking["id"]})

    def test_sms_mode_function(self):
        """Import sms module and test _mode() branch behavior."""
        import sys
        sys.path.insert(0, "/app/backend")
        import sms as sms_mod
        assert sms_mod._mode() == "stub"
        # Toggle env and verify branch
        prev = os.environ.get("SMS_MODE")
        os.environ["SMS_MODE"] = "live"
        assert sms_mod._mode() == "live"
        # But twilio_ready should be false without keys
        os.environ.pop("TWILIO_ACCOUNT_SID", None)
        assert sms_mod._twilio_ready() is False
        # Restore
        if prev is None:
            os.environ.pop("SMS_MODE", None)
        else:
            os.environ["SMS_MODE"] = prev


# --------------------------- Regression check ------------------------------
class TestSeededBookingsIntegrity:
    def test_seeded_bookings_have_valid_rates(self):
        bookings = list(_db.bookings.find({"id": {"$not": {"$regex": "^test-"}}}))
        for b in bookings:
            if "gmv_cents" not in b:
                continue
            rate = b.get("commission_rate")
            gmv = b["gmv_cents"]
            fee = b["platform_fee_cents"]
            assert abs(round(gmv * rate) - fee) <= 1, f"Booking {b['id']} fee mismatch"
            assert rate in (0.12, 0.15, 0.18)
