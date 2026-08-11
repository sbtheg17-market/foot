#!/usr/bin/env python3
"""Evidence screenshots: provider dashboard PRE-sign-out at desktop and mobile
viewports, showing the two sign-out controls introduced by B-prime r2."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8899"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                args=["--no-sandbox", "--disable-dev-shm-usage"])
    for mode, vp, testid in [
        ("desktop", {"width": 1920, "height": 800}, "provider-signout-button-desktop"),
        ("mobile", {"width": 390, "height": 844}, "provider-signout-button"),
    ]:
        ctx = browser.new_context(viewport=vp)
        page = ctx.new_page()
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[type="email"]', "sarah@oncallfoot.com")
        page.fill('input[type="password"]', "demo1234")
        page.click('button[type="submit"]')
        page.wait_for_url(lambda u: "/provider" in u, timeout=15000)
        btn = page.locator(f'[data-testid="{testid}"]')
        btn.wait_for(state="visible", timeout=10000)
        page.wait_for_timeout(800)
        page.screenshot(path=f"/app/audit/evidence_shots/bprime_{mode}_pre_signout.png")
        print(f"{mode}: sign-out control [{testid}] visible, screenshot saved")
        ctx.close()
    browser.close()
print("PRE-SIGNOUT EVIDENCE COMPLETE")
