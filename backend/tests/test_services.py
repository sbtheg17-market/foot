"""Services CRUD tests (Checkpoint 2). Ownership + toggle + soft-delete flow."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://provider-hub-95.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _unique_email():
    return f"TEST_svc_{uuid.uuid4().hex[:10]}@example.com"


def _new_provider_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _unique_email()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST Svc Provider"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def provider():
    return _new_provider_session()


class TestServicesCRUD:
    def test_list_empty_for_new_provider(self, provider):
        r = provider.get(f"{API}/services")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_and_list(self, provider):
        payload = {
            "name": "Nail Care",
            "description": "Trim and file.",
            "duration_minutes": 30,
            "price_cents": 6500,
            "currency": "USD",
            "active": True,
        }
        r = provider.post(f"{API}/services", json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["name"] == "Nail Care"
        assert d["price_cents"] == 6500
        assert d["duration_minutes"] == 30
        assert d["active"] is True
        assert d["currency"] == "USD"
        assert "id" in d and d["id"]

        lst = provider.get(f"{API}/services").json()
        assert any(s["id"] == d["id"] for s in lst)

    def test_update(self, provider):
        d = provider.post(f"{API}/services", json={
            "name": "Callus Care", "description": "", "duration_minutes": 30,
            "price_cents": 7000, "currency": "USD", "active": True,
        }).json()
        r = provider.put(f"{API}/services/{d['id']}", json={"name": "Callus Care Pro", "price_cents": 9000})
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["name"] == "Callus Care Pro"
        assert u["price_cents"] == 9000
        assert u["duration_minutes"] == 30  # unchanged

    def test_toggle_flips_active(self, provider):
        d = provider.post(f"{API}/services", json={
            "name": "Foot Massage", "description": "", "duration_minutes": 45,
            "price_cents": 8000, "currency": "USD", "active": True,
        }).json()
        r = provider.patch(f"{API}/services/{d['id']}/toggle")
        assert r.status_code == 200
        assert r.json()["active"] is False
        r = provider.patch(f"{API}/services/{d['id']}/toggle")
        assert r.json()["active"] is True

    def test_soft_delete_removes_from_list(self, provider):
        d = provider.post(f"{API}/services", json={
            "name": "Wound Check", "description": "", "duration_minutes": 30,
            "price_cents": 5500, "currency": "USD", "active": True,
        }).json()
        r = provider.delete(f"{API}/services/{d['id']}")
        assert r.status_code == 204
        lst = provider.get(f"{API}/services").json()
        assert all(s["id"] != d["id"] for s in lst)
        # 2nd delete -> 404
        r2 = provider.delete(f"{API}/services/{d['id']}")
        assert r2.status_code == 404

    def test_ownership_isolation(self):
        p1 = _new_provider_session()
        p2 = _new_provider_session()
        d1 = p1.post(f"{API}/services", json={
            "name": "P1 Service", "description": "", "duration_minutes": 30,
            "price_cents": 5000, "currency": "USD", "active": True,
        }).json()
        # P2 cannot read P1's service
        r = p2.get(f"{API}/services/{d1['id']}")
        assert r.status_code == 404
        # P2 cannot update P1's service
        r = p2.put(f"{API}/services/{d1['id']}", json={"name": "hacked"})
        assert r.status_code == 404
        # P2 cannot delete P1's service
        r = p2.delete(f"{API}/services/{d1['id']}")
        assert r.status_code == 404
        # P2's list does not contain P1's service
        lst = p2.get(f"{API}/services").json()
        assert all(s["id"] != d1["id"] for s in lst)

    def test_unauth_401(self):
        r = requests.get(f"{API}/services")
        assert r.status_code == 401

    def test_dashboard_summary_reflects_active_services(self, provider):
        summary = provider.get(f"{API}/dashboard/provider-summary").json()
        base = summary["active_services"]
        provider.post(f"{API}/services", json={
            "name": "Summary Check", "description": "", "duration_minutes": 30,
            "price_cents": 5000, "currency": "USD", "active": True,
        })
        s2 = provider.get(f"{API}/dashboard/provider-summary").json()
        assert s2["active_services"] == base + 1


class TestValidation:
    def test_missing_name_422(self, provider):
        r = provider.post(f"{API}/services", json={
            "description": "no name", "duration_minutes": 30, "price_cents": 5000,
        })
        assert r.status_code == 422

    def test_negative_price_422(self, provider):
        r = provider.post(f"{API}/services", json={
            "name": "Bad", "description": "", "duration_minutes": 30, "price_cents": -1,
        })
        assert r.status_code == 422
