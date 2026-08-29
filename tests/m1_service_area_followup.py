"""Follow-up: confirm configure_service_area is not a dead-end CTA once coverage is added."""

import os
import time

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api")


def h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


ts = int(time.time())
email = f"m1-cov-{ts}@example.test"
tok = requests.post(
    f"{BASE}/auth/register",
    json={"email": email, "password": "Passw0rd!23", "firstName": "M1", "lastName": "Cov", "roleIntent": "provider"},
    timeout=20,
).json()["token"]
requests.patch(f"{BASE}/providers/application", headers=h(tok), json={"title": "TEST_Cov", "bio": "TEST bio coverage path.", "city": "Toronto"}, timeout=20)
requests.post(f"{BASE}/providers/application/services", headers=h(tok), json={"title": "TEST_Svc", "durationMinutes": 45, "priceCents": 7000}, timeout=20)
requests.put(f"{BASE}/providers/application/availability", headers=h(tok), json={"slots": [{"dayOfWeek": 3, "startTime": "09:00", "endTime": "17:00"}]}, timeout=20)
requests.post(f"{BASE}/providers/me/verification", headers=h(tok), json={"docType": "license", "fileName": "z.pdf"}, timeout=20)
requests.post(f"{BASE}/providers/application/submit", headers=h(tok), json={}, timeout=20)
app_id = requests.get(f"{BASE}/providers/application/status", headers=h(tok), timeout=20).json()["status"]["applicationId"]
atok = requests.post(f"{BASE}/auth/login", json={"email": "admin@oncallfoot.com", "password": "demo1234"}, timeout=20).json()["token"]
doc_id = max(
    i["doc"]["id"]
    for i in requests.get(f"{BASE}/admin/verification/queue?status=pending&limit=200", headers=h(atok), timeout=30).json()["items"]
)
requests.post(f"{BASE}/admin/provider-applications/{app_id}/approve", headers=h(atok), json={}, timeout=20)
requests.patch(f"{BASE}/admin/verification/docs/{doc_id}", headers=h(atok), json={"status": "approved", "updateProviderStatus": "approved"}, timeout=20)

requests.put(f"{BASE}/providers/me/service-area", headers=h(tok), json={"countryCode": "CA", "provinceCode": "ON", "city": "Toronto"}, timeout=20)
p = requests.post(f"{BASE}/providers/me/service-area/prefixes", headers=h(tok), json={"prefix": "M5V"}, timeout=20)
print("add prefix:", p.status_code, p.text[:200])
act = requests.get(f"{BASE}/providers/me/activation-status", headers=h(tok), timeout=20).json()["activation"]
print("serviceAreaConfigured:", act["milestones"]["serviceAreaConfigured"], "nextAction:", act["nextAction"])
