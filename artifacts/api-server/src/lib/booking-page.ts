/**
 * Provider public booking page primitives (roadmap #11).
 *
 * Slug policy (approved defaults): lowercase kebab-case, 3–64 characters,
 * globally unique, generated from the provider display name with a
 * deterministic safe suffix on collision. Slugs are not provider-editable
 * after publishing in this release.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 64;

/** Lowercase kebab-case, 3–64 chars, no leading/trailing hyphen. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function isValidBookingPageSlug(raw: string): boolean {
  return (
    raw.length >= SLUG_MIN_LENGTH &&
    raw.length <= SLUG_MAX_LENGTH &&
    SLUG_RE.test(raw)
  );
}

/** Deterministic kebab-case base slug from a display name. Never empty. */
export function slugifyDisplayName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  if (base.length >= SLUG_MIN_LENGTH) return base;
  return `${base}-provider`.replace(/^-+/, "").slice(0, SLUG_MAX_LENGTH);
}

/** Deterministic collision suffix: base, base-2, base-3, … (length-safe). */
export function slugCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

/**
 * Allowlisted acquisition-source attribution values. Attribution is optional,
 * privacy-safe metadata only — it is never trusted for authorization or
 * pricing, and arbitrary user-provided values are dropped, never stored.
 */
export const BOOKING_ATTRIBUTION_SOURCES = [
  "instagram",
  "qr-card",
  "text",
  "facebook",
  "website",
] as const;

export type BookingAttributionSource =
  (typeof BOOKING_ATTRIBUTION_SOURCES)[number];

/** Normalize + allowlist an attribution value; anything else becomes null. */
export function normalizeBookingSource(raw: unknown): BookingAttributionSource | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (BOOKING_ATTRIBUTION_SOURCES as readonly string[]).includes(value)
    ? (value as BookingAttributionSource)
    : null;
}
