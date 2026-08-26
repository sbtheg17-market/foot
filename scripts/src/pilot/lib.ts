/**
 * Shared helpers for the pilot readiness browser checks
 * (docs/pilot/real-browser-smoke-test.md, docs/pilot/native-device-validation-report.md).
 *
 * Requirements: seeded scratch PostgreSQL + the built single-service bundle
 * running on BASE_URL (default http://127.0.0.1:8080). Never point these at
 * a managed database or production host.
 */
import type { Page } from "playwright";

export const BASE = process.env["BASE_URL"] ?? "http://127.0.0.1:8080";
export const API = `${BASE}/api`;

export const MARKETPLACE_TZ = "America/Toronto";
export const PILOT_POSTAL_VALID = "L2R 3M4"; // St. Catharines
export const PILOT_POSTAL_INVALID = "K1A 0A6"; // Ottawa — outside pilot corridor
export const PILOT_CITY = "St. Catharines";
export const PILOT_PREFIXES = ["L2R", "L2T", "L6H", "L6J", "M5V"];

// ── Tiny API client ───────────────────────────────────────────────────────────

export async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

export async function login(email: string, password: string): Promise<string> {
  const { status, body } = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (status !== 200 || typeof body["token"] !== "string") {
    throw new Error(`Login failed for ${email}: HTTP ${status} ${JSON.stringify(body)}`);
  }
  return body["token"] as string;
}

// ── Pilot provider setup (idempotent, API-driven) ─────────────────────────────

export interface PilotProvider {
  providerId: number;
  serviceId: number;
  slug: string;
}

export async function ensurePilotProvider(providerToken: string): Promise<PilotProvider> {
  const me = await api("/providers/me", { token: providerToken });
  if (me.status !== 200) throw new Error(`GET /providers/me failed: ${me.status}`);
  const providerId = (me.body["provider"] as { id: number }).id;

  const svc = await api(`/providers/${providerId}/services`, { token: providerToken });
  const services = (svc.body["services"] as Array<{ id: number; isActive: boolean }>) ?? [];
  const active = services.find((s) => s.isActive) ?? services[0];
  if (!active) throw new Error("Pilot provider has no services — run pnpm run seed first.");

  const area = await api("/providers/me/service-area", {
    method: "PUT",
    token: providerToken,
    body: {
      countryCode: "CA",
      provinceCode: "ON",
      city: PILOT_CITY,
      publicDescription: "Serving the St. Catharines–Oakville corridor (pilot).",
      isActive: true,
    },
  });
  if (area.status !== 200) throw new Error(`Service-area setup failed: ${area.status}`);

  for (const prefix of PILOT_PREFIXES) {
    const added = await api("/providers/me/service-area/prefixes", {
      method: "POST",
      token: providerToken,
      body: { prefix },
    });
    // 200/201 = added or reactivated; 409 = already in coverage (idempotent
    // re-run). Anything else is a real failure.
    if (added.status !== 200 && added.status !== 201 && added.status !== 409) {
      throw new Error(`Adding prefix ${prefix} failed: ${added.status} ${JSON.stringify(added.body)}`);
    }
  }

  const published = await api("/providers/me/booking-page/publish", {
    method: "POST",
    token: providerToken,
  });
  if (published.status !== 200) {
    throw new Error(`Publish failed: ${published.status} ${JSON.stringify(published.body)}`);
  }
  const pageState = published.body["bookingPage"] as { slug: string; published: boolean };
  if (!pageState.published || !pageState.slug) throw new Error("Booking page did not publish.");

  return { providerId, serviceId: active.id, slug: pageState.slug };
}

// ── Real-slot pool (same approach as the API integration suites) ─────────────

export async function loadSlotPool(
  providerId: number,
  serviceId: number,
  want: number,
  spacingMs = 120 * 60 * 1000,
): Promise<string[]> {
  const pool: string[] = [];
  let lastMs = 0;
  const base = Date.now();
  for (let d = 2; d <= 28 && pool.length < want; d++) {
    const date = new Date(base + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { body } = await api(`/providers/${providerId}/slots?serviceId=${serviceId}&date=${date}`);
    const slots = (body["slots"] as Array<{ start: string; available: boolean }>) ?? [];
    for (const s of slots) {
      if (!s.available) continue;
      const ms = Date.parse(s.start);
      if (ms - lastMs >= spacingMs) {
        pool.push(s.start);
        lastMs = ms;
      }
    }
  }
  if (pool.length < want) throw new Error(`Only ${pool.length}/${want} fixture slots available.`);
  return pool;
}

/** Wall-clock YYYY-MM-DD of a UTC instant in the marketplace timezone. */
export function torontoDateOf(instantIso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKETPLACE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instantIso));
}

