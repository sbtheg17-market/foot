export const HOME = {
  emergentLink: "home-emergent-link",
};

export const LANDING = {
  root: "landing-root",
  ctaClient: "landing-cta-client",
  ctaProvider: "landing-cta-provider",
  ctaAdmin: "landing-cta-admin",
};

export const CLIENT = {
  home: "client-home",
  searchInput: "client-search-input",
  filterCity: "client-filter-city",
  filterCategory: "client-filter-category",
  filterSenior: "client-filter-senior",
  filterVerified: "client-filter-verified",
  providerGrid: "client-provider-grid",
  providerCard: (id) => `client-provider-card-${id}`,
  providerCardBook: (id) => `client-provider-card-book-${id}`,
  bookingsLink: "client-bookings-link",
  bookingsList: "client-bookings-list",
  bookingRow: (id) => `client-booking-row-${id}`,
};

export const PROFILE = {
  root: "provider-profile",
  services: "provider-profile-services",
  serviceRow: (id) => `provider-profile-service-${id}`,
  bookNowBtn: "provider-profile-book-now",
  timePicker: "provider-profile-time-picker",
  daySlot: (iso) => `provider-profile-day-${iso}`,
  timeSlot: (iso) => `provider-profile-time-${iso}`,
  formName: "booking-form-name",
  formEmail: "booking-form-email",
  formNotes: "booking-form-notes",
  formSubmit: "booking-form-submit",
  confirmScreen: "booking-confirm-screen",
};

export const PROVIDER = {
  dash: "provider-dashboard",
  identityPicker: "provider-identity-picker",
  tabBookings: "provider-tab-bookings",
  tabEarnings: "provider-tab-earnings",
  tabAvailability: "provider-tab-availability",
  bookingRow: (id) => `provider-booking-${id}`,
  acceptBtn: (id) => `provider-booking-accept-${id}`,
  declineBtn: (id) => `provider-booking-decline-${id}`,
  completeBtn: (id) => `provider-booking-complete-${id}`,
  earnings: "provider-earnings-widget",
  availSaveBtn: "provider-availability-save",
  availLeadInput: "provider-availability-lead",
  availDay: (day) => `provider-availability-day-${day}`,
  availDayStart: (day) => `provider-availability-day-${day}-start`,
  availDayEnd: (day) => `provider-availability-day-${day}-end`,
  availBlockedInput: "provider-availability-blocked-input",
  availBlockedAdd: "provider-availability-blocked-add",
  availTravelCity: "provider-availability-travel-city",
  availTravelRadius: "provider-availability-travel-radius",
};

export const ADMIN = {
  root: "admin-root",
  tabQueue: "admin-tab-queue",
  tabListings: "admin-tab-listings",
  tabRevenue: "admin-tab-revenue",
  queueRow: (id) => `admin-queue-row-${id}`,
  approveBtn: (id) => `admin-approve-${id}`,
  rejectBtn: (id) => `admin-reject-${id}`,
  docLink: (id, idx) => `admin-doc-${id}-${idx}`,
  listingRow: (id) => `admin-listing-row-${id}`,
  listingToggle: (id) => `admin-listing-toggle-${id}`,
  revenueWindow: "admin-revenue-window",
  revenueStats: "admin-revenue-stats",
};
