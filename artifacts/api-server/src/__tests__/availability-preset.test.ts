/**
 * Availability "9–5 weekdays" preset integration tests.
 *
 * Proves the preset payload persists through the existing
 * PUT /providers/me/availability path, is idempotent on reapply,
 * and preserves weekend slots + manual edits.
 *
 * Prerequisites: API server must be running (same as other integration tests).
 * Run: pnpm --filter @workspace/api-server run test:availability
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const TIMEOUT_MS = 10_000;

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

// Mirrors applyWeekdayPreset in artifacts/web/src/pages/portal/availability.tsx
function applyWeekdayPreset(slots: Slot[]): Slot[] {
  const weekendSlots = slots.filter((s) => !WEEKDAYS.includes(s.dayOfWeek));
  const weekdaySlots = WEEKDAYS.map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  }));
  return [...weekendSlots, ...weekdaySlots];
}

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    const body = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email: string, password: string): Promise<string> {
  const { status, body } = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(status, 200, `Login failed for ${email}: ${JSON.stringify(body)}`);
  return body["token"] as string;
}

function normalize(slots: Slot[]): string[] {
  return slots
    .map((s) => `${s.dayOfWeek}|${s.startTime.slice(0, 5)}|${s.endTime.slice(0, 5)}`)
    .sort();
}

async function getSlots(token: string): Promise<Slot[]> {
  const { status, body } = await apiFetch("/providers/me/availability", { token });
  assert.equal(status, 200);
  return body["slots"] as Slot[];
}

async function putSlots(token: string, slots: Slot[]): Promise<void> {
  const { status } = await apiFetch("/providers/me/availability", {
    method: "PUT",
    token,
    body: JSON.stringify({
      slots: slots.map(({ dayOfWeek, startTime, endTime }) => ({
        dayOfWeek,
        startTime: startTime.slice(0, 5),
        endTime: endTime.slice(0, 5),
      })),
    }),
  });
  assert.equal(status, 200);
}

describe("availability 9–5 weekdays preset", () => {
  let providerToken: string;
  let originalSlots: Slot[];

  before(async () => {
    providerToken = await login("sarah@oncallfoot.com", "demo1234");
    originalSlots = await getSlots(providerToken);
  });

  after(async () => {
    // Restore the seed schedule so other tests are unaffected.
    await putSlots(providerToken, originalSlots);
  });

  it("persists Mon–Fri 09:00–17:00 through the existing save path", async () => {
    const preset = applyWeekdayPreset([]);
    await putSlots(providerToken, preset);

    const saved = await getSlots(providerToken);
    const weekdaySlots = saved.filter((s) => WEEKDAYS.includes(s.dayOfWeek));
    assert.equal(weekdaySlots.length, 5, "one slot per weekday");
    for (const day of WEEKDAYS) {
      const slot = weekdaySlots.find((s) => s.dayOfWeek === day);
      assert.ok(slot, `weekday ${day} has a slot`);
      assert.equal(slot.startTime.slice(0, 5), "09:00");
      assert.equal(slot.endTime.slice(0, 5), "17:00");
    }
  });

  it("is idempotent — reapplying yields the identical schedule", async () => {
    const current = await getSlots(providerToken);
    const once = applyWeekdayPreset(current);
    await putSlots(providerToken, once);
    const afterOnce = await getSlots(providerToken);

    const twice = applyWeekdayPreset(afterOnce);
    await putSlots(providerToken, twice);
    const afterTwice = await getSlots(providerToken);

    assert.deepEqual(normalize(afterTwice), normalize(afterOnce));
  });

  it("preserves weekend slots and allows manual edits after the preset", async () => {
    const weekend: Slot = { dayOfWeek: 6, startTime: "10:00", endTime: "14:00" };
    await putSlots(providerToken, [weekend]);

    const withPreset = applyWeekdayPreset(await getSlots(providerToken));
    await putSlots(providerToken, withPreset);

    let saved = await getSlots(providerToken);
    const savedWeekend = saved.find((s) => s.dayOfWeek === 6);
    assert.ok(savedWeekend, "weekend slot survives the preset");
    assert.equal(savedWeekend.startTime.slice(0, 5), "10:00");

    // Manual edit after preset: change Monday, drop Friday — must persist as-is.
    const edited = saved
      .filter((s) => s.dayOfWeek !== 5)
      .map((s) =>
        s.dayOfWeek === 1 ? { ...s, startTime: "08:00", endTime: "12:00" } : s
      );
    await putSlots(providerToken, edited);

    saved = await getSlots(providerToken);
    const monday = saved.find((s) => s.dayOfWeek === 1);
    assert.equal(monday?.startTime.slice(0, 5), "08:00");
    assert.equal(saved.some((s) => s.dayOfWeek === 5), false, "Friday removed");
  });
});
