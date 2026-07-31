"""Booking state machine + seed tests (Checkpoint 4)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-hub-95.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _unique_email():
    return f"TEST_book_{uuid.uuid4().hex[:10]}@example.com"


def _new_provider_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/register", json={"email": _unique_email(), "password": "test1234", "name": "TEST Booking"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def provider():
    return _new_provider_session()


@pytest.fixture
def seeded_provider():
    s = _new_provider_session()
    r = s.post(f"{API}/dev/seed-bookings")
    assert r.status_code == 200
    return s


class TestSeed:
    def test_seed_creates_bookings(self, provider):
        r = provider.post(f"{API}/dev/seed-bookings")
        assert r.status_code == 200
        assert r.json()["seeded"] >= 12

    def test_seed_is_idempotent(self, provider):
        provider.post(f"{API}/dev/seed-bookings")
        provider.post(f"{API}/dev/seed-bookings")
        r = provider.get(f"{API}/bookings?tab=all")
        assert 12 <= len(r.json()) <= 20  # not doubled

    def test_clear_seeded(self, provider):
        provider.post(f"{API}/dev/seed-bookings")
        r = provider.delete(f"{API}/dev/seed-bookings")
        assert r.status_code == 200
        assert r.json()["cleared"] >= 12
        assert provider.get(f"{API}/bookings?tab=all").json() == []


class TestListingAndFilters:
    def test_upcoming_excludes_history(self, seeded_provider):
        upcoming = seeded_provider.get(f"{API}/bookings?tab=upcoming").json()
        for b in upcoming:
            assert b["status"] in ("pending", "accepted", "confirmed")

    def test_history_excludes_upcoming(self, seeded_provider):
        history = seeded_provider.get(f"{API}/bookings?tab=history").json()
        for b in history:
            assert b["status"] in ("completed", "cancelled", "no_show")

    def test_invalid_tab_rejected(self, seeded_provider):
        r = seeded_provider.get(f"{API}/bookings?tab=nope")
        assert r.status_code == 422


class TestStateMachine:
    def _pending_booking(self, session):
        for b in session.get(f"{API}/bookings?tab=upcoming").json():
            if b["status"] == "pending":
                return b
        return None

    def _confirmed_booking(self, session):
        for b in session.get(f"{API}/bookings?tab=upcoming").json():
            if b["status"] == "confirmed":
                return b
        return None

    def test_pending_to_accepted(self, seeded_provider):
        b = self._pending_booking(seeded_provider)
        assert b is not None
        r = seeded_provider.patch(f"{API}/bookings/{b['id']}/status", json={"status": "accepted"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "accepted"
        assert d["status_history"][-1]["status"] == "accepted"

    def test_pending_direct_to_completed_rejected(self, seeded_provider):
        b = self._pending_booking(seeded_provider)
        r = seeded_provider.patch(f"{API}/bookings/{b['id']}/status", json={"status": "completed"})
        assert r.status_code == 400

    def test_confirmed_to_completed(self, seeded_provider):
        b = self._confirmed_booking(seeded_provider)
        assert b is not None
        r = seeded_provider.patch(f"{API}/bookings/{b['id']}/status", json={"status": "completed"})
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

    def test_terminal_status_no_transition(self, seeded_provider):
        history = seeded_provider.get(f"{API}/bookings?tab=history").json()
        completed = next(b for b in history if b["status"] == "completed")
        r = seeded_provider.patch(f"{API}/bookings/{completed['id']}/status", json={"status": "confirmed"})
        assert r.status_code == 400

    def test_pending_to_cancelled_with_reason(self, seeded_provider):
        b = self._pending_booking(seeded_provider)
        r = seeded_provider.patch(f"{API}/bookings/{b['id']}/status", json={"status": "cancelled", "reason": "declined_by_provider"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "cancelled"
        assert d["status_history"][-1].get("reason") == "declined_by_provider"


class TestOwnership:
    def test_cannot_read_other_providers_booking(self, seeded_provider):
        b = seeded_provider.get(f"{API}/bookings?tab=upcoming").json()[0]
        other = _new_provider_session()
        r = other.get(f"{API}/bookings/{b['id']}")
        assert r.status_code == 404

    def test_cannot_update_other_providers_booking(self, seeded_provider):
        b = seeded_provider.get(f"{API}/bookings?tab=upcoming").json()[0]
        other = _new_provider_session()
        r = other.patch(f"{API}/bookings/{b['id']}/status", json={"status": "cancelled"})
        assert r.status_code == 404

    def test_unauth_401(self):
        assert requests.get(f"{API}/bookings").status_code == 401


class TestVerification:
    def test_submit_flips_to_pending_review(self, provider):
        me0 = provider.get(f"{API}/auth/me").json()
        assert me0["verification_status"] == "draft"
        r = provider.post(f"{API}/providers/me/verification/submit")
        assert r.status_code == 200
        assert r.json()["verification_status"] == "pending_review"
        me1 = provider.get(f"{API}/auth/me").json()
        assert me1["verification_status"] == "pending_review"

    def test_submit_noop_when_already_pending(self, provider):
        provider.post(f"{API}/providers/me/verification/submit")
        r = provider.post(f"{API}/providers/me/verification/submit")
        assert r.status_code == 200
        assert r.json()["verification_status"] == "pending_review"


class TestSummaryUpcomingCount:
    def test_seed_updates_summary(self, provider):
        s0 = provider.get(f"{API}/dashboard/provider-summary").json()
        assert s0["upcoming_bookings"] == 0
        assert s0["next_visit"] is None
        provider.post(f"{API}/dev/seed-bookings")
        s1 = provider.get(f"{API}/dashboard/provider-summary").json()
        assert s1["upcoming_bookings"] >= 3
        # seed forces one confirmed-today to ~45 min from now → next_visit populated
        assert s1["next_visit"] is not None
        assert "id" in s1["next_visit"]
        assert s1["next_visit"]["scheduled_at"]
