"""Backend tests for Foot-Care Marketplace OS.

Covers providers, availability, bookings (create + status + list),
provider self-management (earnings, availability), admin (queue,
status transitions, listing toggle, revenue).
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ["EXPO_PUBLIC_BACKEND_URL"]
# fallback for backend-only env: read from frontend .env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Providers ---------------------------------------------------------------
class TestProviders:
    def test_list_providers_sorted(self, s):
        r = s.get(f"{API}/providers")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        # Only approved+active
        for p in data:
            assert p["status"] == "approved"
            assert p["listing_active"] is True
        # premium first
        assert data[0]["plan"] == "premium"
        assert data[0]["id"] == "prov_maya"

    def test_filter_city(self, s):
        r = s.get(f"{API}/providers", params={"city": "Oakland"})
        assert r.status_code == 200
        d = r.json()
        assert all(p["city"] == "Oakland" for p in d)
        assert any(p["id"] == "prov_jordan" for p in d)

    def test_filter_category_senior_verified(self, s):
        r = s.get(f"{API}/providers", params={"category": "senior-care", "senior_friendly": "true", "verified": "true"})
        assert r.status_code == 200
        for p in r.json():
            assert p["senior_friendly"] is True
            assert p["verified"] is True
            assert "senior-care" in p["categories"]

    def test_filter_min_rating_and_q(self, s):
        r = s.get(f"{API}/providers", params={"min_rating": 4.8, "q": "reflex"})
        assert r.status_code == 200
        d = r.json()
        assert any(p["id"] == "prov_maya" for p in d)

    def test_get_provider(self, s):
        r = s.get(f"{API}/providers/prov_maya")
        assert r.status_code == 200
        p = r.json()
        assert p["id"] == "prov_maya"
        assert "weekly_hours" in p and "blocked_dates" in p and "minimum_lead_hours" in p and "travel_zone" in p

    def test_get_provider_404(self, s):
        r = s.get(f"{API}/providers/nope_xxx")
        assert r.status_code == 404

    def test_provider_services(self, s):
        r = s.get(f"{API}/providers/prov_maya/services")
        assert r.status_code == 200
        d = r.json()
        assert len(d) == 3
        ids = {x["id"] for x in d}
        assert {"svc_maya_reflex", "svc_maya_senior", "svc_maya_signature"} <= ids


# --- Availability ------------------------------------------------------------
class TestAvailability:
    def test_availability_shape(self, s):
        r = s.get(f"{API}/providers/prov_maya/availability", params={"days": 14})
        assert r.status_code == 200
        d = r.json()
        assert d["provider_id"] == "prov_maya"
        assert d["minimum_lead_hours"] == 4
        assert len(d["slots"]) == 14
        # Sundays empty (weekly_hours sun=[])
        for date_iso, slots in d["slots"].items():
            wd = datetime.fromisoformat(date_iso).weekday()
            if wd == 6:  # Sunday
                assert slots == []

    def test_availability_excludes_past_lead(self, s):
        r = s.get(f"{API}/providers/prov_maya/availability")
        d = r.json()
        earliest = datetime.now(timezone.utc) + timedelta(hours=4)
        for _, slots in d["slots"].items():
            for iso in slots:
                assert datetime.fromisoformat(iso) >= earliest - timedelta(minutes=1)

    def test_availability_404(self, s):
        r = s.get(f"{API}/providers/unknown/availability")
        assert r.status_code == 404


# --- Bookings ----------------------------------------------------------------
def _find_open_slot(s, provider_id="prov_maya"):
    d = s.get(f"{API}/providers/{provider_id}/availability", params={"days": 14}).json()
    for _, slots in d["slots"].items():
        if slots:
            return slots[0]
    return None


class TestBookings:
    booking_id = None
    slot = None

    def test_create_booking_success(self, s):
        slot = _find_open_slot(s)
        assert slot, "No open slot available"
        TestBookings.slot = slot
        payload = {
            "client_name": "TEST_User",
            "client_email": "test_user@example.com",
            "provider_id": "prov_maya",
            "service_id": "svc_maya_reflex",
            "start_time": slot,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "requested"
        # Commission math: gmv=12000, rate=0.12 -> fee=1440, net=10560
        assert b["gmv_cents"] == 12000
        assert b["commission_rate"] == 0.12
        assert b["platform_fee_cents"] == round(12000 * 0.12)
        assert b["provider_net_cents"] == 12000 - b["platform_fee_cents"]
        TestBookings.booking_id = b["id"]

    def test_create_booking_double_book(self, s):
        payload = {
            "client_name": "TEST_Dup",
            "client_email": "dup@example.com",
            "provider_id": "prov_maya",
            "service_id": "svc_maya_reflex",
            "start_time": TestBookings.slot,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 409

    def test_create_booking_unknown_provider(self, s):
        r = s.post(f"{API}/bookings", json={
            "client_name": "x", "client_email": "x@e.com",
            "provider_id": "none", "service_id": "svc_maya_reflex",
            "start_time": TestBookings.slot,
        })
        assert r.status_code == 404

    def test_create_booking_non_approved(self, s):
        r = s.post(f"{API}/bookings", json={
            "client_name": "x", "client_email": "x@e.com",
            "provider_id": "prov_sana", "service_id": "svc_maya_reflex",
            "start_time": TestBookings.slot,
        })
        assert r.status_code == 400

    def test_create_booking_bad_time(self, s):
        r = s.post(f"{API}/bookings", json={
            "client_name": "x", "client_email": "x@e.com",
            "provider_id": "prov_maya", "service_id": "svc_maya_reflex",
            "start_time": "not-a-date",
        })
        assert r.status_code == 400

    def test_create_booking_too_soon(self, s):
        soon = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        r = s.post(f"{API}/bookings", json={
            "client_name": "x", "client_email": "x@e.com",
            "provider_id": "prov_maya", "service_id": "svc_maya_reflex",
            "start_time": soon,
        })
        assert r.status_code == 400

    def test_create_booking_outside_window(self, s):
        # Maya's Sunday is closed; find next Sunday 12:00 UTC that's > 4h away
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # pick a Sunday
        days_ahead = (6 - now.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        sun = (now + timedelta(days=days_ahead)).replace(hour=12)
        r = s.post(f"{API}/bookings", json={
            "client_name": "x", "client_email": "x@e.com",
            "provider_id": "prov_maya", "service_id": "svc_maya_reflex",
            "start_time": sun.isoformat(),
        })
        assert r.status_code == 400

    def test_list_bookings_filters_and_enrichment(self, s):
        r = s.get(f"{API}/bookings", params={"client_email": "test_user@example.com"})
        assert r.status_code == 200
        d = r.json()
        assert any(b["id"] == TestBookings.booking_id for b in d)
        b = [x for x in d if x["id"] == TestBookings.booking_id][0]
        assert b["provider"]["name"] == "Maya Okonkwo"
        assert b["service"]["title"] == "Reflexology Deep Session"

    def test_update_booking_status(self, s):
        r = s.patch(f"{API}/bookings/{TestBookings.booking_id}/status", json={"status": "accepted"})
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"
        # verify persisted
        r2 = s.get(f"{API}/bookings", params={"client_email": "test_user@example.com"})
        b = [x for x in r2.json() if x["id"] == TestBookings.booking_id][0]
        assert b["status"] == "accepted"

    def test_update_booking_status_404(self, s):
        r = s.patch(f"{API}/bookings/nope/status", json={"status": "accepted"})
        assert r.status_code == 404


# --- Provider self-management ------------------------------------------------
class TestProviderMgmt:
    def test_earnings(self, s):
        r = s.get(f"{API}/provider/prov_maya/earnings")
        assert r.status_code == 200
        t = r.json()["totals"]
        assert t["completed_count"] >= 3
        assert t["gmv_cents"] > 0
        assert t["platform_fee_cents"] > 0
        assert t["provider_net_cents"] == t["gmv_cents"] - t["platform_fee_cents"]

    def test_availability_update_persists(self, s):
        payload = {"weekly_hours": {"mon": [8, 17], "tue": [9, 17], "wed": [9, 17], "thu": [9, 19], "fri": [9, 19], "sat": [10, 15], "sun": []}, "minimum_lead_hours": 4}
        r = s.patch(f"{API}/provider/prov_maya/availability", json=payload)
        assert r.status_code == 200
        assert r.json()["weekly_hours"]["mon"] == [8, 17]
        # verify GET reflects
        p = s.get(f"{API}/providers/prov_maya").json()
        assert p["weekly_hours"]["mon"] == [8, 17]


# --- Admin -------------------------------------------------------------------
class TestAdmin:
    def test_pending_queue(self, s):
        r = s.get(f"{API}/admin/providers", params={"status": "pending"})
        assert r.status_code == 200
        d = r.json()
        ids = {p["id"] for p in d}
        assert {"prov_sana", "prov_tomas"} <= ids
        for p in d:
            assert isinstance(p.get("documents"), list)

    def test_toggle_listing(self, s):
        r = s.patch(f"{API}/admin/providers/prov_jordan/listing-active", json={"listing_active": False})
        assert r.status_code == 200 and r.json()["listing_active"] is False
        r = s.patch(f"{API}/admin/providers/prov_jordan/listing-active", json={"listing_active": True})
        assert r.status_code == 200 and r.json()["listing_active"] is True

    def test_approve_pending(self, s):
        # Approve tomas (won't affect other tests much). Use rejected->approved cycle for idempotency.
        r = s.patch(f"{API}/admin/providers/prov_tomas/status", json={"status": "approved"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "approved" and d["listing_active"] is True and d["verified"] is True
        # Reset to pending for other iterations (best effort using rejected path won't restore pending; do direct via reject then approve is fine)
        # We'll leave as approved; seed re-runs only on empty DB.

    def test_admin_revenue_weekly(self, s):
        r = s.get(f"{API}/admin/revenue", params={"window": "weekly"})
        assert r.status_code == 200
        d = r.json()
        assert d["window"] == "weekly"
        assert len(d["series"]) == 8
        t = d["totals"]
        for k in ["gmv_cents", "platform_fee_cents", "completed_bookings", "total_bookings", "requested_bookings", "active_providers", "pending_providers"]:
            assert k in t

    def test_admin_revenue_daily(self, s):
        r = s.get(f"{API}/admin/revenue", params={"window": "daily"})
        assert r.status_code == 200
        assert len(r.json()["series"]) == 14
