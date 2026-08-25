/**
 * Service-area + travel/setup buffer — pure unit coverage (roadmap #12).
 *
 * No database, no server: postal/FSA/province normalization, deterministic
 * eligibility evaluation for every state, centrally managed buffer
 * resolution, and instant-based buffer conflict math (including DST
 * spring-forward / fall-back instants — the math is instant-based, so
 * wall-clock transitions must never change outcomes).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_AREA_MESSAGES,
  SERVICE_AREA_ELIGIBILITY_STATES,
  DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES,
  InvalidTravelBufferError,
  deriveFsa,
  evaluateServiceAreaEligibility,
  evaluateBookingLocation,
  getTravelSetupBufferMinutes,
  getTravelSetupBufferSource,
  intervalsConflictWithBuffer,
  isCoverageConfigured,
  normalizeCanadianPostalCode,
  normalizeCountryCode,
  normalizeFsaPrefix,
  normalizeProvinceCode,
  provinceConsistentWithFsa,
  type ProviderCoverageSnapshot,
} from "../lib/service-area.js";

// ── Postal-code normalization ──────────────────────────────────────────────

describe("normalizeCanadianPostalCode", () => {
  it("uppercases and removes interior whitespace", () => {
    assert.equal(normalizeCanadianPostalCode("m5v 2t6"), "M5V2T6");
    assert.equal(normalizeCanadianPostalCode("  M5V  2T6  "), "M5V2T6");
    assert.equal(normalizeCanadianPostalCode("m5v-2t6"), "M5V2T6");
  });

  it("accepts already-normalized codes", () => {
    assert.equal(normalizeCanadianPostalCode("K1A0B1"), "K1A0B1");
  });

  it("rejects malformed input safely", () => {
    for (const bad of [
      "",
      "12345",
      "M5V",
      "M5V 2T",
      "M5V 2T66",
      "D5V 2T6", // D never appears in Canadian postal codes
      "W5V 2T6", // W invalid as the first letter
      "Z5V 2T6", // Z invalid as the first letter
      "MFV 2T6", // F invalid anywhere
      "90210",
      "SW1A 1AA", // UK format
      "M5V 2T!",
      null,
      undefined,
      42,
      { postal: "M5V2T6" },
    ]) {
      assert.equal(normalizeCanadianPostalCode(bad as never), null, String(bad));
    }
  });

  it("allows W and Z in non-first letter positions", () => {
    assert.equal(normalizeCanadianPostalCode("M5W 1E6"), "M5W1E6");
    assert.equal(normalizeCanadianPostalCode("V0Z 1A0"), "V0Z1A0");
  });
});

describe("deriveFsa / normalizeFsaPrefix", () => {
  it("derives the first three characters", () => {
    assert.equal(deriveFsa("M5V2T6"), "M5V");
  });

  it("normalizes a bare FSA (case + whitespace)", () => {
    assert.equal(normalizeFsaPrefix(" m5v "), "M5V");
    assert.equal(normalizeFsaPrefix("K1A"), "K1A");
  });

  it("derives the FSA from a full postal code", () => {
    assert.equal(normalizeFsaPrefix("m5v 2t6"), "M5V");
  });

  it("rejects malformed prefixes", () => {
    for (const bad of ["", "M5", "5MV", "MMM", "123", "D5V", "W1A", null, 7]) {
      assert.equal(normalizeFsaPrefix(bad as never), null, String(bad));
    }
  });
});

// ── Country / province ───────────────────────────────────────────────────────

describe("country and province normalization", () => {
  it("normalizes Canada variants", () => {
    assert.equal(normalizeCountryCode("ca"), "CA");
    assert.equal(normalizeCountryCode("Canada"), "CA");
    assert.equal(normalizeCountryCode(" CAN "), "CA");
  });

  it("returns null for unsupported countries", () => {
    assert.equal(normalizeCountryCode("US"), null);
    assert.equal(normalizeCountryCode("France"), null);
    assert.equal(normalizeCountryCode(""), null);
  });

  it("normalizes province codes and full names", () => {
    assert.equal(normalizeProvinceCode("on"), "ON");
    assert.equal(normalizeProvinceCode("Ontario"), "ON");
    assert.equal(normalizeProvinceCode("british  columbia"), "BC");
    assert.equal(normalizeProvinceCode("PEI"), "PE");
  });

  it("rejects unknown provinces", () => {
    assert.equal(normalizeProvinceCode("ZZ"), null);
    assert.equal(normalizeProvinceCode("Texas"), null);
  });

  it("cross-checks FSA region against province", () => {
    assert.equal(provinceConsistentWithFsa("ON", "M5V"), true);
    assert.equal(provinceConsistentWithFsa("BC", "M5V"), false);
    assert.equal(provinceConsistentWithFsa("NT", "X0A"), true);
    assert.equal(provinceConsistentWithFsa("NU", "X0A"), true);
  });
});

// ── Eligibility evaluation ──────────────────────────────────────────────────

const COVERAGE: ProviderCoverageSnapshot = {
  config: {
    countryCode: "CA",
    provinceCode: "ON",
    city: "Toronto",
    publicDescription: "Serving downtown Toronto",
    isActive: true,
  },
  activePrefixes: ["M5V", "M4C"],
};

const LOCATION = {
  country: "Canada",
  province: "Ontario",
  city: "Toronto",
  postalCode: "m5v 2t6",
};

describe("evaluateServiceAreaEligibility", () => {
  it("exposes exactly the five approved states with messages", () => {
    assert.deepEqual(
      [...SERVICE_AREA_ELIGIBILITY_STATES],
      ["eligible", "ineligible", "needs_review", "invalid", "unavailable"],
    );
    for (const state of SERVICE_AREA_ELIGIBILITY_STATES) {
      assert.ok(SERVICE_AREA_MESSAGES[state].length > 10, state);
    }
  });

  it("eligible: FSA match with consistent province", () => {
    assert.deepEqual(evaluateServiceAreaEligibility(COVERAGE, LOCATION), {
      status: "eligible",
      reason: "fsa_match",
    });
  });

  it("ineligible: valid FSA outside coverage", () => {
    assert.deepEqual(
      evaluateServiceAreaEligibility(COVERAGE, {
        ...LOCATION,
        postalCode: "M6K 3P6",
      }),
      { status: "ineligible", reason: "fsa_not_covered" },
    );
  });

  it("ineligible: another country cannot match Canada-first coverage", () => {
    assert.deepEqual(
      evaluateServiceAreaEligibility(COVERAGE, {
        ...LOCATION,
        country: "US",
        postalCode: "M5V 2T6",
      }),
      { status: "ineligible", reason: "country_not_served" },
    );
  });

  it("needs_review: province inconsistent with the postal region", () => {
    assert.deepEqual(
      evaluateServiceAreaEligibility(COVERAGE, {
        ...LOCATION,
        province: "BC",
      }),
      { status: "needs_review", reason: "province_mismatch" },
    );
  });

  it("invalid: missing or malformed required fields", () => {
    assert.equal(
      evaluateServiceAreaEligibility(COVERAGE, { ...LOCATION, postalCode: "" })
        .status,
      "invalid",
    );
    assert.equal(
      evaluateServiceAreaEligibility(COVERAGE, {
        ...LOCATION,
        postalCode: "12345",
      }).status,
      "invalid",
    );
    assert.equal(
      evaluateServiceAreaEligibility(COVERAGE, { ...LOCATION, province: "ZZ" })
        .status,
      "invalid",
    );
    assert.equal(
      evaluateServiceAreaEligibility(COVERAGE, {
        country: undefined,
        province: "ON",
        postalCode: "M5V 2T6",
      }).status,
      "invalid",
    );
  });

  it("unavailable: no configuration, inactive configuration, or no prefixes", () => {
    assert.equal(
      evaluateServiceAreaEligibility(
        { config: null, activePrefixes: [] },
        LOCATION,
      ).status,
      "unavailable",
    );
    assert.equal(
      evaluateServiceAreaEligibility(
        { config: { ...COVERAGE.config!, isActive: false }, activePrefixes: ["M5V"] },
        LOCATION,
      ).status,
      "unavailable",
    );
    assert.equal(
      evaluateServiceAreaEligibility(
        { config: COVERAGE.config, activePrefixes: [] },
        LOCATION,
      ).status,
      "unavailable",
    );
  });

  it("isCoverageConfigured mirrors the unavailable rule", () => {
    assert.equal(isCoverageConfigured(COVERAGE), true);
    assert.equal(isCoverageConfigured({ config: null, activePrefixes: [] }), false);
  });
});

describe("evaluateBookingLocation (write-path rule)", () => {
  it("is not enforced for unconfigured providers (legacy behavior)", () => {
    assert.deepEqual(
      evaluateBookingLocation({ config: null, activePrefixes: [] }, "M5V 2T6"),
      { enforced: false },
    );
  });

  it("requires a valid covered postal code once configured", () => {
    const eligible = evaluateBookingLocation(COVERAGE, "m5v2t6");
    assert.ok(eligible.enforced && eligible.result.status === "eligible");

    const outside = evaluateBookingLocation(COVERAGE, "V6B 1A1");
    assert.ok(outside.enforced && outside.result.status === "ineligible");

    const missing = evaluateBookingLocation(COVERAGE, undefined);
    assert.ok(missing.enforced && missing.result.status === "invalid");

    const malformed = evaluateBookingLocation(COVERAGE, "nope");
    assert.ok(malformed.enforced && malformed.result.status === "invalid");
  });
});

// ── Travel/setup buffer ─────────────────────────────────────────────────────

describe("getTravelSetupBufferMinutes", () => {
  const KEY = "TRAVEL_SETUP_BUFFER_MINUTES";
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
    delete process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it("defaults to the approved 30 minutes", () => {
    assert.equal(getTravelSetupBufferMinutes(), 30);
    assert.equal(DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES, 30);
    assert.equal(getTravelSetupBufferSource(), "default");
  });

  it("accepts a validated central override", () => {
    process.env[KEY] = "45";
    assert.equal(getTravelSetupBufferMinutes(), 45);
    assert.equal(getTravelSetupBufferSource(), "environment");
    process.env[KEY] = "0";
    assert.equal(getTravelSetupBufferMinutes(), 0);
  });

  it("throws on an invalid override — never a silent fallback", () => {
    for (const bad of ["-5", "abc", "30.5", "9999"]) {
      process.env[KEY] = bad;
      assert.throws(() => getTravelSetupBufferMinutes(), InvalidTravelBufferError, bad);
    }
  });
});

describe("intervalsConflictWithBuffer (instant math)", () => {
  const MIN = 60000;
  const t0 = Date.UTC(2027, 5, 14, 14, 0); // arbitrary base instant

  it("blocks back-to-back and near appointments; allows a full-gap start", () => {
    const aStart = t0;
    const aEnd = t0 + 60 * MIN; // 60-minute service
    // Back-to-back (0-minute gap) conflicts with a 30-minute buffer.
    assert.equal(
      intervalsConflictWithBuffer(aEnd, aEnd + 60 * MIN, aStart, aEnd, 30),
      true,
    );
    // 29-minute gap conflicts.
    assert.equal(
      intervalsConflictWithBuffer(aEnd + 29 * MIN, aEnd + 89 * MIN, aStart, aEnd, 30),
      true,
    );
    // Exactly 30-minute gap is allowed (buffer satisfied).
    assert.equal(
      intervalsConflictWithBuffer(aEnd + 30 * MIN, aEnd + 90 * MIN, aStart, aEnd, 30),
      false,
    );
    // Same rule looking backwards (new appointment before the existing one).
    assert.equal(
      intervalsConflictWithBuffer(aStart - 90 * MIN, aStart - 30 * MIN, aStart, aEnd, 30),
      false,
    );
    assert.equal(
      intervalsConflictWithBuffer(aStart - 89 * MIN, aStart - 29 * MIN, aStart, aEnd, 30),
      true,
    );
  });

  it("a zero buffer reduces to plain overlap", () => {
    const aStart = t0;
    const aEnd = t0 + 60 * MIN;
    assert.equal(intervalsConflictWithBuffer(aEnd, aEnd + 30 * MIN, aStart, aEnd, 0), false);
    assert.equal(intervalsConflictWithBuffer(aStart + MIN, aEnd, aStart, aEnd, 0), true);
  });

  it("service duration stays separate from buffer duration", () => {
    // 30-minute service + 30-minute buffer: next valid start is exactly
    // start + 60 minutes, not start + 30 and not start + 90.
    const aStart = t0;
    const aEnd = t0 + 30 * MIN;
    assert.equal(
      intervalsConflictWithBuffer(aStart + 30 * MIN, aStart + 60 * MIN, aStart, aEnd, 30),
      true,
    );
    assert.equal(
      intervalsConflictWithBuffer(aStart + 60 * MIN, aStart + 90 * MIN, aStart, aEnd, 30),
      false,
    );
  });

  it("DST spring-forward: instants, not wall clocks, decide conflicts", () => {
    // America/Toronto 2027-03-14: 02:00 EST jumps to 03:00 EDT.
    // 01:30 EST = 06:30Z; the next wall-clock slot 03:30 EDT = 07:30Z is
    // only 60 real minutes later.
    const aStart = Date.UTC(2027, 2, 14, 6, 30); // 01:30 EST
    const aEnd = aStart + 60 * MIN; // 03:30 EDT wall clock (07:30Z)
    const bStart = Date.UTC(2027, 2, 14, 7, 30); // 03:30 EDT — back-to-back in real time
    assert.equal(
      intervalsConflictWithBuffer(bStart, bStart + 60 * MIN, aStart, aEnd, 30),
      true,
    );
    // 30 real minutes after the end — allowed, regardless of the clock jump.
    const cStart = aEnd + 30 * MIN;
    assert.equal(
      intervalsConflictWithBuffer(cStart, cStart + 60 * MIN, aStart, aEnd, 30),
      false,
    );
  });

  it("DST fall-back: repeated wall-clock hour cannot fake a gap", () => {
    // America/Toronto 2027-11-07: 02:00 EDT falls back to 01:00 EST.
    // 01:30 EDT = 05:30Z and 01:30 EST = 06:30Z are DIFFERENT instants one
    // real hour apart even though the wall clock repeats.
    const aStart = Date.UTC(2027, 10, 7, 5, 30); // 01:30 EDT
    const aEnd = aStart + 30 * MIN; // 30-minute service
    const bStart = Date.UTC(2027, 10, 7, 6, 30); // 01:30 EST (same wall clock)
    // Real gap is 30 minutes — exactly the buffer — allowed.
    assert.equal(
      intervalsConflictWithBuffer(bStart, bStart + 30 * MIN, aStart, aEnd, 30),
      false,
    );
    // One real minute earlier violates the buffer.
    assert.equal(
      intervalsConflictWithBuffer(bStart - MIN, bStart + 29 * MIN, aStart, aEnd, 30),
      true,
    );
  });
});
