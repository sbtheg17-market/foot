"""Tests for the user's real account login flow (orbitetech12)."""
import requests

BASE_URL = "https://785221eb-8dfb-4b06-bfc8-c01c12209808.preview.emergentagent.com"
EMAIL = "orbitetech12@gmail.com"
PASSWORD = "1234Fake"


def test_orbite_login_success():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 0
    assert data["user"]["email"] == EMAIL
    assert data["user"]["role"] == "provider"


def test_orbite_me_authed():
    login = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert login.status_code == 200, login.text
    token = login.json()["token"]
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == EMAIL


def test_orbite_login_wrong_password():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": "definitelyWrong!"}, timeout=20)
    assert r.status_code == 401
    body = r.json()
    assert "error" in body or "message" in body


def test_boot_screen_present_in_static_html():
    r = requests.get(f"{BASE_URL}/", timeout=20)
    assert r.status_code == 200
    assert 'data-testid="app-boot-screen"' in r.text
