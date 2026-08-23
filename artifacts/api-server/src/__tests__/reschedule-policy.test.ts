/**
 * Pure unit tests: consent-first rescheduling policy helpers.
 * No server or database required.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  computeProposalDeadline,
  getProviderProposalLimit,
  DEFAULT_PROVIDER_PROPOSAL_LIMIT,
} from "../lib/reschedule-policy.js";

const H = 60 * 60 * 1000;

describe("computeProposalDeadline", () => {
  it("uses appointment minus 48h when the appointment is far away", () => {
    const now = new Date("2030-04-01T12:00:00.000Z");
    const appt = new Date("2030-04-10T15:00:00.000Z");
    assert.equal(
      computeProposalDeadline(now, appt).getTime(),
      appt.getTime() - 48 * H,
    );
  });

  it("uses proposal plus 24h when the appointment is sooner than 48h", () => {
    const now = new Date("2030-04-01T12:00:00.000Z");
    const appt = new Date("2030-04-02T12:00:00.000Z"); // 24h away
    assert.equal(computeProposalDeadline(now, appt).getTime(), now.getTime() + 24 * H);
  });

  it("never sets a deadline after the appointment itself", () => {
    const now = new Date("2030-04-01T12:00:00.000Z");
    const appt = new Date("2030-04-01T20:00:00.000Z"); // 8h away
    assert.equal(computeProposalDeadline(now, appt).getTime(), appt.getTime());
  });

  it("is pure UTC-instant math — stable across a DST boundary", () => {
    // 2030-03-10 is a North-American spring-forward date; the deadline is an
    // exact 48h instant offset regardless of wall-clock shifts.
    const now = new Date("2030-03-01T12:00:00.000Z");
    const appt = new Date("2030-03-11T15:00:00.000Z");
    const deadline = computeProposalDeadline(now, appt);
    assert.equal(appt.getTime() - deadline.getTime(), 48 * H);
  });
});

describe("getProviderProposalLimit", () => {
  const original = process.env["RESCHEDULE_PROPOSAL_LIMIT"];
  beforeEach(() => {
    delete process.env["RESCHEDULE_PROPOSAL_LIMIT"];
  });
  afterEach(() => {
    if (original === undefined) delete process.env["RESCHEDULE_PROPOSAL_LIMIT"];
    else process.env["RESCHEDULE_PROPOSAL_LIMIT"] = original;
  });

  it("defaults to the documented limit", () => {
    assert.equal(getProviderProposalLimit(), DEFAULT_PROVIDER_PROPOSAL_LIMIT);
    assert.equal(DEFAULT_PROVIDER_PROPOSAL_LIMIT, 3);
  });

  it("honours a valid override", () => {
    process.env["RESCHEDULE_PROPOSAL_LIMIT"] = "5";
    assert.equal(getProviderProposalLimit(), 5);
  });

  it("falls back on invalid overrides (never a hidden zero limit)", () => {
    for (const bad of ["0", "-2", "abc", "1.5"]) {
      process.env["RESCHEDULE_PROPOSAL_LIMIT"] = bad;
      assert.equal(getProviderProposalLimit(), DEFAULT_PROVIDER_PROPOSAL_LIMIT);
    }
  });
});
