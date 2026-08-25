/**
 * Canadian location helpers for service-area UX (roadmap #12).
 *
 * Client-side conveniences ONLY — the server is authoritative for every
 * eligibility decision. No coordinates, geocoding, or routing.
 */

export const CANADIAN_PROVINCES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

/** Province code → display name. */
export function provinceName(code: string | null | undefined): string | null {
  if (!code) return null;
  return CANADIAN_PROVINCES.find((p) => p.code === code)?.name ?? code;
}

/**
 * Light client-side shape check for a Canadian postal code (UX hint only;
 * the server re-normalizes and re-validates every submission).
 */
export function looksLikeCanadianPostalCode(raw: string): boolean {
  return /^[A-Za-z]\d[A-Za-z][\s-]?\d[A-Za-z]\d$/.test(raw.trim());
}

/**
 * Approved client-facing copy for the `unavailable` state — shown when a
 * page has no active coverage configuration (mirrors the server message).
 */
export const SERVICE_AREA_UNAVAILABLE_MESSAGE =
  'Online booking is not currently available for this provider\u2019s service area.';
