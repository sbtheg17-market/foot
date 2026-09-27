"""Tests for the owner's real provider account login flow.

Credentials come from the environment (see _creds.py); none are stored here.
"""
import requests

from _creds import BASE_URL, ORBITE_EMAIL, orbite_credentials


def test_orbite_login_success():
    email, password = orbite_credentials()
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 0
    assert data["user"]["email"] == ORBITE_EMAIL
    assert data["user"]["role"] == "provider"


def test_orbite_me_authed():
    email, password = orbite_credentials()
    login = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": password}, timeout=20)
    assert login.status_code == 200, login.text
    token = login.json()["token"]
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == ORBITE_EMAIL


def test_orbite_login_wrong_password():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ORBITE_EMAIL, "password": "definitelyWrong!"}, timeout=20)
    assert r.status_code == 401
    body = r.json()
    assert "error" in body or "message" in body


def test_boot_screen_present_in_static_html():
    r = requests.get(f"{BASE_URL}/", timeout=20)
    assert r.status_code == 200
    assert 'data-testid="app-boot-screen"' in r.text
