"""OnCall Foot - backend API smoke tests against the public preview URL.

Credentials are loaded from the environment (see _creds.py); none are stored here.
"""
import pytest
import requests

from _creds import BASE_URL, QA_EMAIL, qa_credentials


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    email, password = qa_credentials()
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --- Health ---
def test_healthz(session):
    r = session.get(f"{BASE_URL}/api/healthz", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# --- Providers listing (public) ---
def test_providers_list(session):
    r = session.get(f"{BASE_URL}/api/providers?limit=1", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("providers"), list)
    assert len(data["providers"]) >= 1
    assert data.get("total", 0) >= 8


# --- Auth flows ---
def test_login_success(session):
    email, password = qa_credentials()
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 0
    assert data["user"]["email"] == QA_EMAIL
    assert data["user"]["role"] == "provider"


def test_login_invalid(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": QA_EMAIL, "password": "wrongpass"}, timeout=15)
    assert r.status_code in (400, 401)


def test_me_unauth(session):
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 401
    assert "error" in r.json()


def test_me_authed(session, token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == QA_EMAIL
    assert data["user"]["role"] == "provider"
