/**
 * Service-area eligibility and travel/setup buffer (roadmap #12).
 *
 * Canada-first, provider-managed postal-prefix (FSA) coverage. Eligibility
 * is SERVER-AUTHORITATIVE: the client is never trusted to decide it, and
 * every booking/rescheduling transition revalidates against the provider's
 * CURRENT active coverage. No geocoding, routing, radius, polygon, or
 * coordinate logic exists anywhere in this module — coverage is a
 * deterministic prefix rule, never a drive-time guarantee.
 *
 * Privacy: evaluation results expose ONLY a safe eligibility state, a safe
 * public message, and a small allowlisted reason code. Raw provider
 * coverage entries are never returned by public evaluation.
 */

import { and, eq } from "drizzle-orm";
import {
  db,
  providerServiceAreasTable,
  providerCoverageAreasTable,
} from "@workspace/db";

// Drizzle transaction handle type, derived from db.transaction's callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Query executor: the shared pool client or an open transaction. */
export type DbExecutor = typeof db | Tx;

// ── Eligibility states ────────────────────────────────────────────────────────

export const SERVICE_AREA_ELIGIBILITY_STATES = [
  "eligible",
  "ineligible",
  "needs_review",
  "invalid",
  "unavailable",
] as const;

export type ServiceAreaEligibilityState =
  (typeof SERVICE_AREA_ELIGIBILITY_STATES)[number];

/** Allowlisted, non-leaking machine reason codes (safe next-step metadata). */
export type ServiceAreaEligibilityReason =
  | "fsa_match"
  | "fsa_not_covered"
  | "country_not_served"
  | "province_mismatch"
  | "missing_location"
  | "malformed_postal_code"
  | "malformed_location"
  | "not_configured";

export interface ServiceAreaEligibilityResult {
  status: ServiceAreaEligibilityState;
  reason: ServiceAreaEligibilityReason;
}

/**
 * Approved client-facing copy, exact per the #12 specification. Plain
 * language, non-technical, and never reveals internal provider coverage.
 */
export const SERVICE_AREA_MESSAGES: Record<ServiceAreaEligibilityState, string> = {
  eligible: "Great — this provider serves your area. Choose a service and time.",
  ineligible:
    "This provider does not currently serve this area. Check the postal code or try another provider nearby.",
  needs_review:
    "We could not confirm this location yet. Check the postal code or contact the provider for service-area review before booking.",
  invalid:
    "Enter a valid Canadian postal code and location details to check service availability.",
  unavailable:
    "Online booking is not currently available for this provider\u2019s service area.",
};

// ── Country / province normalization ────────────────────────────────────────

/** Countries with functional enforcement in this release. */
export const SUPPORTED_COUNTRY_CODES = ["CA"] as const;

/** Normalize a country input to a supported ISO code, else null. */
export function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  if (value === "CA" || value === "CAN" || value === "CANADA") return "CA";
  return null;
}

/** Canonical Canadian provinces and territories. */
export const CANADIAN_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

const PROVINCE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CANADIAN_PROVINCES).map(([code, name]) => [
    name.toUpperCase(),
    code,
  ]),
);

/** Normalize a province input (code or full name) to a code, else null. */
export function normalizeProvinceCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (value in CANADIAN_PROVINCES) return value;
  if (value in PROVINCE_NAME_TO_CODE) return PROVINCE_NAME_TO_CODE[value]!;
  // Common aliases.
  if (value === "PEI") return "PE";
  if (value === "QUÉBEC") return "QC";
  return null;
}

// ── Canadian postal-code normalization ───────────────────────────────────────
//
// Canonical format after normalization: 6 characters, uppercase, no spaces,
// e.g. "M5V2T6". FSA = first three characters ("M5V"). Letter D, F, I, O,
// Q, U never appear; W and Z never appear as the FIRST letter.

const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$/;
const FSA_RE = /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z]$/;

/**
 * Normalize a Canadian postal code: strip whitespace/hyphens, uppercase,
 * validate. Returns the normalized 6-character code, or null when the
 * input is not a structurally valid Canadian postal code. Only the minimum
 * data required is validated — no private location details are inferred.
 */
export function normalizeCanadianPostalCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/[\s-]+/g, "").toUpperCase();
  return POSTAL_RE.test(value) ? value : null;
}

/** Derive the FSA (first three characters) from a NORMALIZED postal code. */
export function deriveFsa(normalizedPostalCode: string): string {
  return normalizedPostalCode.slice(0, 3);
}

/**
 * Normalize a provider-entered coverage prefix. Accepts a 3-character FSA
 * (e.g. "m5v", "M5V") or a full postal code (the FSA is derived). Returns
 * the normalized FSA, or null when malformed.
 */
export function normalizeFsaPrefix(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/[\s-]+/g, "").toUpperCase();
  if (FSA_RE.test(value)) return value;
  if (POSTAL_RE.test(value)) return value.slice(0, 3);
  return null;
}

