import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send session cookies cross-subdomain
});

// --- Auth ---
export const me = () => api.get("/auth/me").then((r) => r.data);
export const exchangeSession = (session_id) =>
  api.post("/auth/session", { session_id }).then((r) => r.data);
export const logout = () => api.post("/auth/logout").then((r) => r.data);

// --- Providers ---
export const listProviders = (params = {}) => api.get("/providers", { params }).then((r) => r.data);
export const getProvider = (id) => api.get(`/providers/${id}`).then((r) => r.data);
export const listServices = (id) => api.get(`/providers/${id}/services`).then((r) => r.data);
export const getAvailability = (id, days = 14) =>
  api.get(`/providers/${id}/availability`, { params: { days } }).then((r) => r.data);

// --- Bookings ---
export const createBooking = (payload) => api.post("/bookings", payload).then((r) => r.data);
export const listBookings = (params = {}) => api.get("/bookings", { params }).then((r) => r.data);
export const updateBookingStatus = (id, status) =>
  api.patch(`/bookings/${id}/status`, { status }).then((r) => r.data);

// --- Provider self ---
export const getEarnings = (id) => api.get(`/provider/${id}/earnings`).then((r) => r.data);
export const getOpportunities = (id) => api.get(`/provider/${id}/opportunities`).then((r) => r.data);
export const updateAvailability = (id, payload) =>
  api.patch(`/provider/${id}/availability`, payload).then((r) => r.data);
export const providerSignup = (payload) => api.post("/provider/self-signup", payload).then((r) => r.data);
export const uploadDoc = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/provider/upload-doc", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

// --- Admin ---
export const adminListProviders = (params = {}) =>
  api.get("/admin/providers", { params }).then((r) => r.data);
export const adminSetProviderStatus = (id, status) =>
  api.patch(`/admin/providers/${id}/status`, { status }).then((r) => r.data);
export const adminToggleListing = (id, listing_active) =>
  api.patch(`/admin/providers/${id}/listing-active`, { listing_active }).then((r) => r.data);
export const adminRevenue = (window = "weekly") =>
  api.get("/admin/revenue", { params: { window } }).then((r) => r.data);

// --- Payments ---
export const paymentStatus = (session_id) =>
  api.get(`/payments/status/${session_id}`).then((r) => r.data);

// --- Analytics ---
export const trackSearch = (payload) => api.post("/analytics/search", payload).catch(() => {});

// --- Reviews ---
export const listReviews = (providerId) => api.get(`/providers/${providerId}/reviews`).then((r) => r.data);
export const getBookingReview = (bookingId) => api.get(`/bookings/${bookingId}/review`).then((r) => r.data);
export const createReview = (payload) => api.post("/reviews", payload).then((r) => r.data);

// --- Stripe Connect (payouts) ---
export const connectOnboard = (providerId, origin_url) =>
  api.post(`/provider/${providerId}/connect/onboard`, { origin_url }).then((r) => r.data);
export const connectStatus = (providerId) =>
  api.get(`/provider/${providerId}/connect/status`).then((r) => r.data);

// --- Plans (subscriptions) ---
export const listPlans = () => api.get("/plans").then((r) => r.data);
export const planCheckout = (providerId, plan, origin_url) =>
  api.post(`/provider/${providerId}/plan/checkout`, { plan, origin_url }).then((r) => r.data);

// --- Utils ---
export const cents = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;
export const pct = (r) => `${Math.round(Number(r || 0) * 100)}%`;
