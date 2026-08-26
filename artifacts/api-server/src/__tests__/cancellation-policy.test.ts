/**
 * Cancellation policy pure-unit tests (roadmap #13).
 *
 * DST-safety note: all boundary math is pure UTC-instant arithmetic
 * (milliseconds), so wall-clock DST transitions cannot shift the notice
 * window. The DST cases below pin instants across the 2026 North American
 * transitions to prove it.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CANCELLATION_NOTICE_HOURS,
  InvalidCancellationNoticeError,
  computeCancellationCategory,
  computeFreeCancellationDeadline,
  getCancellationNoticeHours,
  getCancellationPolicySummary,
  isNoShowMarkableNow,
  isProviderCancellationReasonCategory,
} from "../lib/cancellation-policy.js";

const ENV_KEY = "CANCELLATION_NOTICE_HOURS";
let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

describe("getCancellationNoticeHours", () => {
  it("defaults to the documented 24 hours", () => {
    assert.equal(getCancellationNoticeHours(), DEFAULT_CANCELLATION_NOTICE_HOURS);
    assert.equal(DEFAULT_CANCELLATION_NOTICE_HOURS, 24);
  });

  it("accepts a valid environment override", () => {
    process.env[ENV_KEY] = "48";
    assert.equal(getCancellationNoticeHours(), 48);
  });

  it("accepts zero (policy disabled — every client cancel is within notice)", () => {
    process.env[ENV_KEY] = "0";
    assert.equal(getCancellationNoticeHours(), 0);
  });

  it("treats an empty override as the default (unset, not invalid)", () => {
    process.env[ENV_KEY] = "  ";
    assert.equal(getCancellationNoticeHours(), 24);
  });

  for (const bad of ["-1", "1.5", "abc", "169", "24h", "NaN"]) {
    it(`rejects invalid override "${bad}" loudly (never a silent fallback)`, () => {
      process.env[ENV_KEY] = bad;
      assert.throws(() => getCancellationNoticeHours(), InvalidCancellationNoticeError);
    });
  }
});

describe("computeCancellationCategory — client boundary math", () => {
  const scheduledAt = new Date("2026-06-15T18:00:00.000Z");

  it("early when exactly at the notice boundary (24h before is still free)", () => {
    const now = new Date("2026-06-14T18:00:00.000Z");
    assert.equal(
      computeCancellationCategory("client", now, scheduledAt),
      "client_cancelled_early",
    );
  });

  it("early when more than the notice window remains", () => {
    const now = new Date("2026-06-13T17:59:59.000Z");
    assert.equal(
      computeCancellationCategory("client", now, scheduledAt),
      "client_cancelled_early",
    );
  });

  it("late one millisecond inside the notice window", () => {
    const now = new Date("2026-06-14T18:00:00.001Z");
    assert.equal(
      computeCancellationCategory("client", now, scheduledAt),
      "client_cancelled_late",
    );
  });

  it("late after the appointment has passed", () => {
    const now = new Date("2026-06-16T09:00:00.000Z");
    assert.equal(
      computeCancellationCategory("client", now, scheduledAt),
      "client_cancelled_late",
    );
  });

  it("respects an overridden notice window", () => {
    process.env[ENV_KEY] = "48";
    const now = new Date("2026-06-14T18:00:00.000Z"); // 24h out — late under 48h policy
    assert.equal(
      computeCancellationCategory("client", now, scheduledAt),
      "client_cancelled_late",
    );
  });

  it("spring-forward DST night stays pure instant math (2026-03-08 America/Toronto)", () => {
    // Appointment 2026-03-08T18:00Z; 24h before is 2026-03-07T18:00Z even
    // though only 23 wall-clock hours pass locally.
    const dstAppointment = new Date("2026-03-08T18:00:00.000Z");
    const exactly24hBefore = new Date("2026-03-07T18:00:00.000Z");
    const after = new Date("2026-03-07T18:00:00.001Z");
    assert.equal(
      computeCancellationCategory("client", exactly24hBefore, dstAppointment),
      "client_cancelled_early",
    );
    assert.equal(
      computeCancellationCategory("client", after, dstAppointment),
      "client_cancelled_late",
    );
  });

  it("fall-back DST night stays pure instant math (2026-11-01 America/Toronto)", () => {
    const dstAppointment = new Date("2026-11-01T18:00:00.000Z");
    const exactly24hBefore = new Date("2026-10-31T18:00:00.000Z");
    assert.equal(
      computeCancellationCategory("client", exactly24hBefore, dstAppointment),
      "client_cancelled_early",
    );
    assert.equal(
      computeFreeCancellationDeadline(dstAppointment).toISOString(),
      exactly24hBefore.toISOString(),
    );
  });
});

describe("computeCancellationCategory — roles", () => {
  const scheduledAt = new Date("2026-06-15T18:00:00.000Z");
  const now = new Date("2026-06-15T17:00:00.000Z"); // inside notice window

  it("provider cancellation never penalizes the client (no early/late)", () => {
    assert.equal(
      computeCancellationCategory("provider", now, scheduledAt),
      "provider_cancelled",
    );
  });

  it("admin cancellation records as cancelled_by_support", () => {
    assert.equal(
      computeCancellationCategory("admin", now, scheduledAt),
      "cancelled_by_support",
    );
  });
});

describe("isNoShowMarkableNow", () => {
  const scheduledAt = new Date("2026-06-15T18:00:00.000Z");

  it("blocked before the scheduled instant", () => {
    assert.equal(isNoShowMarkableNow(new Date("2026-06-15T17:59:59.999Z"), scheduledAt), false);
  });

  it("blocked AT the exact scheduled instant (time must have passed)", () => {
    assert.equal(isNoShowMarkableNow(new Date("2026-06-15T18:00:00.000Z"), scheduledAt), false);
  });

  it("allowed after the scheduled instant", () => {
    assert.equal(isNoShowMarkableNow(new Date("2026-06-15T18:00:00.001Z"), scheduledAt), true);
  });
});

describe("provider reason-category allowlist", () => {
  it("accepts every allowlisted category", () => {
    for (const c of [
      "illness",
      "emergency",
      "schedule_conflict",
      "client_request",
      "declined_request",
      "reschedule_declined",
      "other",
    ]) {
      assert.equal(isProviderCancellationReasonCategory(c), true);
    }
  });

  it("rejects unknown values, empty strings, and non-strings", () => {
    for (const bad of ["", "free_text", "ILLNESS", 42, null, undefined, {}]) {
      assert.equal(isProviderCancellationReasonCategory(bad), false);
    }
  });
});

describe("getCancellationPolicySummary", () => {
  it("exposes only the notice window and plain-language copy", () => {
    const summary = getCancellationPolicySummary();
    assert.deepEqual(Object.keys(summary).sort(), ["noticeHours", "summary"]);
    assert.equal(summary.noticeHours, 24);
    assert.match(summary.summary, /Free cancellation until 24 hours/);
    // Never leak internal state identifiers publicly.
    assert.doesNotMatch(summary.summary, /client_cancelled|provider_cancelled|no_show/);
  });
});
