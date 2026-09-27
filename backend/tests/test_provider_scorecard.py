"""Read-only regression for the provider scorecard (Phase 3) and the corrected
earnings summary. Login + GET only against the live DB."""
import pytest
import requests

from _creds import BASE_URL, demo_credentials, orbite_credentials

COUNT_KEYS = {"total", "completed", "cancelled", "noShow", "awaitingOutcome", "resolved",
              "distinctClients", "repeatClients", "reviews", "rates"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def owner_headers(session):
    return _login(session, *orbite_credentials())


@pytest.fixture(scope="module")
def demo_headers(session):
    return _login(session, *demo_credentials("sarah"))


@pytest.fixture(scope="module")
def admin_headers(session):
    return _login(session, *demo_credentials("admin"))


def _check_counts(c):
    assert set(c) == COUNT_KEYS
    assert c["resolved"] == c["completed"] + c["cancelled"] + c["noShow"]
    assert c["total"] == c["resolved"] + c["awaitingOutcome"]
    assert c["repeatClients"] <= c["distinctClients"] <= c["completed"]
    assert set(c["reviews"]) == {"count", "averageRating"}
    if c["reviews"]["count"] == 0:
        assert c["reviews"]["averageRating"] is None
    else:
        assert 1 <= c["reviews"]["averageRating"] <= 5
    if c["resolved"] < 5:
        assert c["rates"] is None
    else:
        assert set(c["rates"]) == {"completion", "cancellation", "noShow"}
        assert abs(sum(c["rates"].values()) - 1) < 0.01


@pytest.mark.parametrize("path", ["/api/providers/me/scorecard", "/api/providers/me/earnings"])
def test_unauth_401(session, path):
    assert session.get(f"{BASE_URL}{path}", timeout=15).status_code == 401


@pytest.mark.parametrize("path", ["/api/providers/me/scorecard", "/api/providers/me/earnings"])
def test_admin_is_not_a_provider(session, admin_headers, path):
    assert session.get(f"{BASE_URL}{path}", headers=admin_headers, timeout=15).status_code in (403, 404)


def test_scorecard_shape_and_invariants(session, demo_headers):
    r = session.get(f"{BASE_URL}/api/providers/me/scorecard", headers=demo_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["windowDays"] == 30 and d["minimumForRates"] == 5
    assert d["isDemo"] is True
    _check_counts(d["last30"])
    _check_counts(d["allTime"])
    assert d["last30"]["total"] <= d["allTime"]["total"]
    gaps = [s["gap"] for s in d["suggestions"]]
    assert len(gaps) == len(set(gaps)), "at most one suggestion per gap"
    for s in d["suggestions"]:
        assert s["message"] and not any(w in s["message"].lower() for w in ("revenue", "guarantee"))


def test_owner_scorecard_is_not_demo_and_empty_is_honest(session, owner_headers):
    r = session.get(f"{BASE_URL}/api/providers/me/scorecard", headers=owner_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["isDemo"] is False
    _check_counts(d["allTime"])
    if d["allTime"]["total"] == 0:
        assert d["suggestions"] == [] and d["allTime"]["rates"] is None


def test_earnings_summary_is_invoice_based_and_counts_completed(session, demo_headers):
    r = session.get(f"{BASE_URL}/api/providers/me/earnings", headers=demo_headers, timeout=15)
    assert r.status_code == 200, r.text
    e = r.json()
    assert set(e) == {"totalCents", "paidCents", "pendingPayoutCents", "completedBookings", "invoiceCount"}
    assert e["totalCents"] == e["paidCents"] + e["pendingPayoutCents"]
    s = session.get(f"{BASE_URL}/api/providers/me/scorecard", headers=demo_headers, timeout=15).json()
    assert e["completedBookings"] == s["allTime"]["completed"], "real completed count, not reviewCount"
