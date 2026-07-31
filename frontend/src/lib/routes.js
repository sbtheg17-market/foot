/**
 * Canonical route map. Never hardcode paths across components.
 * Provider-only for now; client/admin path groups are placeholders
 * so future work has a single source of truth.
 */
export const ROUTES = {
  root: "/",
  auth: {
    login: "/login",
    signup: "/signup",
    onboarding: "/onboarding",
  },
  provider: {
    home: "/provider",
    services: "/provider/services",
    availability: "/provider/availability",
    bookings: "/provider/bookings",
    bookingDetail: (id) => `/provider/bookings/${id}`,
    earnings: "/provider/earnings",
    invoices: "/provider/invoices",
    invoiceDetail: (id) => `/provider/invoices/${id}`,
    reviews: "/provider/reviews",
    profile: "/provider/profile",
    settings: "/provider/settings",
    billing: "/provider/billing",
    verification: "/provider/verification",
  },
  // Reserved — not yet mounted. Do not link from visible nav.
  client: { root: "/client" },
  admin: { root: "/admin" },
};
