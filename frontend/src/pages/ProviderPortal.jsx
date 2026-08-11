import { useState } from "react";
import axios from "axios";
import { Stethoscope, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProviderComfortCard from "@/components/comfort-profile/ProviderComfortCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * ProviderPortal — container for the Phase 4C provider projection card.
 *
 * The CONTAINER fetches (GET /api/provider/comfort-projection/{patientId});
 * the CARD stays pure presentation. On 404 the projection is null and the card
 * renders nothing — the page shows only a neutral, non-leaking hint.
 * Provider identity: X-Provider-Id header stub until provider auth lands.
 */
export default function ProviderPortal() {
  const [providerId, setProviderId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [projection, setProjection] = useState(null);
  const [message, setMessage] = useState(null);

  const lookup = async () => {
    if (!providerId.trim() || !patientId.trim()) {
      setMessage("Enter your provider ID and the patient ID.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setProjection(null);
    setSearched(false);
    try {
      const res = await axios.get(
        `${API}/provider/comfort-projection/${encodeURIComponent(patientId.trim())}`,
        { headers: { "X-Provider-Id": providerId.trim() } }
      );
      setProjection(res.data.projection);
    } catch (e) {
      if (e.response?.status === 404) {
        // 404-only design: nothing is shared. Card renders nothing.
        setProjection(null);
      } else if (e.response?.status === 401) {
        setMessage("Provider identity is required.");
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-left">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
            <Stethoscope className="text-indigo-600" size={22} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Provider portal</h1>
            <p className="text-sm text-slate-500">
              View comfort preferences a patient has chosen to share
            </p>
          </div>
        </header>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="provider-id">
                Your provider ID
              </label>
              <Input
                id="provider-id"
                data-testid="provider-portal-provider-id"
                placeholder="e.g. dr-rivera"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>
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
        <ProviderComfortCard projection={projection} patientLabel={searched && projection ? patientId.trim() : ""} />

        {searched && !loading && projection === null && !message && (
          <p
            data-testid="provider-portal-nothing-shared"
            className="text-center text-sm text-slate-400"
          >
            No comfort preferences are shared for this patient.
          </p>
        )}
      </div>
    </main>
  );
}
