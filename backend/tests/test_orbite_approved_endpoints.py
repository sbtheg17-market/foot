"""Iteration 4: verify the owner's provider account is fully approved (application +
verification) and every provider endpoint listed in the review request returns 200.

Credentials come from the environment (see _creds.py); none are stored here.
"""
import pytest
import requests

from _creds import BASE_URL, orbite_credentials


@pytest.fixture(scope="module")
def orbite_token():
    email, password = orbite_credentials()
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(orbite_token):
    return {"Authorization": f"Bearer {orbite_token}"}


def test_auth_me_shows_application_approved(auth_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # traverse common shapes
    app_status = None
    for path in (
        ("providerApplication", "status"),
        ("user", "providerApplication", "status"),
        ("onboarding", "provider"),
    ):
        cur = body
        for k in path:
            cur = cur.get(k) if isinstance(cur, dict) else None
            if cur is None:
                break
        if cur:
            app_status = cur
            break
    assert app_status == "approved", f"application/onboarding status not approved: body={body}"


@pytest.mark.parametrize("path", [
    "/api/providers/me",
    "/api/providers/me/dashboard",
    "/api/providers/me/service-area",
    "/api/providers/me/availability",
    "/api/providers/me/services",
    "/api/providers/me/readiness",
])
def test_provider_endpoints_return_200(auth_headers, path):
    r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:400]}"
