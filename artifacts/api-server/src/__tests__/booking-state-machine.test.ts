/**
 * Booking state machine unit tests.
 * Run: pnpm --filter @workspace/api-server run test
 *
 * Uses Node.js built-in test runner (node:test) — no extra deps needed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isTransitionAllowed,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUSES,
  BookingStatus,
} from "../lib/booking-state-machine.js";

// ─── Allowed transitions ──────────────────────────────────────────────────────

describe("isTransitionAllowed — provider", () => {
  it("provider can confirm a requested booking", () => {
    assert.ok(isTransitionAllowed("requested", "confirmed", "provider"));
  });
  it("provider can cancel a requested booking", () => {
    assert.ok(isTransitionAllowed("requested", "cancelled", "provider"));
  });
  it("provider can complete a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "completed", "provider"));
  });
  it("provider can cancel a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "cancelled", "provider"));
  });
  it("provider can reschedule a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "rescheduled", "provider"));
  });
  it("provider can mark no_show on a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "no_show", "provider"));
  });
  it("provider can reconfirm a rescheduled booking", () => {
    assert.ok(isTransitionAllowed("rescheduled", "confirmed", "provider"));
  });
  it("provider can cancel a rescheduled booking", () => {
    assert.ok(isTransitionAllowed("rescheduled", "cancelled", "provider"));
  });
});

describe("isTransitionAllowed — client", () => {
  it("client can cancel a requested booking", () => {
    assert.ok(isTransitionAllowed("requested", "cancelled", "client"));
  });
  it("client can cancel a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "cancelled", "client"));
  });
  it("client can reschedule a confirmed booking", () => {
    assert.ok(isTransitionAllowed("confirmed", "rescheduled", "client"));
  });
  it("client can cancel a rescheduled booking", () => {
    assert.ok(isTransitionAllowed("rescheduled", "cancelled", "client"));
  });
});

describe("isTransitionAllowed — admin override", () => {
  it("admin can make any transition including invalid ones", () => {
    assert.ok(isTransitionAllowed("completed", "requested", "admin"));
    assert.ok(isTransitionAllowed("cancelled", "confirmed", "admin"));
    assert.ok(isTransitionAllowed("no_show", "completed", "admin"));
  });
});

// ─── Blocked transitions ──────────────────────────────────────────────────────

describe("isTransitionAllowed — blocked for client", () => {
  it("client cannot confirm a booking (provider only)", () => {
    assert.equal(isTransitionAllowed("requested", "confirmed", "client"), false);
  });
  it("client cannot complete a booking (provider only)", () => {
    assert.equal(isTransitionAllowed("confirmed", "completed", "client"), false);
  });
  it("client cannot mark no_show (provider only)", () => {
    assert.equal(isTransitionAllowed("confirmed", "no_show", "client"), false);
  });
  it("client cannot reconfirm a rescheduled booking (provider only)", () => {
    assert.equal(isTransitionAllowed("rescheduled", "confirmed", "client"), false);
  });
});

describe("isTransitionAllowed — terminal states", () => {
  const terminals: BookingStatus[] = ["completed", "cancelled", "no_show"];
  const allStatuses: BookingStatus[] = [
    "requested", "confirmed", "completed", "cancelled", "rescheduled", "no_show",
  ];

  for (const terminal of terminals) {
    for (const next of allStatuses) {
      it(`${terminal} → ${next} is blocked for provider`, () => {
        assert.equal(isTransitionAllowed(terminal, next, "provider"), false);
      });
      it(`${terminal} → ${next} is blocked for client`, () => {
        assert.equal(isTransitionAllowed(terminal, next, "client"), false);
      });
    }
  }
});

describe("isTransitionAllowed — invalid same-status transitions", () => {
  const statuses: BookingStatus[] = [
    "requested", "confirmed", "rescheduled",
  ];
  for (const s of statuses) {
    it(`provider cannot transition ${s} → ${s} (no self-loops)`, () => {
      assert.equal(isTransitionAllowed(s, s, "provider"), false);
    });
    it(`client cannot transition ${s} → ${s}`, () => {
      assert.equal(isTransitionAllowed(s, s, "client"), false);
    });
  }
});

// ─── ALLOWED_TRANSITIONS structure ───────────────────────────────────────────

describe("ALLOWED_TRANSITIONS structure", () => {
  it("has no transitions out of completed", () => {
    const t = ALLOWED_TRANSITIONS["completed"];
    assert.equal(Object.keys(t).length, 0);
  });
  it("has no transitions out of cancelled", () => {
    const t = ALLOWED_TRANSITIONS["cancelled"];
    assert.equal(Object.keys(t).length, 0);
  });
  it("has no transitions out of no_show", () => {
    const t = ALLOWED_TRANSITIONS["no_show"];
    assert.equal(Object.keys(t).length, 0);
  });
});

describe("TERMINAL_STATUSES", () => {
  it("contains completed, cancelled, and no_show", () => {
    assert.ok(TERMINAL_STATUSES.includes("completed"));
    assert.ok(TERMINAL_STATUSES.includes("cancelled"));
    assert.ok(TERMINAL_STATUSES.includes("no_show"));
    assert.equal(TERMINAL_STATUSES.length, 3);
  });
});
