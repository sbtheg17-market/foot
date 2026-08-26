/**
 * Native-device EMULATION checks (pilot readiness —
 * docs/pilot/native-device-validation-report.md).
 *
 * HONESTY NOTE: these are Playwright device-profile emulations (viewport,
 * touch, mobile UA, device pixel ratio; WebKit engine for the iPhone profile,
 * Chromium for the Android profile). They are NOT physical-device
 * verification — cold start, push permissions, and OS-level deep-link
 * handling remain on the manual hardware script
 * (docs/pilot/native-device-hardware-test-script.md).
 *
 * Profiles:
 *   iPhone 13   — WebKit,  390×844, touch, iOS Safari UA
 *   Pixel 5     — Chromium, 393×851, touch, Android Chrome UA
 * Extra checks: PST device timezone (marketplace time must stay Toronto),
 * deep-link ?source= attribution, and a 3G throttle load (Chromium CDP).
 *
 * Run:  pnpm run smoke:mobile-emulation
 * Env:  BASE_URL (default http://127.0.0.1:8080).
 */
import { chromium, devices, webkit, type Browser } from "playwright";
import {
  BASE,
  bookViaPublicPage,
  ensurePilotProvider,
  findBookingByInstant,
  loadSlotPool,
  login,
  loginViaUi,
  printSummary,
  runStep,
  type StepResult,
} from "./lib.js";

interface Profile {
  name: string;
  device: (typeof devices)[string];
  launch: () => Promise<Browser>;
  engine: "webkit" | "chromium";
}

const PROFILES: Profile[] = [
  { name: "iPhone 13 (WebKit emulation)", device: devices["iPhone 13"]!, launch: () => webkit.launch(), engine: "webkit" },
  { name: "Pixel 5 (Chromium emulation)", device: devices["Pixel 5"]!, launch: () => chromium.launch(), engine: "chromium" },
];

async function main(): Promise<number> {
  const results: StepResult[] = [];
  console.log(`Native-device emulation checks against ${BASE}\n`);

  const providerToken = await login("sarah@oncallfoot.com", "demo1234");
  const clientToken = await login("jane@oncallfoot.com", "demo1234");
  const { providerId, serviceId, slug } = await ensurePilotProvider(providerToken);
  const pool = await loadSlotPool(providerId, serviceId, 2 * PROFILES.length + 2);

  for (const profile of PROFILES) {
    console.log(`\n-- ${profile.name} --`);
    const browser = await profile.launch();
    const context = await browser.newContext({
      ...profile.device,
      timezoneId: "America/Los_Angeles", // PST device — marketplace must stay Toronto
    });
    const page = await context.newPage();

    try {
      await runStep(results, `${profile.name}: deep link with ?source=text renders the booking page`, async () => {
        await page.goto(`${BASE}/book/${slug}?source=text`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-testid="public-booking-page"]', { timeout: 20_000 });
        await page.waitForSelector('[data-testid="public-booking-support-link"]', { timeout: 20_000 });
      });

      await runStep(results, `${profile.name}: PST device still sees marketplace (Toronto) times`, async () => {
        const label = await page.locator('[data-testid="public-booking-timezone"]').textContent();
        if (!label || !label.includes("America/Toronto".replace(/_/g, " "))) {
          throw new Error(`timezone label: "${label}"`);
        }
      });

      await runStep(results, `${profile.name}: touch booking flow completes with source=text attribution`, async () => {
        await loginViaUi(page, "jane@oncallfoot.com", "demo1234");
        const slot = pool.shift()!;
        await bookViaPublicPage(page, slug, slot, "text");
        const booking = await findBookingByInstant(clientToken, slot);
        if (booking.status !== "requested") throw new Error(`status=${booking.status}`);
        if (booking.source !== "text") throw new Error(`source=${booking.source}`);
        return `booking #${booking.id}`;
      });

      await runStep(results, `${profile.name}: provider portal renders on the device viewport`, async () => {
        const providerPage = await context.newPage();
        await loginViaUi(providerPage, "sarah@oncallfoot.com", "demo1234");
        await providerPage.goto(`${BASE}/provider/bookings`, { waitUntil: "domcontentloaded" });
        await providerPage.waitForSelector('[data-testid="booking-status-filters"]', { timeout: 20_000 });
        await providerPage.waitForSelector('[data-testid="provider-portal-support-link"]', { timeout: 20_000 });
        await providerPage.close();
      });

      if (profile.engine === "chromium") {
        await runStep(results, `${profile.name}: booking page loads under 3G throttle (CDP)`, async () => {
          const throttled = await context.newPage();
          const cdp = await context.newCDPSession(throttled);
          await cdp.send("Network.enable");
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 400,
            downloadThroughput: (1.6 * 1024 * 1024) / 8, // regular 3G ~1.6 Mbps down
            uploadThroughput: (750 * 1024) / 8,
          });
          const started = Date.now();
          await throttled.goto(`${BASE}/book/${slug}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
          await throttled.waitForSelector('[data-testid="public-booking-page"]', { timeout: 60_000 });
          const elapsed = Date.now() - started;
          await throttled.close();
          return `${elapsed} ms to interactive booking page`;
        });
      }
    } finally {
      await browser.close();
    }
  }

  const failures = printSummary("Native-device emulation (NOT hardware validation)", results);
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
