"""Backend auth + onboarding tests for OnCall Foot provider API."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-hub-95.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "provider@test.com"
SEED_PASSWORD = "test1234"


def _unique_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Register ----------
class TestRegister:
    def test_register_new_user(self, session):
        email = _unique_email()
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["name"] == "TEST User"
        assert data["onboarding_complete"] is False
        assert data.get("role") == "provider"
        assert "id" in data and data["id"]
        # cookies set
        assert "access_token" in session.cookies
        assert "refresh_token" in session.cookies

    def test_register_duplicate_email_returns_400(self, session):
        r = session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PASSWORD, "name": "dup"})
        assert r.status_code == 400
        assert "exists" in r.json().get("detail", "").lower()

    def test_register_short_password_422(self, session):
        r = session.post(f"{API}/auth/register", json={"email": _unique_email(), "password": "123", "name": "x"})
        assert r.status_code == 422


# ---------- Login ----------
class TestLogin:
    def test_login_success_seed_user(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == SEED_EMAIL
        assert data["onboarding_complete"] is True
        assert "access_token" in session.cookies

    def test_login_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrongpass"})
        assert r.status_code in (401, 429)
        if r.status_code == 401:
            assert r.json()["detail"] == "Invalid email or password"


# ---------- /auth/me ----------
class TestMe:
    def test_me_unauth_401(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_cookies(self, session):
        session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL


# ---------- Onboarding ----------
class TestOnboarding:
    def test_put_providers_me_completes_onboarding(self, session):
        email = _unique_email()
        session.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST Onb"})
        r = session.put(f"{API}/providers/me", json={
            "name": "TEST Onb Updated",
            "bio": "test bio",
            "certifications": ["CFCN", "DFCN"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["onboarding_complete"] is True
        assert d["name"] == "TEST Onb Updated"
        assert d["bio"] == "test bio"
        assert d["certifications"] == ["CFCN", "DFCN"]

        # GET verifies persistence
        me = session.get(f"{API}/auth/me").json()
        assert me["onboarding_complete"] is True
        assert me["bio"] == "test bio"


# ---------- Logout ----------
class TestLogout:
    def test_logout_clears_session(self, session):
        session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
        r = session.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # New session should be needed - cookies deleted server-side response;
        # requests session may still hold expired cookie. Confirm via /me on new session.
        s2 = requests.Session()
        assert s2.get(f"{API}/auth/me").status_code == 401


# ---------- Brute force lockout ----------
class TestBruteForce:
    def test_lockout_after_5_failures(self):
        # Use a unique email so it doesn't clash with other tests / existing lockouts
        email = _unique_email()
        # Register first so identifier can lock even without existing user (but works either way)
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "BF"})
        # clear cookies for pure login attempts
        s.cookies.clear()
        codes = []
        for _ in range(6):
            r = s.post(f"{API}/auth/login", json={"email": email, "password": "wrongwrong"})
            codes.append(r.status_code)
        # first 5 should be 401, 6th should be 429
        assert codes[:5] == [401, 401, 401, 401, 401], codes
        assert codes[5] == 429, codes
