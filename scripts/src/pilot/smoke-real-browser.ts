/**
 * Real-browser smoke test (pilot readiness — docs/pilot/real-browser-smoke-test.md).
 *
 * ON-DEMAND, NOT CI-GATED (operator decision, 2026-08-26). Drives the full
 * pilot-critical flow in REAL desktop Chromium against a seeded local server:
 *
 *   provider publishes booking page (API setup, idempotent)
 *   → client opens /book/:slug, checks location (invalid then valid FSA)
 *   → selects service + real slot, signs in, confirms booking
 *   → provider sees + accepts the booking in the portal
 *   → provider proposes a reschedule (consent-first)
 *   → client declines the proposal, then cancels the booking
 *   → provider marks a separate past-due booking as a no-show
 *   → client escalates the no-show to support; admin sees the ticket
 *   → support contact links render on the public page and portal
 *
 * Run:  pnpm run smoke:real-browser
 * Env:  BASE_URL (default http://127.0.0.1:8080), DATABASE_URL (scratch DB,
 *       used ONLY to backdate one booking so the no-show rule can fire).
 * Never point this at a managed database or production host.
 */
import { chromium } from "playwright";
import {
  api,
  BASE,
  bookViaPublicPage,
  checkEligibility,
  ensurePilotProvider,
  findBookingByInstant,
  loadSlotPool,
  login,
  loginViaUi,
  PILOT_POSTAL_INVALID,
  printSummary,
  runStep,
  type StepResult,
} from "./lib.js";

async function backdateBooking(bookingId: number, when: Date): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is required to backdate the no-show fixture booking.");
  }
  const { pool } = await import("@workspace/db");
  await pool.query("UPDATE bookings SET scheduled_at = $1 WHERE id = $2", [when, bookingId]);
}

