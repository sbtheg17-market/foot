#!/usr/bin/env python3
"""
B-prime r2 browser verification (local stack http://localhost:8899).

Modes:
  desktop    validation 3 + 5: desktop sidebar sign-out + session/token clearing
  mobile     validation 4 + 5: mobile top-right sign-out + session/token clearing
  protected  validation 6: protected routes stay protected after sign-out (+ API 401)

Exit 0 only if every assertion in the selected mode passes.
Demo login: sarah@oncallfoot.com / demo1234 (local seeded scratch DB only).
"""
import sys
import json
import urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8899"
EMAIL = "sarah@oncallfoot.com"
PASSWORD = "demo1234"
TOKEN_KEY = "oncallfoot_token"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}: {name}" + (f" — {detail}" if detail else ""))
    return bool(ok)


def login(page):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda u: "/provider" in u, timeout=15000)
    page.wait_for_load_state("networkidle")


def token_of(page):
    return page.evaluate(f"localStorage.getItem('{TOKEN_KEY}')")


def run_desktop(page):
    login(page)
    check("desktop: provider dashboard reached after login", "/provider" in page.url, page.url)
    check("desktop: session token present in localStorage after login", bool(token_of(page)))
    desktop_btn = page.locator('[data-testid="provider-signout-button-desktop"]')
    mobile_btn = page.locator('[data-testid="provider-signout-button"]')
    desktop_btn.wait_for(state="visible", timeout=10000)
    check("desktop: sidebar sign-out button visible", desktop_btn.is_visible())
    check("desktop: mobile sign-out control hidden at desktop width", not mobile_btn.is_visible())
    desktop_btn.click()
    page.wait_for_url(lambda u: "/login" in u, timeout=15000)
    check("desktop: redirected to /login after sign-out", "/login" in page.url, page.url)
    check("desktop: session token CLEARED from localStorage", token_of(page) is None)


def run_mobile(page):
    login(page)
    check("mobile: provider dashboard reached after login", "/provider" in page.url, page.url)
    check("mobile: session token present in localStorage after login", bool(token_of(page)))
    mobile_btn = page.locator('[data-testid="provider-signout-button"]')
    desktop_btn = page.locator('[data-testid="provider-signout-button-desktop"]')
    mobile_btn.wait_for(state="visible", timeout=10000)
    check("mobile: top-right sign-out control visible at 390px", mobile_btn.is_visible())
    check("mobile: desktop sidebar sign-out hidden at 390px", not desktop_btn.is_visible())
    mobile_btn.click()
    page.wait_for_url(lambda u: "/login" in u, timeout=15000)
    check("mobile: redirected to /login after sign-out", "/login" in page.url, page.url)
    check("mobile: session token CLEARED from localStorage", token_of(page) is None)


def run_protected(page):
    # sign in, sign out, then verify every protected surface refuses access
    login(page)
    tok = token_of(page)
    check("protected: authenticated session established", bool(tok))
    page.locator('[data-testid="provider-signout-button-desktop"]').click()
    page.wait_for_url(lambda u: "/login" in u, timeout=15000)
    check("protected: signed out (token cleared)", token_of(page) is None)

    for route in ["/provider", "/provider/bookings", "/provider/earnings", "/provider/profile"]:
        page.goto(f"{BASE}{route}", wait_until="networkidle")
        page.wait_for_timeout(1500)
        ok = "/login" in page.url
        check(f"protected: direct navigation to {route} after sign-out lands on /login", ok, page.url)

    # API-level: bearer-less request must be 401
    req = urllib.request.Request(f"{BASE}/api/auth/me")
    try:
        urllib.request.urlopen(req)
        check("protected: /api/auth/me without token returns 401", False, "unexpected 200")
    except urllib.error.HTTPError as e:
        check("protected: /api/auth/me without token returns 401", e.code == 401, f"HTTP {e.code}")

    # API-level: the revoked/absent token is not silently re-accepted client-side
    page.goto(f"{BASE}/provider", wait_until="networkidle")
    page.wait_for_timeout(1500)
    check("protected: no protected content rendered without session", "/login" in page.url, page.url)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "desktop"
    viewport = {"width": 390, "height": 844} if mode == "mobile" else {"width": 1920, "height": 800}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport=viewport)
        page = ctx.new_page()
        try:
            {"desktop": run_desktop, "mobile": run_mobile, "protected": run_protected}[mode](page)
            page.screenshot(path=f"/app/audit/evidence_shots/bprime_{mode}_final.png", full_page=False)
        finally:
            browser.close()
    failed = [r for r in results if not r[1]]
    print(json.dumps({"mode": mode, "total": len(results), "passed": len(results) - len(failed),
                      "failed": len(failed)}))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