// ── Step logging ──────────────────────────────────────────────────────────────

export interface StepResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

export async function runStep(
  results: StepResult[],
  name: string,
  fn: () => Promise<string | void>,
): Promise<boolean> {
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", ...(detail ? { detail } : {}) });
    console.log(`  PASS — ${name}${detail ? ` (${detail})` : ""}`);
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, status: "FAIL", detail });
    console.error(`  FAIL — ${name}: ${detail}`);
    return false;
  }
}

export function printSummary(title: string, results: StepResult[]): number {
  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n== ${title} ==`);
  for (const r of results) {
    console.log(`${r.status.padEnd(4)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`${results.length - failed.length}/${results.length} steps passed`);
  return failed.length;
}

// ── Reusable browser flows ────────────────────────────────────────────────────

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => localStorage.getItem("oncallfoot_token") !== null, undefined, {
    timeout: 15_000,
  });
}

export async function checkEligibility(
  page: Page,
  postal: string,
  expected: "eligible" | "ineligible",
): Promise<void> {
  await page.waitForSelector('[data-testid="service-area-form"]', { timeout: 15_000 });
  await page.selectOption('[data-testid="service-area-province"]', "ON");
  await page.fill('[data-testid="service-area-city"]', PILOT_CITY);
  await page.fill('[data-testid="service-area-postal"]', postal);
  await page.click('[data-testid="service-area-submit"]');
  await page.waitForSelector(`[data-testid="service-area-result-${expected}"]`, { timeout: 15_000 });
}

/**
 * Full client booking flow on a public booking page. The page must already be
 * authenticated as a client (loginViaUi). Returns the chosen slot instant.
 */
export async function bookViaPublicPage(
  page: Page,
  slug: string,
  slotIso: string,
  source?: string,
): Promise<string> {
  const url = `${BASE}/book/${slug}${source ? `?source=${source}` : ""}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="public-booking-page"]', { timeout: 15_000 });

  await checkEligibility(page, PILOT_POSTAL_VALID, "eligible");

  await page.waitForSelector('[data-testid="public-booking-services"]', { timeout: 15_000 });
  await page.locator('[data-testid^="public-booking-service-"]').first().click();
  await page.click('[data-testid="public-booking-cta"]');

  await page.waitForSelector('[data-testid="booking-modal"]', { timeout: 15_000 });
  await page.fill('[data-testid="booking-date-input"]', torontoDateOf(slotIso));
  const slotButton = page.locator(`[data-testid="booking-slot-${slotIso}"]`);
  await slotButton.waitFor({ timeout: 15_000 });
  await slotButton.click();
  await page.fill('[data-testid="booking-address-input"]', "12 Pilot Lane");
  await page.fill('[data-testid="booking-city-input"]', PILOT_CITY);
  await page.fill('[data-testid="booking-postal-input"]', PILOT_POSTAL_VALID);
  await page.click('[data-testid="booking-submit-button"]');
  await page.waitForSelector('[data-testid="booking-modal"]', { state: "detached", timeout: 20_000 });
  return slotIso;
}

/** Find the client's booking id for an exact scheduled instant. */
export async function findBookingByInstant(
  clientToken: string,
  instantIso: string,
): Promise<{ id: number; status: string; source: string | null; cancellationCategory?: string | null }> {
  const { status, body } = await api("/bookings?limit=100", { token: clientToken });
  if (status !== 200) throw new Error(`GET /bookings failed: ${status}`);
  const bookings = body["bookings"] as Array<{
    id: number;
    status: string;
    scheduledAt: string;
    source: string | null;
    cancellationCategory?: string | null;
  }>;
  // A cancelled booking frees its slot, so the same instant can be rebooked —
  // always match the NEWEST booking at that instant (highest id).
  const match = bookings
    .filter((b) => new Date(b.scheduledAt).getTime() === new Date(instantIso).getTime())
    .sort((a, b) => b.id - a.id)[0];
  if (!match) throw new Error(`No booking found at ${instantIso}`);
  return match;
}
