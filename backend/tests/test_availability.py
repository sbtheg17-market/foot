"""Availability + travel zone tests (Checkpoint 3)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-hub-95.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _unique_email():
    return f"TEST_avail_{uuid.uuid4().hex[:10]}@example.com"


def _new_provider_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _unique_email()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST Avail"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def provider():
    return _new_provider_session()


class TestAvailabilityDefaults:
    def test_get_returns_defaults_for_new_provider(self, provider):
        r = provider.get(f"{API}/availability")
        assert r.status_code == 200
        d = r.json()
        assert set(d["weekly"].keys()) == {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
        for day, slots in d["weekly"].items():
            assert slots == []
        assert d["travel"]["mode"] == "radius"
        assert d["travel"]["radius_km"] == 0
        assert d["travel"]["pincodes"] == []


class TestWeeklyUpdate:
    def test_set_weekly_slots(self, provider):
        payload = {
            "weekly": {
                "mon": [{"start": "09:00", "end": "17:00"}],
                "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [],
            }
        }
        r = provider.put(f"{API}/availability", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["weekly"]["mon"] == [{"start": "09:00", "end": "17:00"}]

    def test_reject_end_before_start(self, provider):
        payload = {
            "weekly": {
                "mon": [{"start": "17:00", "end": "09:00"}],
                "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [],
            }
        }
        r = provider.put(f"{API}/availability", json=payload)
        assert r.status_code == 422

    def test_reject_malformed_time(self, provider):
        payload = {
            "weekly": {
                "mon": [{"start": "9AM", "end": "5PM"}],
                "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [],
            }
        }
        r = provider.put(f"{API}/availability", json=payload)
        assert r.status_code == 422


class TestTravelZone:
    def test_set_radius(self, provider):
        r = provider.put(f"{API}/availability", json={
            "travel": {"mode": "radius", "radius_km": 25, "home_address": "Downtown", "pincodes": []}
        })
        assert r.status_code == 200
        t = r.json()["travel"]
        assert t["mode"] == "radius" and t["radius_km"] == 25

    def test_set_pincodes(self, provider):
        r = provider.put(f"{API}/availability", json={
            "travel": {"mode": "pincodes", "radius_km": 0, "home_address": "HQ", "pincodes": ["94103", "94110", ""]}
        })
        assert r.status_code == 200
        t = r.json()["travel"]
        # blank pincode stripped
        assert t["pincodes"] == ["94103", "94110"]


class TestSummaryIntegration:
    def test_summary_reflects_completion(self, provider):
        s0 = provider.get(f"{API}/dashboard/provider-summary").json()
        assert s0["has_availability"] is False
        assert s0["has_travel_zone"] is False
        assert "profile_completion" in s0
        pc0 = s0["profile_completion"]
        assert pc0["total"] == 6
        assert pc0["percent"] < 100
        assert any(m["key"] == "availability" for m in pc0["missing"])
        assert any(m["key"] == "travel" for m in pc0["missing"])

        provider.put(f"{API}/availability", json={
            "weekly": {
                "mon": [{"start": "09:00", "end": "17:00"}],
                "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [],
            },
            "travel": {"mode": "radius", "radius_km": 20, "home_address": "X", "pincodes": []},
        })
        s1 = provider.get(f"{API}/dashboard/provider-summary").json()
        assert s1["has_availability"] is True
        assert s1["has_travel_zone"] is True
        assert s1["profile_completion"]["done"] >= pc0["done"] + 2

    def test_unauth_401(self):
        assert requests.get(f"{API}/availability").status_code == 401
        assert requests.put(f"{API}/availability", json={}).status_code == 401


class TestVerificationDefault:
    def test_me_has_verification_status(self, provider):
        me = provider.get(f"{API}/auth/me").json()
        assert me.get("verification_status") == "draft"