/**
 * Deterministic FSA-first-letter → province/territory mapping (public
 * Canada Post regional assignment). Used ONLY as a consistency cross-check:
 * a mismatch between the stated province and the postal code's region
 * cannot be safely confirmed and becomes `needs_review` — never a guess.
 */
export const FSA_LETTER_PROVINCES: Record<string, readonly string[]> = {
  A: ["NL"],
  B: ["NS"],
  C: ["PE"],
  E: ["NB"],
  G: ["QC"],
  H: ["QC"],
  J: ["QC"],
  K: ["ON"],
  L: ["ON"],
  M: ["ON"],
  N: ["ON"],
  P: ["ON"],
  R: ["MB"],
  S: ["SK"],
  T: ["AB"],
  V: ["BC"],
  X: ["NT", "NU"],
  Y: ["YT"],
};

/** True when the stated province is consistent with the FSA's region. */
export function provinceConsistentWithFsa(
  provinceCode: string,
  fsa: string,
): boolean {
  const expected = FSA_LETTER_PROVINCES[fsa[0] ?? ""];
  return Boolean(expected && expected.includes(provinceCode));
}

// ── Eligibility evaluation (pure) ────────────────────────────────────────────

export interface ProviderCoverageSnapshot {
  /** Active configuration row, or null when the provider never configured. */
  config: {
    countryCode: string;
    provinceCode: string;
    city: string | null;
    publicDescription: string | null;
    isActive: boolean;
  } | null;
  /** Normalized ACTIVE FSA prefixes. */
  activePrefixes: string[];
}

export interface ClientLocationInput {
  country?: unknown;
  province?: unknown;
  city?: unknown;
  postalCode?: unknown;
}

/** True when the provider has usable, active coverage configuration. */
export function isCoverageConfigured(
  coverage: ProviderCoverageSnapshot,
): boolean {
  return Boolean(
    coverage.config &&
      coverage.config.isActive &&
      coverage.activePrefixes.length > 0,
  );
}

/**
 * Full public eligibility evaluation (country + province + postal code).
 * Pure and deterministic; used by the public service-area-check endpoints.
 *
 *  - `unavailable`: provider has no active coverage configuration.
 *  - `invalid`: required location input missing or malformed.
 *  - `needs_review`: structurally valid but cannot be safely confirmed
 *    (province/postal-region mismatch).
 *  - `ineligible`: confidently outside the provider's configured coverage.
 *  - `eligible`: FSA is in the provider's active coverage.
 */
export function evaluateServiceAreaEligibility(
  coverage: ProviderCoverageSnapshot,
  location: ClientLocationInput,
): ServiceAreaEligibilityResult {
  if (!isCoverageConfigured(coverage)) {
    return { status: "unavailable", reason: "not_configured" };
  }
  const config = coverage.config!;

  const hasCountry =
    typeof location.country === "string" && location.country.trim() !== "";
  const hasProvince =
    typeof location.province === "string" && location.province.trim() !== "";
  const hasPostal =
    typeof location.postalCode === "string" &&
    location.postalCode.trim() !== "";

  if (!hasCountry || !hasProvince || !hasPostal) {
    return { status: "invalid", reason: "missing_location" };
  }

  const country = normalizeCountryCode(location.country);
  if (!country) {
    // A recognizable non-Canadian country is confidently outside a
    // Canada-first coverage configuration; unrecognizable input is invalid.
    const raw = String(location.country).trim();
    return raw.length >= 2
      ? { status: "ineligible", reason: "country_not_served" }
      : { status: "invalid", reason: "malformed_location" };
  }
  if (country !== config.countryCode) {
    return { status: "ineligible", reason: "country_not_served" };
  }

  const province = normalizeProvinceCode(location.province);
  if (!province) {
    return { status: "invalid", reason: "malformed_location" };
  }

  const postal = normalizeCanadianPostalCode(location.postalCode);
  if (!postal) {
    return { status: "invalid", reason: "malformed_postal_code" };
  }
  const fsa = deriveFsa(postal);

  // Structurally valid but internally inconsistent: do not guess.
  if (!provinceConsistentWithFsa(province, fsa)) {
    return { status: "needs_review", reason: "province_mismatch" };
  }

  if (coverage.activePrefixes.includes(fsa)) {
    return { status: "eligible", reason: "fsa_match" };
  }
  return { status: "ineligible", reason: "fsa_not_covered" };
}

/**
 * Booking-write evaluation: the minimal deterministic rule applied at
 * booking/reschedule time from the booking's stored location fields (the
 * booking payload carries a postal code, not a country/province pair).
 *
 * When the provider has NO active coverage configuration, enforcement is
 * intentionally skipped (existing marketplace behavior preserved — see
 * docs/service-area-travel-policy.md). When coverage IS configured, the
 * postal code is required, must be a valid Canadian postal code, and its
 * FSA must be in the provider's ACTIVE coverage.
 */
