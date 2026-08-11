// Session token helpers — single source of truth for auth tokens.
const PATIENT_KEY = "cw_patient_token";
const PROVIDER_KEY = "cw_provider_token";

export const getToken = () => localStorage.getItem(PATIENT_KEY);
export const setToken = (token) => localStorage.setItem(PATIENT_KEY, token);
export const clearToken = () => localStorage.removeItem(PATIENT_KEY);

export const getProviderToken = () => localStorage.getItem(PROVIDER_KEY);
export const setProviderToken = (token) => localStorage.setItem(PROVIDER_KEY, token);
export const clearProviderToken = () => localStorage.removeItem(PROVIDER_KEY);
