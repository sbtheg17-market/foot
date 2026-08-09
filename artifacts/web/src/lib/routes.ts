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
    dashboard: '/provider',
    bookings: '/provider/bookings',
    services: '/provider/services',
    availability: '/provider/availability',
    earnings: '/provider/earnings',
    earningsStatement: '/provider/earnings/statement',
    profile: '/provider/profile',
    credentials: '/provider/credentials',
    notifications: '/provider/notifications',
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
  },
} as const;

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
