import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { me, logout as apiLogout } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null, provider: null });

  const refresh = useCallback(async () => {
    try {
      const data = await me();
      setState({ status: "authed", user: data.user, provider: data.provider });
      return data;
    } catch {
      setState({ status: "anon", user: null, provider: null });
      return null;
    }
  }, []);

  useEffect(() => {
    // If we're mid auth-callback (hash contains session_id), let AuthCallback handle it first.
    if (window.location.hash?.includes("session_id=")) {
      setState((s) => ({ ...s, status: "loading" }));
      return;
    }
    refresh();
  }, [refresh]);

  const doLogout = async () => {
    try { await apiLogout(); } catch {}
    setState({ status: "anon", user: null, provider: null });
  };

  return (
    <AuthCtx.Provider value={{ ...state, refresh, logout: doLogout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