async function main(): Promise<number> {
  const results: StepResult[] = [];
  console.log(`Real-browser smoke test against ${BASE}\n`);

  // ── API preflight + pilot provider setup ────────────────────────────────
  let providerToken = "";
  let clientToken = "";
  let slug = "";
  let providerId = 0;
  let serviceId = 0;
  let pool: string[] = [];

  await runStep(results, "server healthz responds", async () => {
    const res = await fetch(`${BASE}/api/healthz`);
    if (res.status !== 200) throw new Error(`healthz HTTP ${res.status}`);
  });

  await runStep(results, "provider publishes booking page (service area + publish, idempotent)", async () => {
    providerToken = await login("sarah@oncallfoot.com", "demo1234");
    clientToken = await login("jane@oncallfoot.com", "demo1234");
    const pilot = await ensurePilotProvider(providerToken);
    ({ providerId, serviceId, slug } = pilot);
    pool = await loadSlotPool(providerId, serviceId, 6);
    return `slug=${slug}`;
  });

  const browser = await chromium.launch();
  const clientCtx = await browser.newContext();
  const providerCtx = await browser.newContext();
  const clientPage = await clientCtx.newPage();
  const providerPage = await providerCtx.newPage();

  let bookingAId = 0;
  let bookingASlot = "";
  let bookingBId = 0;

  try {
    // ── Client flow ────────────────────────────────────────────────────────
    await runStep(results, "public booking page renders with support footer", async () => {
      await clientPage.goto(`${BASE}/book/${slug}`, { waitUntil: "domcontentloaded" });
      await clientPage.waitForSelector('[data-testid="public-booking-page"]', { timeout: 15_000 });
      const link = clientPage.locator('[data-testid="public-booking-support-link"]');
      await link.waitFor({ timeout: 15_000 });
      const href = await link.getAttribute("href");
      if (!href || !(href.startsWith("mailto:") || href.startsWith("http"))) {
        throw new Error(`support link href unexpected: ${href}`);
      }
      return `support href=${href}`;
    });

    await runStep(results, "invalid FSA is rejected before service selection", async () => {
      await checkEligibility(clientPage, PILOT_POSTAL_INVALID, "ineligible");
    });

    await runStep(results, "client signs in via the login page", async () => {
      await loginViaUi(clientPage, "jane@oncallfoot.com", "demo1234");
    });

    await runStep(results, "valid FSA → service → real slot → confirmed booking (source=qr-card)", async () => {
      bookingASlot = pool.shift()!;
      await bookViaPublicPage(clientPage, slug, bookingASlot, "qr-card");
      const booking = await findBookingByInstant(clientToken, bookingASlot);
      if (booking.status !== "requested") throw new Error(`status=${booking.status}`);
      if (booking.source !== "qr-card") throw new Error(`source=${booking.source}`);
      bookingAId = booking.id;
      return `booking #${bookingAId}`;
    });

    // ── Provider flow ──────────────────────────────────────────────────────
    await runStep(results, "provider sees and accepts the booking in the portal", async () => {
      await loginViaUi(providerPage, "sarah@oncallfoot.com", "demo1234");
      await providerPage.goto(`${BASE}/provider/bookings`, { waitUntil: "domcontentloaded" });
      const card = providerPage
        .locator("div.rounded-3xl")
        .filter({ has: providerPage.locator(`[data-testid="booking-${bookingAId}-client-name"]`) });
      await card.waitFor({ timeout: 15_000 });
      await card.getByRole("button", { name: "Accept" }).click();
      await providerPage.waitForTimeout(1500);
      const booking = await findBookingByInstant(clientToken, bookingASlot);
      if (booking.status !== "confirmed") throw new Error(`status=${booking.status}`);
    });

    await runStep(results, "provider proposes a reschedule (consent-first, no time change)", async () => {
      const proposalSlot = pool.shift()!;
      await providerPage.click('[data-testid="booking-filter-confirmed"]');
      await providerPage.click(`[data-testid="booking-${bookingAId}-reschedule"]`);
      await providerPage.waitForSelector('[data-testid="reschedule-modal"]', { timeout: 15_000 });
      const { torontoDateOf } = await import("./lib.js");
      await providerPage.fill('[data-testid="reschedule-date-input"]', torontoDateOf(proposalSlot));
      const slotBtn = providerPage
        .locator('[data-testid="reschedule-slot-grid"] button:not([disabled])')
        .first();
      await slotBtn.waitFor({ timeout: 15_000 });
      await slotBtn.click();
      const reason = providerPage.locator('[data-testid="reschedule-reason-input"]');
      if (await reason.count()) await reason.fill("Route change for the pilot day");
      await providerPage.click('[data-testid="reschedule-submit-button"]');
      await providerPage.waitForSelector('[data-testid="reschedule-modal"]', {
        state: "detached",
        timeout: 20_000,
      });
      // Consent-first: the booking's confirmed time must be unchanged.
      const booking = await findBookingByInstant(clientToken, bookingASlot);
      if (booking.status !== "confirmed") throw new Error(`status=${booking.status}`);
      const proposals = await api(`/bookings/${bookingAId}/reschedule-requests`, { token: clientToken });
      const pending = (proposals.body["proposals"] as Array<{ status: string }>).find(
        (p) => p.status === "pending",
      );
      if (!pending) throw new Error("no pending proposal visible to the client");
    });

    await runStep(results, "client declines the proposal from the booking detail", async () => {
      await clientPage.goto(`${BASE}/bookings/${bookingAId}`, { waitUntil: "domcontentloaded" });
      await clientPage.waitForSelector('[data-testid="reschedule-proposal-card"]', { timeout: 15_000 });
      await clientPage.click('[data-testid="proposal-decline-button"]');
      await clientPage.waitForSelector('[data-testid="reschedule-proposal-card"]', {
        state: "detached",
        timeout: 20_000,
      });
      const proposals = await api(`/bookings/${bookingAId}/reschedule-requests`, { token: clientToken });
      const pending = (proposals.body["proposals"] as Array<{ status: string }>).find(
        (p) => p.status === "pending",
      );
      if (pending) throw new Error("proposal still pending after decline");
    });

    await runStep(results, "client cancels with the honest policy dialog", async () => {
      await clientPage.goto(`${BASE}/bookings/${bookingAId}`, { waitUntil: "domcontentloaded" });
      await clientPage.getByRole("button", { name: "Cancel booking" }).first().click();
      await clientPage.waitForSelector('[data-testid="cancel-booking-dialog"]', { timeout: 15_000 });
      const consequence = await clientPage
        .locator('[data-testid="cancel-booking-consequence"]')
        .textContent();
      await clientPage.click('[data-testid="cancel-booking-confirm"]');
      await clientPage.waitForTimeout(1500);
      const booking = await findBookingByInstant(clientToken, bookingASlot);
      if (booking.status !== "cancelled") throw new Error(`status=${booking.status}`);
      return `dialog: "${(consequence ?? "").slice(0, 60)}…" → ${booking.cancellationCategory}`;
    });

    // ── No-show (separate booking, backdated so the #13 time rule can fire) ─
    await runStep(results, "provider marks a past-due booking as a no-show", async () => {
      const slotB = pool.shift()!;
      const created = await api("/bookings", {
        method: "POST",
        token: clientToken,
        body: {
          providerId,
          serviceId,
          scheduledAt: slotB,
          address: "12 Pilot Lane",
          city: "St. Catharines",
          postalCode: "L2R 3M4",
        },
      });
      if (created.status !== 201) throw new Error(`create HTTP ${created.status}`);
      bookingBId = (created.body["booking"] as { id: number }).id;
      const confirmed = await api(`/bookings/${bookingBId}/status`, {
        method: "PATCH",
        token: providerToken,
        body: { status: "confirmed" },
      });
      if (confirmed.status !== 200) throw new Error(`confirm HTTP ${confirmed.status}`);
      await backdateBooking(bookingBId, new Date(Date.now() - 2 * 60 * 60 * 1000));

      await providerPage.goto(`${BASE}/provider/bookings`, { waitUntil: "domcontentloaded" });
      await providerPage.click('[data-testid="booking-filter-confirmed"]');
      await providerPage.click(`[data-testid="booking-${bookingBId}-no-show"]`);
      await providerPage.waitForSelector('[data-testid="no-show-dialog"]', { timeout: 15_000 });
      await providerPage.click('[data-testid="no-show-confirm"]');
      await providerPage.waitForTimeout(1500);
      const detail = await api(`/bookings/${bookingBId}`, { token: providerToken });
      const status = (detail.body["booking"] as { status: string }).status;
      if (status !== "no_show") throw new Error(`status=${status}`);
      return `booking #${bookingBId}`;
    });

    await runStep(results, "client escalates the no-show; admin sees the ticket", async () => {
      await clientPage.goto(`${BASE}/bookings/${bookingBId}`, { waitUntil: "domcontentloaded" });
      const escalate = clientPage.locator('[data-testid="booking-escalate-button"]');
      await escalate.waitFor({ timeout: 15_000 });
      await escalate.click();
      await clientPage.waitForTimeout(1500);
      const adminToken = await login("admin@oncallfoot.com", "demo1234");
      const view = await api(`/support/bookings/${bookingBId}/escalations`, { token: adminToken });
      if (view.status !== 200) throw new Error(`admin view HTTP ${view.status}`);
      const tickets = view.body["tickets"] as Array<{ id: number; status: string }>;
      if (!tickets.length) throw new Error("no escalation ticket recorded");
      return `ticket #${tickets[0]!.id} (${tickets[0]!.status})`;
    });

    await runStep(results, "portal footer shows the support contact link", async () => {
      const link = providerPage.locator('[data-testid="provider-portal-support-link"]');
      await link.waitFor({ timeout: 15_000 });
      return `href=${await link.getAttribute("href")}`;
    });
  } finally {
    await browser.close();
  }

  const failures = printSummary("Real-browser smoke test (Chromium)", results);
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
