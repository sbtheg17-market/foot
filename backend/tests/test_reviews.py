"""Review list + summary tests (Checkpoint 6)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-hub-95.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _unique_email():
    return f"TEST_rev_{uuid.uuid4().hex[:10]}@example.com"


def _new_provider_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/register", json={"email": _unique_email(), "password": "test1234", "name": "TEST Reviews"})
    assert r.status_code == 200
    return s


@pytest.fixture
def provider():
    return _new_provider_session()


@pytest.fixture
def seeded_provider():
    s = _new_provider_session()
    s.post(f"{API}/dev/seed-bookings")
    return s


class TestReviews:
    def test_empty_for_new_provider(self, provider):
        assert provider.get(f"{API}/reviews").json() == []
        s = provider.get(f"{API}/reviews/summary").json()
        assert s["count"] == 0
        assert s["average"] == 0.0
        assert set(s["breakdown"].keys()) == {"5", "4", "3", "2", "1"}

    def test_seed_creates_reviews_for_completed(self, seeded_provider):
        reviews = seeded_provider.get(f"{API}/reviews").json()
        assert len(reviews) >= 3  # 4 completed seeded bookings -> 4 reviews
        for r in reviews:
            assert 1 <= r["rating"] <= 5
            assert r["client_name"]
            assert r["is_verified"] is True

    def test_summary_matches_reviews(self, seeded_provider):
        reviews = seeded_provider.get(f"{API}/reviews").json()
        s = seeded_provider.get(f"{API}/reviews/summary").json()
        assert s["count"] == len(reviews)
        total = sum(int(r["rating"]) for r in reviews)
        expected_avg = round(total / len(reviews), 1)
        assert s["average"] == expected_avg

    def test_reseed_replaces_reviews(self, seeded_provider):
        c1 = seeded_provider.get(f"{API}/reviews/summary").json()["count"]
        seeded_provider.post(f"{API}/dev/seed-bookings")
        c2 = seeded_provider.get(f"{API}/reviews/summary").json()["count"]
        assert c1 == c2  # not doubled

    def test_summary_on_dashboard(self, seeded_provider):
        s = seeded_provider.get(f"{API}/dashboard/provider-summary").json()
        assert "reviews" in s
        assert s["reviews"]["count"] >= 3
        assert s["reviews"]["average"] > 0

    def test_ownership(self, seeded_provider):
        other = _new_provider_session()
        assert other.get(f"{API}/reviews").json() == []
        s = other.get(f"{API}/reviews/summary").json()
        assert s["count"] == 0

    def test_unauth_401(self):
        assert requests.get(f"{API}/reviews").status_code == 401
        assert requests.get(f"{API}/reviews/summary").status_code == 401
