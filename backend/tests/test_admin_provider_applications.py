"""Test new admin provider-applications endpoints (Phase 1 command center).

Tests the two new read-only admin endpoints:
- GET /api/admin/provider-applications
- GET /api/admin/provider-applications/events

All tests are read-only (GET + login only) against the LIVE production DB.
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
def admin_token(session):
    """Admin token for testing admin-only endpoints."""
    email, password = demo_credentials("admin")
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def provider_token(session):
    """Provider token for testing role-based access."""
    email, password = orbite_credentials()
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Provider login failed: {r.text}"
    return r.json()["token"]


# ── GET /api/admin/provider-applications ────────────────────────────────────


def test_provider_applications_unauth(session):
    """Without token -> 401"""
    r = session.get(f"{BASE_URL}/api/admin/provider-applications", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_provider_applications_provider_forbidden(session, provider_token):
    """With PROVIDER token -> 403"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications",
        headers={"Authorization": f"Bearer {provider_token}"},
        timeout=15
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


def test_provider_applications_admin_success(session, admin_token):
    """With ADMIN token -> 200 with correct structure"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    data = r.json()
    # Check response structure
    assert "items" in data, "Response missing 'items'"
    assert "total" in data, "Response missing 'total'"
    assert "limit" in data, "Response missing 'limit'"
    assert "offset" in data, "Response missing 'offset'"

    assert isinstance(data["items"], list), "items should be a list"
    assert isinstance(data["total"], int), "total should be an integer"
    assert isinstance(data["limit"], int), "limit should be an integer"
    assert isinstance(data["offset"], int), "offset should be an integer"

    # Check default status filter is under_review
    # (we can't assert items exist, but structure should be correct)

    # If items exist, check structure
    if len(data["items"]) > 0:
        item = data["items"][0]
        assert "application" in item, "Item missing 'application'"
        assert "applicant" in item, "Item missing 'applicant'"

        app = item["application"]
        assert "id" in app
        assert "status" in app
        assert "currentStep" in app
        assert "submittedAt" in app
        assert "reviewedAt" in app
        assert "createdAt" in app
        assert "updatedAt" in app

        # Must NOT contain sensitive fields
        assert "reviewerNotes" not in app, "Response must not contain reviewerNotes"
        assert "rejectionReason" not in app, "Response must not contain rejectionReason"

        applicant = item["applicant"]
        assert "userId" in applicant
        assert "firstName" in applicant
        assert "lastName" in applicant
        assert "email" in applicant
        assert "providerProfileId" in applicant
        assert "city" in applicant
        assert "verificationStatus" in applicant

        # Check ordering: submittedAt ascending (oldest first)
        if len(data["items"]) > 1:
            for i in range(len(data["items"]) - 1):
                curr = data["items"][i]["application"]["submittedAt"]
                next_item = data["items"][i + 1]["application"]["submittedAt"]
                # Both could be null, or curr should be <= next
                if curr and next_item:
                    assert curr <= next_item, "Items should be ordered by submittedAt ascending"


def test_provider_applications_invalid_status(session, admin_token):
    """?status=bogus -> 400"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications?status=bogus",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_provider_applications_limit_zero(session, admin_token):
    """?limit=0 -> 400"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications?limit=0",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_provider_applications_offset_negative(session, admin_token):
    """?offset=-1 -> 400"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications?offset=-1",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_provider_applications_status_approved(session, admin_token):
    """?status=approved -> 200 (may list items)"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications?status=approved",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "items" in data
    assert "total" in data


# ── GET /api/admin/provider-applications/events ─────────────────────────────


def test_provider_applications_events_unauth(session):
    """Without token -> 401"""
    r = session.get(f"{BASE_URL}/api/admin/provider-applications/events", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_provider_applications_events_provider_forbidden(session, provider_token):
    """With PROVIDER token -> 403"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications/events",
        headers={"Authorization": f"Bearer {provider_token}"},
        timeout=15
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


def test_provider_applications_events_admin_success(session, admin_token):
    """With ADMIN token -> 200 with correct structure"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications/events",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    data = r.json()
    assert "items" in data, "Response missing 'items'"
    assert isinstance(data["items"], list), "items should be a list"

    # If items exist, check structure
    if len(data["items"]) > 0:
        item = data["items"][0]
        assert "id" in item
        assert "providerApplicationId" in item
        assert "type" in item
        assert "fromStatus" in item
        assert "toStatus" in item
        assert "createdAt" in item
        assert "applicant" in item

        # Check type is one of the allowed values
        assert item["type"] in ["submitted", "reset_to_draft", "approved", "rejected"], \
            f"Invalid event type: {item['type']}"

        applicant = item["applicant"]
        assert "userId" in applicant
        assert "firstName" in applicant
        assert "lastName" in applicant

        # Must NOT contain email addresses or reviewerNotes
        response_text = r.text
        assert "@" not in response_text, "Response must not contain email addresses"
        assert "reviewerNotes" not in response_text.lower(), "Response must not contain reviewerNotes"

        # Check ordering: newest first by createdAt
        if len(data["items"]) > 1:
            for i in range(len(data["items"]) - 1):
                curr = data["items"][i]["createdAt"]
                next_item = data["items"][i + 1]["createdAt"]
                assert curr >= next_item, "Items should be ordered by createdAt descending (newest first)"


def test_provider_applications_events_limit_51(session, admin_token):
    """?limit=51 -> 400 (max is 50)"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications/events?limit=51",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_provider_applications_events_limit_zero(session, admin_token):
    """?limit=0 -> 400"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications/events?limit=0",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_provider_applications_events_custom_limit(session, admin_token):
    """?limit=5 -> 200 with at most 5 items"""
    r = session.get(
        f"{BASE_URL}/api/admin/provider-applications/events?limit=5",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert len(data["items"]) <= 5, f"Expected at most 5 items, got {len(data['items'])}"
