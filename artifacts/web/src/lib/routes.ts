/**
 * Centralized route constants for the web app.
 *
 * Provider-first: the provider portal is the primary experience and lives
 * under the canonical `/provider/*` prefix.
 *
 * Client marketplace and admin verification routes are active alongside the
 * provider portal. The legacy `/portal/*` prefix is preserved via redirects
 * (see App.tsx) so old links keep working.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  register: '/register',
  onboarding: {
    client: '/onboarding/client',
    provider: '/onboarding/provider',
  },

  // ── Provider portal (canonical) ──────────────────────────────────────────
  provider: {
    root: '/provider',
    dashboard: '/provider/dashboard',
    bookings: '/provider/bookings',
    services: '/provider/services',
    availability: '/provider/availability',
    earnings: '/provider/earnings',
    earningsStatement: '/provider/earnings/statement',
    profile: '/provider/profile',
    credentials: '/provider/credentials',
    notifications: '/provider/notifications',
    readiness: '/provider/readiness',
    listingPreview: '/provider/listing-preview',
    travelZones: '/provider/travel-zones',
    serviceArea: '/provider/service-area',
    applicationStatus: '/provider/application-status',
  },

  // ── Client marketplace ─────────────────────────────────────────────────────
  client: {
    discover: '/discover',
    provider: (id: number | string) => `/providers/${id}`,
    bookings: '/bookings',
    booking: (id: number | string) => `/bookings/${id}`,
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  admin: {
    verification: '/admin/verification',
    // Platform-administrator-only pilot operations dashboard (Part 2).
    pilot: '/admin/pilot',
  },

  // ── Provider-owned public booking page (roadmap #11) ─────────────────────────
  publicBooking: {
    page: (slug: string) => `/book/${slug}`,
  },
} as const;

/**
 * Canonical public listing path for a provider: `/providers/:providerId`.
 * This is the marketplace-discovery share target (id-based). The
 * provider-owned public booking page lives at `/book/:providerSlug`
 * (see publicBookingPagePath) — the two surfaces stay distinct.
 */
export function publicListingPath(providerId: number | string): string {
  return ROUTES.client.provider(providerId);
}

/**
 * Absolute canonical public listing URL (SSR-safe: falls back to the
 * path when `window` is unavailable). Never carries private data.
 */
export function publicListingUrl(providerId: number | string): string {
  const path = publicListingPath(providerId);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

/**
 * Canonical provider-owned public booking page path: `/book/:providerSlug`.
 * One page per provider; derives from the same source of truth as the
 * marketplace. Never carries private data.
 */
export function publicBookingPagePath(slug: string): string {
  return ROUTES.publicBooking.page(slug);
}

/**
 * Absolute canonical public booking page URL (SSR-safe). Optionally appends
 * an allowlisted `source` attribution parameter (e.g. `qr-card`).
 */
export function publicBookingPageUrl(slug: string, source?: string): string {
  const path = publicBookingPagePath(slug);
  const suffix = source ? `?source=${encodeURIComponent(source)}` : '';
  if (typeof window === 'undefined') return `${path}${suffix}`;
  return `${window.location.origin}${path}${suffix}`;
}

/** Legacy `/portal/*` → canonical `/provider/*` redirect map. */
export const LEGACY_PORTAL_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: '/portal', to: ROUTES.provider.dashboard },
  { from: '/portal/bookings', to: ROUTES.provider.bookings },
  { from: '/portal/services', to: ROUTES.provider.services },
  { from: '/portal/availability', to: ROUTES.provider.availability },
  { from: '/portal/earnings', to: ROUTES.provider.earnings },
  { from: '/portal/profile', to: ROUTES.provider.profile },
  { from: '/portal/credentials', to: ROUTES.provider.credentials },
];
