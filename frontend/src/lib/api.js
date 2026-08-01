import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE });

// --- Providers ---
export const listProviders = (params = {}) =>
  api.get("/providers", { params }).then((r) => r.data);

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
export const getEarnings = (providerId) =>
  api.get(`/provider/${providerId}/earnings`).then((r) => r.data);
export const updateAvailability = (providerId, payload) =>
  api.patch(`/provider/${providerId}/availability`, payload).then((r) => r.data);

// --- Admin ---
export const adminListProviders = (params = {}) =>
  api.get("/admin/providers", { params }).then((r) => r.data);
export const adminSetProviderStatus = (id, status) =>
  api.patch(`/admin/providers/${id}/status`, { status }).then((r) => r.data);
export const adminToggleListing = (id, listing_active) =>
  api.patch(`/admin/providers/${id}/listing-active`, { listing_active }).then((r) => r.data);
export const adminRevenue = (window = "weekly") =>
  api.get("/admin/revenue", { params: { window } }).then((r) => r.data);

// --- Utils ---
export const cents = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;
export const pct = (r) => `${Math.round(Number(r || 0) * 100)}%`;
