// Session token helpers — single source of truth for the patient token.
const KEY = "cw_patient_token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (token) => localStorage.setItem(KEY, token);
export const clearToken = () => localStorage.removeItem(KEY);
