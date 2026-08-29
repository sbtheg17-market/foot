"""Live E2E for pilot finding M-1: activation nextAction must never point at a 403 destination.

Runs against the local Node API (http://localhost:8080/api).
"""

import os
import time

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8080/api")
SETUP_ACTIONS = {
    "complete_profile",
    "configure_service_area",
    "add_service",
    "set_availability",
    "publish_booking_page",
    "share_booking_page",
    "all_set",
}

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def activation(tok):
    r = requests.get(f"{BASE}/providers/me/activation-status", headers=h(tok), timeout=20)
    assert r.status_code == 200, (r.status_code, r.text[:400])
    return r.json()["activation"]


def main():
    ts = int(time.time())
    email = f"m1-test-{ts}@example.test"
    reg = requests.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": "Passw0rd!23",
            "firstName": "M1",
            "lastName": "Tester",
            "roleIntent": "provider",
        },
        timeout=20,
    )
    check("register provider 200/201", reg.status_code in (200, 201), reg.status_code)
    tok = reg.json().get("token")
    if not tok:
        login = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "Passw0rd!23"}, timeout=20)
        tok = login.json()["token"]

    # --- regression: brand-new draft provider
    act = activation(tok)
    check("draft -> continue_onboarding", act["nextAction"] == "continue_onboarding", act["nextAction"])

    # --- complete application
    r = requests.patch(
        f"{BASE}/providers/application",
        headers=h(tok),
        json={"title": "TEST_Foot Care Nurse", "bio": "TEST bio for M-1 regression run.", "city": "Toronto"},
        timeout=20,
    )
    check("PATCH application", r.status_code == 200, r.status_code)
    r = requests.post(
        f"{BASE}/providers/application/services",
        headers=h(tok),
        json={"title": "TEST_Basic Foot Care", "durationMinutes": 60, "priceCents": 9000},
        timeout=20,
    )
    check("POST application service", r.status_code in (200, 201), r.status_code)
    r = requests.put(
        f"{BASE}/providers/application/availability",
        headers=h(tok),
        json={"slots": [{"dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00"}]},
        timeout=20,
    )
    check("PUT application availability", r.status_code == 200, r.status_code)
    r = requests.post(
        f"{BASE}/providers/me/verification",
        headers=h(tok),
        json={"docType": "license", "fileName": "x.pdf"},
        timeout=20,
    )
    check("POST verification doc", r.status_code in (200, 201), r.status_code)
    r = requests.post(f"{BASE}/providers/application/submit", headers=h(tok), json={}, timeout=20)
    check("POST application submit", r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    act = activation(tok)
    check("under_review -> wait_for_review", act["nextAction"] == "wait_for_review", act["nextAction"])
    check("under_review applicationStatus", act["applicationStatus"] == "under_review", act["applicationStatus"])

    st = requests.get(f"{BASE}/providers/application/status", headers=h(tok), timeout=20).json()["status"]
    app_id = st["applicationId"]

    # --- admin login
    adm = requests.post(
        f"{BASE}/auth/login", json={"email": "admin@oncallfoot.com", "password": "demo1234"}, timeout=20
    )
    check("admin login", adm.status_code == 200, adm.status_code)
    atok = adm.json()["token"]

    # capture the pending verification doc id BEFORE decisions
    q = requests.get(f"{BASE}/admin/verification/queue?status=pending&limit=200", headers=h(atok), timeout=30)
    check("admin verification queue 200", q.status_code == 200, q.status_code)
    docs = [i["doc"]["id"] for i in q.json()["items"] if i.get("provider", {}).get("email") == email] or None
    if not docs:
        # fall back: newest pending doc
        docs = [max(i["doc"]["id"] for i in q.json()["items"])]
    doc_id = docs[0]

    # --- approve ONLY the application
    r = requests.post(
        f"{BASE}/admin/provider-applications/{app_id}/approve", headers=h(atok), json={}, timeout=20
    )
    check("admin approve application", r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    # === M-1 CORE ===
    act = activation(tok)
    check("M-1 applicationStatus approved", act["applicationStatus"] == "approved", act["applicationStatus"])
    check(
        "M-1 verification under_review",
        act["verification"]["status"] == "under_review",
        act["verification"]["status"],
    )
    check("M-1 milestones.approved == false", act["milestones"]["approved"] is False, act["milestones"]["approved"])
    check("M-1 nextAction == wait_for_review", act["nextAction"] == "wait_for_review", act["nextAction"])
    check("M-1 nextAction not a setup action", act["nextAction"] not in SETUP_ACTIONS, act["nextAction"])
    sa = requests.put(
        f"{BASE}/providers/me/service-area",
        headers=h(tok),
        json={"countryCode": "CA", "provinceCode": "ON", "city": "Toronto"},
        timeout=20,
    )
    check("M-1 gated PUT /me/service-area == 403", sa.status_code == 403, f"{sa.status_code} {sa.text[:200]}")

    # === verification rejected path ===
    r = requests.patch(
        f"{BASE}/admin/verification/docs/{doc_id}",
        headers=h(atok),
        json={"status": "rejected", "updateProviderStatus": "rejected"},
        timeout=20,
    )
    check("admin reject verification doc", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    act = activation(tok)
    check("rejected verif -> review_update_needed", act["nextAction"] == "review_update_needed", act["nextAction"])
    check(
        "rejected verif status needs_update",
        act["verification"]["status"] == "needs_update",
        act["verification"]["status"],
    )
    check("rejected verif canResubmit", act["verification"]["canResubmit"] is True, act["verification"]["canResubmit"])
    sa = requests.put(
        f"{BASE}/providers/me/service-area",
        headers=h(tok),
        json={"countryCode": "CA", "provinceCode": "ON", "city": "Toronto"},
        timeout=20,
    )
    check("rejected verif gated route still 403", sa.status_code == 403, sa.status_code)

    # === full approval restores the journey ===
    r = requests.patch(
        f"{BASE}/admin/verification/docs/{doc_id}",
        headers=h(atok),
        json={"status": "approved", "updateProviderStatus": "approved"},
        timeout=20,
    )
    check("admin approve verification doc", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    act = activation(tok)
    check("full approval milestones.approved", act["milestones"]["approved"] is True, act["milestones"]["approved"])
    check("full approval -> setup action", act["nextAction"] in SETUP_ACTIONS, act["nextAction"])
    check(
        "full approval -> configure_service_area", act["nextAction"] == "configure_service_area", act["nextAction"]
    )
    sa = requests.put(
        f"{BASE}/providers/me/service-area",
        headers=h(tok),
        json={"countryCode": "CA", "provinceCode": "ON", "city": "Toronto"},
        timeout=20,
    )
    check("full approval PUT /me/service-area == 200", sa.status_code == 200, f"{sa.status_code} {sa.text[:200]}")
    # Coverage is only "configured" once an active postal prefix exists, so the CTA
    # correctly stays on configure_service_area until a prefix is added (verified in
    # m1_service_area_followup.py -> advances to publish_booking_page).
    pfx = requests.post(
        f"{BASE}/providers/me/service-area/prefixes", headers=h(tok), json={"prefix": "M5V"}, timeout=20
    )
    check("add coverage prefix 201/409", pfx.status_code in (201, 409), f"{pfx.status_code} {pfx.text[:150]}")
    act = activation(tok)
    check(
        "after coverage added, action advances past configure_service_area",
        act["nextAction"] in SETUP_ACTIONS and act["nextAction"] != "configure_service_area",
        act["nextAction"],
    )

    # === regression: admin-rejected application ===
    ts2 = int(time.time())
    email2 = f"m1-rej-{ts2}@example.test"
    reg2 = requests.post(
        f"{BASE}/auth/register",
        json={
            "email": email2,
            "password": "Passw0rd!23",
            "firstName": "M1",
            "lastName": "Reject",
            "roleIntent": "provider",
        },
        timeout=20,
    )
    tok2 = reg2.json()["token"]
    requests.patch(
        f"{BASE}/providers/application",
        headers=h(tok2),
        json={"title": "TEST_Reject Path", "bio": "TEST bio reject path M-1.", "city": "Toronto"},
        timeout=20,
    )
    requests.post(
        f"{BASE}/providers/application/services",
        headers=h(tok2),
        json={"title": "TEST_Svc", "durationMinutes": 30, "priceCents": 5000},
        timeout=20,
    )
    requests.put(
        f"{BASE}/providers/application/availability",
        headers=h(tok2),
        json={"slots": [{"dayOfWeek": 2, "startTime": "10:00", "endTime": "16:00"}]},
        timeout=20,
    )
    requests.post(
        f"{BASE}/providers/me/verification", headers=h(tok2), json={"docType": "license", "fileName": "y.pdf"}, timeout=20
    )
    requests.post(f"{BASE}/providers/application/submit", headers=h(tok2), json={}, timeout=20)
    app2 = requests.get(f"{BASE}/providers/application/status", headers=h(tok2), timeout=20).json()["status"][
        "applicationId"
    ]
    rj = requests.post(
        f"{BASE}/admin/provider-applications/{app2}/reject",
        headers=h(atok),
        json={"rejectionReason": "TEST_regression reject reason for M-1 run."},
        timeout=20,
    )
    check("admin reject application", rj.status_code == 200, f"{rj.status_code} {rj.text[:200]}")
    act2 = activation(tok2)
    check("rejected app applicationStatus", act2["applicationStatus"] == "rejected", act2["applicationStatus"])
    check("rejected app -> review_update_needed", act2["nextAction"] == "review_update_needed", act2["nextAction"])

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n=== {passed}/{len(results)} checks passed ===")
    for n, ok, d in results:
        if not ok:
            print(f"FAILED: {n} :: {d}")


if __name__ == "__main__":
    main()