export function evaluateBookingLocation(
  coverage: ProviderCoverageSnapshot,
  postalCode: unknown,
):
  | { enforced: false }
  | { enforced: true; result: ServiceAreaEligibilityResult } {
  if (!isCoverageConfigured(coverage)) {
    return { enforced: false };
  }
  if (typeof postalCode !== "string" || postalCode.trim() === "") {
    return {
      enforced: true,
      result: { status: "invalid", reason: "missing_location" },
    };
  }
  const postal = normalizeCanadianPostalCode(postalCode);
  if (!postal) {
    return {
      enforced: true,
      result: { status: "invalid", reason: "malformed_postal_code" },
    };
  }
  const fsa = deriveFsa(postal);
  if (coverage.activePrefixes.includes(fsa)) {
    return {
      enforced: true,
      result: { status: "eligible", reason: "fsa_match" },
    };
  }
  return {
    enforced: true,
    result: { status: "ineligible", reason: "fsa_not_covered" },
  };
}

// ── Coverage loading (owner + public read paths share this) ─────────────────

/** Load a provider's coverage snapshot with the given executor. */
export async function loadProviderCoverage(
  executor: DbExecutor,
  providerId: number,
): Promise<ProviderCoverageSnapshot> {
  const [configRow] = await executor
    .select({
      countryCode: providerServiceAreasTable.countryCode,
      provinceCode: providerServiceAreasTable.provinceCode,
      city: providerServiceAreasTable.city,
      publicDescription: providerServiceAreasTable.publicDescription,
      isActive: providerServiceAreasTable.isActive,
    })
    .from(providerServiceAreasTable)
    .where(eq(providerServiceAreasTable.providerId, providerId))
    .limit(1);

  const prefixRows = await executor
    .select({ prefix: providerCoverageAreasTable.prefix })
    .from(providerCoverageAreasTable)
    .where(
      and(
        eq(providerCoverageAreasTable.providerId, providerId),
        eq(providerCoverageAreasTable.isActive, true),
      ),
    );

  return {
    config: configRow ?? null,
    activePrefixes: prefixRows.map((r) => r.prefix),
  };
}

// ── Travel/setup buffer (centrally managed) ─────────────────────────────────
//
// Default 30 minutes between a provider's appointments — covers travel,
// setup, parking, and handoff time. Service duration stays separate from
// buffer duration. The buffer never alters existing confirmed bookings and
// never creates a maximum daily appointment limit. Provider-specific
// overrides are DEFERRED (docs/TODO-LEDGER.md); the value is centrally
// managed and visible to providers.

export const DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES = 30;
const MAX_TRAVEL_SETUP_BUFFER_MINUTES = 240;

export class InvalidTravelBufferError extends Error {
  constructor(value: string) {
    super(
      `TRAVEL_SETUP_BUFFER_MINUTES "${value}" must be an integer between 0 and ${MAX_TRAVEL_SETUP_BUFFER_MINUTES}.`,
    );
    this.name = "InvalidTravelBufferError";
  }
}

/**
 * Resolve the effective centrally managed travel/setup buffer in minutes.
 * Reads TRAVEL_SETUP_BUFFER_MINUTES when set (validated), otherwise the
 * approved 30-minute default. An invalid override throws — never a silent
 * fallback (same posture as MARKETPLACE_TIMEZONE).
 */
export function getTravelSetupBufferMinutes(): number {
  const override = process.env["TRAVEL_SETUP_BUFFER_MINUTES"];
  if (override === undefined || override.trim() === "") {
    return DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES;
  }
  const value = override.trim();
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_TRAVEL_SETUP_BUFFER_MINUTES
  ) {
    throw new InvalidTravelBufferError(value);
  }
  return parsed;
}

/** Where the effective buffer value came from (provider-visible metadata). */
export function getTravelSetupBufferSource(): "default" | "environment" {
  const override = process.env["TRAVEL_SETUP_BUFFER_MINUTES"];
  return override === undefined || override.trim() === ""
    ? "default"
    : "environment";
}

/**
 * True when two appointment intervals are closer together than the
 * required buffer (pure instant math — DST-safe because instants, not
 * wall-clock fields, are compared). Zero-gap back-to-back intervals
 * conflict whenever bufferMinutes > 0.
 */
export function intervalsConflictWithBuffer(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
  bufferMinutes: number,
): boolean {
  const bufferMs = bufferMinutes * 60000;
  return aStartMs < bEndMs + bufferMs && bStartMs < aEndMs + bufferMs;
}

// ── Shared write-path error copy ─────────────────────────────────────────────

/** 409 message when a requested time violates the travel/setup buffer. */
export const TRAVEL_BUFFER_CONFLICT_MESSAGE =
  "That time is too close to another appointment for this provider. Times need a travel and setup gap between visits — please choose another available time.";

/**
 * Reschedule-path message when the booking's stored location no longer
 * passes the provider's CURRENT coverage. The existing confirmed
 * appointment stays valid — only the change is blocked.
 */
export const RESCHEDULE_OUTSIDE_SERVICE_AREA_MESSAGE =
  "This appointment's location can't be confirmed against the provider's current service area, so the time can't be changed online. The existing appointment stays as scheduled — please contact the provider for help.";
