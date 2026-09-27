"""Read-only regression for the Phase 2 slice 2/3 admin command-center feeds.

- GET /api/admin/verification/events   (recent credential decisions)
- GET /api/admin/support/escalations    (open support requests)
- approve/reject responses carry an honest `email` outcome (contract only;
  no decision is taken here — GET + login only against the live DB).
"""
import pytest
import requests

from _creds import BASE_URL, demo_credentials, orbite_credentials


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers(session):
    email, password = demo_credentials("admin")
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def provider_headers(session):
    email, password = orbite_credentials()
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Provider login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ── gates ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("path", ["/api/admin/verification/events", "/api/admin/support/escalations"])
def test_unauth_401(session, path):
    assert session.get(f"{BASE_URL}{path}", timeout=15).status_code == 401


@pytest.mark.parametrize("path", ["/api/admin/verification/events", "/api/admin/support/escalations"])
def test_provider_403(session, provider_headers, path):
    assert session.get(f"{BASE_URL}{path}", headers=provider_headers, timeout=15).status_code == 403


# ── GET /api/admin/verification/events ──────────────────────────────────────

def test_verification_events_shape(session, admin_headers):
    r = session.get(f"{BASE_URL}/api/admin/verification/events?limit=5", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) <= 5
    for ev in items:
        assert ev["status"] in ("approved", "rejected")
        assert ev["reviewedAt"] is not None
        assert set(ev["provider"]) == {"id", "userId", "firstName", "lastName", "verificationStatus"}
        assert "reviewerNotes" not in ev and "email" not in ev["provider"]
    reviewed = [ev["reviewedAt"] for ev in items]
    assert reviewed == sorted(reviewed, reverse=True), "newest decision first"


@pytest.mark.parametrize("limit", ["0", "51", "abc"])
def test_verification_events_bad_limit(session, admin_headers, limit):
    r = session.get(f"{BASE_URL}/api/admin/verification/events?limit={limit}", headers=admin_headers, timeout=15)
    assert r.status_code == 400


# ── GET /api/admin/support/escalations ──────────────────────────────────────

def test_escalations_default_unresolved_oldest_first(session, admin_headers):
    r = session.get(f"{BASE_URL}/api/admin/support/escalations", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body["total"], int) and body["total"] >= len(body["items"])
    for t in body["items"]:
        assert t["status"] in ("open", "in_progress")
        assert set(t["requester"]) == {"userId", "firstName", "lastName", "role"}
        assert isinstance(t["messageCount"], int)
        if t["latestMessage"] is not None:
            assert set(t["latestMessage"]) == {"message", "createdAt", "fromAdmin"}
            assert len(t["latestMessage"]["message"]) <= 280
    created = [t["createdAt"] for t in body["items"]]
    assert created == sorted(created), "oldest open request first"


def test_escalations_resolved_filter(session, admin_headers):
    r = session.get(f"{BASE_URL}/api/admin/support/escalations?status=resolved&limit=5", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    assert all(t["status"] == "resolved" for t in r.json()["items"])


@pytest.mark.parametrize("query", ["status=bogus", "limit=0", "limit=201"])
def test_escalations_bad_input(session, admin_headers, query):
    r = session.get(f"{BASE_URL}/api/admin/support/escalations?{query}", headers=admin_headers, timeout=15)
    assert r.status_code == 400


# ── System status lists the email configuration (presence only) ─────────────

def test_system_status_reports_email_env_presence_only(session, admin_headers):
    r = session.get(f"{BASE_URL}/api/admin/system-status", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    names = {e["name"] for e in r.json()["env"]}
    assert {"EMERGENT_EMAIL_KEY", "EMAIL_FROM_NAME", "PUBLIC_APP_URL"} <= names
    for e in r.json()["env"]:
        assert set(e) == {"name", "required", "isSet", "purpose"}, "values are never returned"
