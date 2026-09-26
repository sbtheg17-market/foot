"""Iteration 4: verify orbitetech12 is fully approved (application + verification)
and every provider endpoint listed in the review request returns 200.
"""
import pytest
import requests

BASE_URL = "https://785221eb-8dfb-4b06-bfc8-c01c12209808.preview.emergentagent.com"
ORBITE = ("orbitetech12@gmail.com", "1234Fake")


@pytest.fixture(scope="module")
def orbite_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ORBITE[0], "password": ORBITE[1]}, timeout=20)
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
