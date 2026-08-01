import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { exchangeSession } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LoadingBlock, ErrorBlock } from "../components/States";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setError(new Error("Missing session_id"));
      return;
    }
    (async () => {
      try {
        await exchangeSession(sessionId);
        // Clear the hash so we don't loop
        window.history.replaceState({}, "", window.location.pathname);
        const data = await refresh();
        // Route by role for a natural first-touch experience
        if (data?.user?.role === "admin") navigate("/admin", { replace: true });
        else if (data?.user?.role === "provider") navigate("/provider", { replace: true });
        else navigate("/", { replace: true });
      } catch (e) {
        setError(e);
      }
    })();
  }, [location.hash, navigate, refresh]);

  if (error) return <ErrorBlock error={error} retry={() => navigate("/login", { replace: true })} />;
  return <LoadingBlock label="Signing you in…" />;
}
