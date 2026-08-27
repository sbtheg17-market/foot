/**
 * Pilot window resolution (resolvePilotWindow) — pure unit tests.
 *
 * Covers: configured dates, absent dates, invalid dates, end-before-start,
 * single-sided configuration, no-bookings fallback, and the non-crashing
 * configWarning behavior. The function is pure so environment permutations
 * are tested directly without restarting the server.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePilotWindow } from "../lib/pilot-metrics.js";

const EARLIEST = new Date("2026-08-20T14:30:00.000Z");
const NOW = new Date("2026-09-02T10:00:00.000Z");

describe("resolvePilotWindow", () => {
  it("uses configured dates when both are valid and end > start", () => {
    const w = resolvePilotWindow("2026-08-27", "2026-10-01", EARLIEST, NOW);
    assert.deepEqual(w, {
      startDate: "2026-08-27",
      endDate: "2026-10-01",
      isProjected: false,
      configWarning: null,
    });
  });

  it("projects from the earliest booking (+5 weeks) when dates are absent, without a warning", () => {
    const w = resolvePilotWindow(undefined, undefined, EARLIEST, NOW);
    assert.equal(w.startDate, "2026-08-20");
    assert.equal(w.endDate, "2026-09-24"); // +35 days
    assert.equal(w.isProjected, true);
    assert.equal(w.configWarning, null);
  });

  it("projects from today when no bookings exist", () => {
    const w = resolvePilotWindow(undefined, undefined, null, NOW);
    assert.equal(w.startDate, "2026-09-02");
    assert.equal(w.endDate, "2026-10-07");
    assert.equal(w.isProjected, true);
  });

  it("falls back with a warning (never crashes) on invalid date formats", () => {
    for (const [s, e] of [
      ["08/27/2026", "10/01/2026"],
      ["2026-13-45", "2026-10-01"],
      ["not-a-date", "also-not"],
      ["2026-08-27T00:00:00Z", "2026-10-01"],
    ] as const) {
      const w = resolvePilotWindow(s, e, EARLIEST, NOW);
      assert.equal(w.isProjected, true, `${s}/${e} must project`);
      assert.ok(w.configWarning, `${s}/${e} must warn`);
      assert.equal(w.startDate, "2026-08-20");
    }
  });

  it("falls back with a warning when end is before or equal to start", () => {
    for (const [s, e] of [
      ["2026-10-01", "2026-08-27"],
      ["2026-08-27", "2026-08-27"],
    ] as const) {
      const w = resolvePilotWindow(s, e, EARLIEST, NOW);
      assert.equal(w.isProjected, true);
      assert.ok(w.configWarning);
    }
  });

  it("falls back with a warning when only one side is configured", () => {
    const onlyStart = resolvePilotWindow("2026-08-27", undefined, EARLIEST, NOW);
    assert.equal(onlyStart.isProjected, true);
    assert.ok(onlyStart.configWarning);
    const onlyEnd = resolvePilotWindow(undefined, "2026-10-01", null, NOW);
    assert.equal(onlyEnd.isProjected, true);
    assert.ok(onlyEnd.configWarning);
  });
});
