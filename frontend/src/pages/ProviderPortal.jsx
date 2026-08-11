import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Stethoscope, Search, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProviderComfortCard from "@/components/comfort-profile/ProviderComfortCard";
import {
  getProviderToken,
  setProviderToken,
  clearProviderToken,
} from "@/lib/session";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * ProviderPortal — provider sign-in gate + consent-gated projection lookup.
 *
 * - Providers authenticate with real accounts (Bearer); the X-Provider-Id header
 *   stub is no longer used by the UI (dev-flag-confined on the backend).
 * - The CONTAINER fetches; ProviderComfortCard stays pure presentation and
 *   renders NOTHING when the projection is null (404-only design).
 * - HARDENED LOGOUT: provider token cleared in `finally` regardless of the
 *   request outcome, with clear feedback.
 */
export default function ProviderPortal() {
  const [provider, setProvider] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState(null); // {tone: 'info'|'warn', text}

  // auth form state
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // lookup state
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [projection, setProjection] = useState(null);
  const [message, setMessage] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const authed = useCallback(
    () => ({ headers: { Authorization: `Bearer ${getProviderToken()}` } }),
    []
  );

  const handleExpired = useCallback(() => {
    clearProviderToken();
    setProvider(null);
    setProjection(null);
    setSearched(false);
    setNotice({ tone: "warn", text: "Session expired — please sign in again." });
  }, []);

  useEffect(() => {
    const boot = async () => {
      if (!getProviderToken()) {
        setChecking(false);
        return;
      }
      try {
        const res = await axios.get(`${API}/auth/provider/me`, {
          headers: { Authorization: `Bearer ${getProviderToken()}` },
        });
        setProvider(res.data.provider);
      } catch {
        clearProviderToken();
      } finally {
        setChecking(false);
      }
    };
    boot();
  }, []);

  const submitAuth = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/auth/provider/login" : "/auth/provider/register";
      const payload =
        mode === "login" ? { email, password } : { email, password, name };
      const res = await axios.post(`${API}${path}`, payload);
      setProviderToken(res.data.token);
      setProvider(res.data.provider);
      setNotice(null);
      toast.success(mode === "login" ? "Signed in." : "Provider account created.");
    } catch (err) {
      const s = err.response?.status;
      if (s === 401) setError("Invalid email or password.");
      else if (s === 409) setError("An account with this email already exists.");
      else if (s === 400) setError(err.response?.data?.detail || "Please check your details.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // HARDENED SIGN-OUT: local token ALWAYS cleared, success or failure.
  const signOut = async () => {
    setSigningOut(true);
    try {
      await axios.post(`${API}/auth/logout`, null, authed());
    } catch {
      // Swallow — finally guarantees local sign-out either way.
    } finally {
      clearProviderToken();
      setProvider(null);
      setProjection(null);
      setSearched(false);
      setSigningOut(false);
      setNotice({ tone: "info", text: "You’ve been signed out." });
    }
  };

  const lookup = async () => {
    if (!patientId.trim()) {
      setMessage("Enter the patient ID.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setProjection(null);
    setSearched(false);
    try {
      const res = await axios.get(
        `${API}/provider/comfort-projection/${encodeURIComponent(patientId.trim())}`,
        authed()
      );
      setProjection(res.data.projection);
    } catch (e) {
      if (e.response?.status === 404) {
        setProjection(null); // 404-only: card renders nothing
      } else if (e.response?.status === 401) {
        handleExpired();
        return;
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-left">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
              <Stethoscope className="text-indigo-600" size={22} />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Provider portal</h1>
              <p className="text-sm text-slate-500">
                {provider
                  ? "View comfort preferences a patient has chosen to share"
                  : "Sign in to view shared comfort preferences"}
              </p>
            </div>
          </div>
          {provider && (
            <Button
              data-testid="provider-portal-signout-btn"
              variant="outline"
              onClick={signOut}
              disabled={signingOut}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              {signingOut ? (
                <Loader2 size={16} className="mr-1.5 animate-spin" />
              ) : (
                <LogOut size={16} className="mr-1.5" />
              )}
              Sign out
            </Button>
          )}
        </header>

        {notice && (
          <div
            data-testid="provider-portal-notice"
            className={
              "rounded-lg border px-4 py-2.5 text-sm " +
              (notice.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-teal-200 bg-teal-50 text-teal-800")
            }
          >
            {notice.text}
          </div>
        )}

        {!provider ? (
          <form
            onSubmit={submitAuth}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
              {[
                ["login", "Sign in"],
                ["register", "Create account"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`provider-auth-mode-${value}`}
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (mode === value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="prov-name">
                  Name
                </label>
                <Input
                  id="prov-name"
                  data-testid="provider-auth-name"
                  placeholder="Dr. …"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="prov-email">
                Email
              </label>
              <Input
                id="prov-email"
                type="email"
                data-testid="provider-auth-email"
                placeholder="you@clinic.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="prov-password">
                Password
              </label>
              <Input
                id="prov-password"
                type="password"
                data-testid="provider-auth-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>
            {error && (
              <p data-testid="provider-auth-error" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button
              type="submit"
              data-testid="provider-auth-submit"
              disabled={busy}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {busy && <Loader2 size={16} className="mr-1.5 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p data-testid="provider-portal-email" className="text-xs text-slate-400">
                Signed in as {provider.email}
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="patient-id">
                  Patient ID
                </label>
                <Input
                  id="patient-id"
                  data-testid="provider-portal-patient-id"
                  placeholder="patient identifier"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()}
                  className="border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>
              <Button
                data-testid="provider-portal-lookup-btn"
                onClick={lookup}
                disabled={loading}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {loading ? (
                  <Loader2 size={16} className="mr-1.5 animate-spin" />
                ) : (
                  <Search size={16} className="mr-1.5" />
                )}
                View shared preferences
              </Button>
              {message && (
                <p data-testid="provider-portal-message" className="text-sm text-red-600">
                  {message}
                </p>
              )}
            </div>

            {/* The card renders NOTHING when projection is null (contract §1.11). */}
            <ProviderComfortCard
              projection={projection}
              patientLabel={searched && projection ? patientId.trim() : ""}
            />

            {searched && !loading && projection === null && !message && (
              <p
                data-testid="provider-portal-nothing-shared"
                className="text-center text-sm text-slate-400"
              >
                No comfort preferences are shared for this patient.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
