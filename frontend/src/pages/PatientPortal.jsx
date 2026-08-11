import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComfortPreferencesShell from "@/components/comfort-profile/ComfortPreferencesShell";
import { getToken, clearToken } from "@/lib/session";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const FULL_SCOPE = ["temperature", "lighting", "noise", "notes"];

/**
 * PatientPortal — container that wires ComfortPreferencesShell to the real API.
 * The shell stays pure presentation; ALL fetching and error handling lives here.
 *
 * HARDENED LOGOUT: the token is cleared in a `finally` block — even if the
 * logout request fails or the token is already expired, the patient always
 * ends up signed out locally with clear feedback.
 */
export default function PatientPortal() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [profile, setProfile] = useState(null); // {isConsentActive, hasProfile, preferences}
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const authed = useCallback(() => {
    const token = getToken();
    return token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { headers: {} };
  }, []);

  const handleExpired = useCallback(() => {
    clearToken();
    navigate("/signin?expired=1");
  }, [navigate]);

  const load = useCallback(async () => {
    if (!getToken()) {
      navigate("/signin");
      return;
    }
    try {
      const [meRes, profileRes] = await Promise.all([
        axios.get(`${API}/auth/me`, authed()),
        axios.get(`${API}/comfort-profile`, authed()),
      ]);
      setPatient(meRes.data.patient);
      setProfile(profileRes.data);
    } catch (e) {
      if (e.response?.status === 401) {
        handleExpired();
        return;
      }
      toast.error("Could not load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [authed, handleExpired, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    try {
      const res = await axios.get(`${API}/comfort-profile`, authed());
      setProfile(res.data);
    } catch (e) {
      if (e.response?.status === 401) handleExpired();
    }
  };

  const onGrantConsent = async () => {
    try {
      await axios.post(`${API}/comfort-profile/consent`, { scope: FULL_SCOPE }, authed());
      toast.success("Consent granted — your editor is unlocked.");
      await refresh();
    } catch (e) {
      if (e.response?.status === 401) return handleExpired();
      toast.error("Could not grant consent. Please try again.");
    }
  };

  const onWithdrawConsent = async () => {
    try {
      await axios.post(`${API}/comfort-profile/consent/withdraw`, null, authed());
      toast.success("Consent withdrawn — your profile is hidden, not deleted.");
      await refresh();
    } catch (e) {
      if (e.response?.status === 401) return handleExpired();
      if (e.response?.status === 404) toast.error("No consent record found.");
      else toast.error("Could not withdraw consent. Please try again.");
    }
  };

  const onDeleteProfile = async () => {
    try {
      await axios.delete(`${API}/comfort-profile`, authed());
      toast.success("Comfort profile permanently deleted.");
      await refresh();
    } catch (e) {
      if (e.response?.status === 401) return handleExpired();
      if (e.response?.status === 404) toast.error("There is no profile to delete.");
      else toast.error("Could not delete the profile. Please try again.");
    }
  };

  const onSavePreferences = async (draft) => {
    try {
      await axios.put(`${API}/comfort-profile/preferences`, draft, authed());
      toast.success("Preferences saved.");
      await refresh();
    } catch (e) {
      if (e.response?.status === 401) return handleExpired();
      if (e.response?.status === 409)
        toast.error("Consent is not active — grant consent to save preferences.");
      else if (e.response?.status === 400)
        toast.error(e.response?.data?.detail || "Invalid preferences.");
      else toast.error("Could not save preferences. Please try again.");
    }
  };

  // HARDENED SIGN-OUT: local state is ALWAYS cleared, success or failure.
  const signOut = async () => {
    setSigningOut(true);
    try {
      await axios.post(`${API}/auth/logout`, null, authed());
    } catch {
      // Swallow — the finally block guarantees local sign-out either way.
    } finally {
      clearToken();
      setSigningOut(false);
      navigate("/signin?signedout=1");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div
          data-testid="portal-loading"
          className="flex items-center gap-2 text-slate-500"
        >
          <Loader2 className="animate-spin" size={18} /> Loading your profile…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-left">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Hi{patient?.name ? `, ${patient.name}` : ""}
            </h1>
            <p data-testid="portal-patient-email" className="text-sm text-slate-500">
              {patient?.email}
            </p>
          </div>
          <Button
            data-testid="portal-signout-btn"
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
        </header>

        <ComfortPreferencesShell
          isConsentActive={profile?.isConsentActive || false}
          hasProfile={profile?.hasProfile || false}
          preferences={profile?.preferences || null}
          onGrantConsent={onGrantConsent}
          onWithdrawConsent={onWithdrawConsent}
          onDeleteProfile={onDeleteProfile}
          onSavePreferences={onSavePreferences}
        />
      </div>
    </main>
  );
}
