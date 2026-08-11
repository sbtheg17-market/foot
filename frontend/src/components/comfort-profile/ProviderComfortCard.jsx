import { Thermometer, Lamp, Volume2, StickyNote, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * ProviderComfortCard — Phase 4C provider-facing read-only card.
 *
 * CONTRACT (§5.1, §4): docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md
 * - Pure props-driven presentation. No fetching, no state, no side effects.
 * - Renders NOTHING (returns null) when the projection is null — no skeleton,
 *   no error chrome. The 404-only design means absence reveals nothing.
 * - Shows ONLY the fields present in the projection (already scope-filtered
 *   and non-null by the server's buildProviderProjection).
  */

const FIELD_META = {
  temperature: { icon: Thermometer, label: "Room temperature" },
  lighting: { icon: Lamp, label: "Lighting" },
  noise: { icon: Volume2, label: "Noise level" },
  notes: { icon: StickyNote, label: "Notes" },
};

const FIELD_ORDER = ["temperature", "lighting", "noise", "notes"];

export default function ProviderComfortCard({ projection = null, patientLabel = "" }) {
  // Contract §1.11 — the card renders nothing when the projection is null.
  if (projection === null || projection === undefined) return null;

  const fields = FIELD_ORDER.filter((f) => projection[f] !== undefined && projection[f] !== null);
  if (fields.length === 0) return null;

  return (
    <section
      data-testid="provider-card-root"
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Comfort preferences{patientLabel ? ` — ${patientLabel}` : ""}
          </h3>
          <p className="text-xs text-slate-500">Read-only · shared by the patient</p>
        </div>
        <Badge className="gap-1 border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50">
          <ShieldCheck size={13} /> Consented
        </Badge>
      </header>
      <ul className="divide-y divide-slate-100">
        {fields.map((field) => {
          const { icon: Icon, label } = FIELD_META[field];
          const value = projection[field];
          return (
            <li key={field} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon className="text-slate-500" size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p
                  data-testid={`provider-card-${field}`}
                  className="mt-0.5 break-words text-sm text-slate-800"
                >
                  {field === "notes" ? value : value.charAt(0).toUpperCase() + value.slice(1)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
