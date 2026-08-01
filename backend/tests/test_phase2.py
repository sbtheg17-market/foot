"""Phase 2 backend tests: auth, roles, opportunities, analytics, provider self-signup,
doc upload, Stripe checkout at booking time, payment status, SMS stub log."""
from __future__ import annotations

import io
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

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _mk_session(email: str, role: str, name: str = "Test", linked_provider_id: str | None = None) -> tuple[str, str]:
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


@pytest.fixture(scope="session")
def admin_session():
    uid, tok = _mk_session("sbtheg04@gmail.com", "admin", "Admin User")
    yield {"user_id": uid, "token": tok, "headers": {"Authorization": f"Bearer {tok}"}}
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="session")
def client_session():
    uid, tok = _mk_session(f"test.client.{uuid.uuid4().hex[:6]}@example.com", "client", "Client User")
    yield {"user_id": uid, "token": tok, "headers": {"Authorization": f"Bearer {tok}"}}
    _db.users.delete_one({"user_id": uid})
    _db.user_sessions.delete_one({"session_token": tok})
    # cleanup any provider created via self-signup
    _db.providers.delete_many({"owner_user_id": uid})


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Auth -------------------------------------------------------------------
class TestAuth:
    def test_me_unauth_401(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer(self, s, admin_session):
        r = requests.get(f"{API}/auth/me", headers=admin_session["headers"])
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == "sbtheg04@gmail.com"
        assert data["user"]["role"] == "admin"
        assert "provider" in data  # may be None

    def test_me_with_cookie(self, admin_session):
        r = requests.get(f"{API}/auth/me", cookies={"session_token": admin_session["token"]})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "sbtheg04@gmail.com"

    def test_session_bad_id(self, s):
        # Should reject fake session id — either 400 (missing) or 401 (verification failed)
        r = s.post(f"{API}/auth/session", json={"session_id": "totally_fake_id_xyz"})
        assert r.status_code in (400, 401)

    def test_session_missing_id(self, s):
        r = s.post(f"{API}/auth/session", json={})
        assert r.status_code == 400

    def test_logout_clears_session(self):
        uid, tok = _mk_session("logout_test@example.com", "client", "Logout")
        r = requests.post(f"{API}/auth/logout", cookies={"session_token": tok})
        assert r.status_code == 200
        # session doc should be gone
        assert _db.user_sessions.find_one({"session_token": tok}) is None
        # follow up: /auth/me should 401
        r2 = requests.get(f"{API}/auth/me", cookies={"session_token": tok})
        assert r2.status_code == 401
        _db.users.delete_one({"user_id": uid})


# --- Roles / admin gating ---------------------------------------------------
class TestRoles:
    def test_admin_endpoint_401_unauth(self, s):
        r = s.get(f"{API}/admin/providers")
        assert r.status_code == 401

    def test_admin_endpoint_403_client(self, client_session):
        r = requests.get(f"{API}/admin/providers", headers=client_session["headers"])
        assert r.status_code == 403

    def test_admin_endpoint_200_admin(self, admin_session):
        r = requests.get(f"{API}/admin/providers", headers=admin_session["headers"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_revenue_admin(self, admin_session):
        r = requests.get(f"{API}/admin/revenue", headers=admin_session["headers"])
        assert r.status_code == 200


# --- Opportunities ----------------------------------------------------------
class TestOpportunities:
    def test_alex_opportunities(self, s):
        r = s.get(f"{API}/provider/prov_alex/opportunities")
        assert r.status_code == 200
        d = r.json()
        assert d["provider_id"] == "prov_alex"
        ids = {op["id"] for op in d["opportunities"]}
        # Berkeley pedicure demand seeded — Alex doesn't offer pedicure, so it's an info card
        assert "cat-pedicure" in ids
        # Alex has no evenings and evening bookings are seeded
        assert "evening-demand" in ids

    def test_maya_opportunities(self, s):
        r = s.get(f"{API}/provider/prov_maya/opportunities")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["opportunities"], list)
        assert len(d["opportunities"]) >= 1

    def test_opportunities_404(self, s):
        r = s.get(f"{API}/provider/nope/opportunities")
        assert r.status_code == 404


# --- Analytics --------------------------------------------------------------
class TestAnalytics:
    def test_search_event_inserts(self, s):
        before = _db.search_events.count_documents({"city": "Berkeley", "category": "pedicure"})
        for _ in range(5):
            r = s.post(f"{API}/analytics/search", json={
                "city": "Berkeley", "category": "pedicure",
                "senior_friendly": False, "verified": True, "q": "test",
            })
            assert r.status_code == 200
            assert r.json()["ok"] is True
        after = _db.search_events.count_documents({"city": "Berkeley", "category": "pedicure"})
        assert after - before == 5


# --- Provider self-signup ---------------------------------------------------
class TestSelfSignup:
    def test_signup_unauth_401(self, s):
        r = s.post(f"{API}/provider/self-signup", json={
            "name": "X", "city": "Berkeley", "categories": ["massage"],
            "travel_zone": {"base_city": "Berkeley", "radius_km": 10},
        })
        assert r.status_code == 401

    def test_signup_client_creates_pending_provider(self, client_session):
        payload = {
            "name": "TEST_Signup Provider",
            "bio": "Testing self-signup",
            "city": "Berkeley",
            "categories": ["massage"],
            "senior_friendly": True,
            "weekly_hours": {"mon": [9, 17]},
            "minimum_lead_hours": 6,
            "travel_zone": {"base_city": "Berkeley", "radius_km": 10},
            "document_paths": [],
        }
        r = requests.post(f"{API}/provider/self-signup", json=payload, headers=client_session["headers"])
        assert r.status_code == 200, r.text
        pid = r.json()["provider_id"]
        assert r.json()["status"] == "pending"
        # verify DB: provider status=pending, listing_active=false, owner_user_id=caller
        prov = _db.providers.find_one({"id": pid}, {"_id": 0})
        assert prov["status"] == "pending"
        assert prov["listing_active"] is False
        assert prov["owner_user_id"] == client_session["user_id"]
        # user is now provider role + linked_provider_id
        u = _db.users.find_one({"user_id": client_session["user_id"]}, {"_id": 0})
        assert u["role"] == "provider"
        assert u["linked_provider_id"] == pid

    def test_signup_second_time_400(self, client_session):
        r = requests.post(f"{API}/provider/self-signup", json={
            "name": "X2", "city": "Berkeley", "categories": ["massage"],
            "travel_zone": {"base_city": "Berkeley", "radius_km": 10},
        }, headers=client_session["headers"])
        assert r.status_code == 400


# --- Doc upload -------------------------------------------------------------
class TestDocUpload:
    def test_upload_unauth_401(self):
        r = requests.post(
            f"{API}/provider/upload-doc",
            files={"file": ("t.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 401

    def test_upload_with_auth(self, admin_session):
        r = requests.post(
            f"{API}/provider/upload-doc",
            files={"file": ("test.txt", b"hello world test doc", "text/plain")},
            headers={"Authorization": f"Bearer {admin_session['token']}"},
        )
        # Emergent storage may or may not be reachable — accept both.
        assert r.status_code in (200, 503), r.text
        if r.status_code == 200:
            d = r.json()
            assert "path" in d and d["size"] == len(b"hello world test doc")
            assert _db.uploaded_docs.find_one({"path": d["path"]}) is not None
        else:
            print(f"Doc upload returned 503 — storage unavailable. Body: {r.text}")


# --- Bookings + Stripe + SMS stub -------------------------------------------
def _find_open_slot(provider_id: str = "prov_maya") -> str | None:
    r = requests.get(f"{API}/providers/{provider_id}/availability", params={"days": 14})
    d = r.json()
    for _, slots in d["slots"].items():
        if slots:
            return slots[0]
    return None


class TestBookingsStripeSMS:
    booking_id: str | None = None
    session_id: str | None = None

    def test_booking_creates_stripe_and_sms(self, s):
        slot = _find_open_slot("prov_maya")
        assert slot
        sms_before = _db.sms_log.count_documents({"kind": "booking_requested"})
        payload = {
            "client_name": "TEST_Phase2",
            "client_email": "test_phase2@example.com",
            "client_phone": "+15551234567",
            "provider_id": "prov_maya",
            "service_id": "svc_maya_reflex",
            "start_time": slot,
            "notes": "",
            "origin_url": BASE_URL,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        # Commission math preserved
        assert b["gmv_cents"] == 12000
        assert b["commission_rate"] == 0.12
        assert b["platform_fee_cents"] == round(12000 * 0.12)
        assert b["provider_net_cents"] == 12000 - b["platform_fee_cents"]
        # Stripe fields
        assert b.get("checkout_url", "").startswith("https://checkout.stripe.com") or b.get("checkout_url", "").startswith("https://")
        assert b["stripe_session_id"]
        TestBookingsStripeSMS.booking_id = b["id"]
        TestBookingsStripeSMS.session_id = b["stripe_session_id"]

        # payment_transactions row
        tx = _db.payment_transactions.find_one({"session_id": b["stripe_session_id"]}, {"_id": 0})
        assert tx is not None
        assert tx["status"] == "initiated"
        assert tx["payment_status"] == "pending"
        assert tx["amount"] == 12000

        # SMS stub log for booking_requested increased by 1
        sms_after = _db.sms_log.count_documents({"kind": "booking_requested"})
        assert sms_after - sms_before == 1
        entry = _db.sms_log.find_one({"booking_id": b["id"], "kind": "booking_requested"}, {"_id": 0})
        assert entry is not None
        assert entry["status"] in ("stubbed", "sent")

    def test_payment_status_returns_pending(self, s):
        assert TestBookingsStripeSMS.session_id
        r = s.get(f"{API}/payments/status/{TestBookingsStripeSMS.session_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["session_id"] == TestBookingsStripeSMS.session_id
        assert d["payment_status"] == "pending"
        assert d["booking"] is not None
        assert d["booking"]["id"] == TestBookingsStripeSMS.booking_id

    def test_payment_status_404(self, s):
        r = s.get(f"{API}/payments/status/cs_nonexistent_xyz")
        assert r.status_code == 404

    def test_status_accepted_fires_sms(self, s):
        assert TestBookingsStripeSMS.booking_id
        sms_before = _db.sms_log.count_documents({"kind": "booking_accepted"})
        r = s.patch(f"{API}/bookings/{TestBookingsStripeSMS.booking_id}/status", json={"status": "accepted"})
        assert r.status_code == 200
        sms_after = _db.sms_log.count_documents({"kind": "booking_accepted"})
        assert sms_after - sms_before == 1
        entry = _db.sms_log.find_one(
            {"booking_id": TestBookingsStripeSMS.booking_id, "kind": "booking_accepted"}, {"_id": 0}
        )
        assert entry is not None
        assert entry["status"] in ("stubbed", "sent")


# --- Post-analytics opportunity reflection ----------------------------------
class TestOpportunitiesReactToSearches:
    def test_opportunities_reflect_new_searches(self, s):
        # Send unique search events for Berkeley pedicure — check that opp cat-pedicure count increases
        before = s.get(f"{API}/provider/prov_maya/opportunities").json()["opportunities"]
        before_map = {o["id"]: o.get("count", 0) for o in before}
        for _ in range(5):
            s.post(f"{API}/analytics/search", json={"city": "San Francisco", "category": "reflexology"})
        after = s.get(f"{API}/provider/prov_maya/opportunities").json()["opportunities"]
        after_map = {o["id"]: o.get("count", 0) for o in after}
        # cat-reflexology should exist and have grown (or appeared)
        assert "cat-reflexology" in after_map
        assert after_map.get("cat-reflexology", 0) >= before_map.get("cat-reflexology", 0) + 5
