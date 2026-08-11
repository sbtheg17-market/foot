import { useState } from "react";
import { FlaskConical, Info } from "lucide-react";
import ComfortPreferencesShell from "@/components/comfort-profile/ComfortPreferencesShell";

/**
 * Phase 4C Shell Preview — presentation-only harness.
 *
 * Purpose (per .agents/NEXT_TASK.md Task 1): make the restored Phase 4C shell
 * VISIBLE and internally consistent. This page passes demo props into the
 * props-driven shell. It intentionally wires NO API routes, NO persistence,
 * NO events, NO analytics — all forbidden in this task by the operator's scope.
 */

const SCENARIOS = {
  locked: {
    label: "Consent locked",
    props: { isConsentActive: false, hasProfile: false, preferences: null },
  },
  empty: {
    label: "Active — no profile",
    props: { isConsentActive: true, hasProfile: false, preferences: null },
  },
  filled: {
    label: "Active — with profile",
    props: {
      isConsentActive: true,
      hasProfile: true,
      preferences: {
        temperature: "cool",
        lighting: "soft",
        noise: "quiet",
        notes: "Please keep the window shades half open in the morning.",
      },
    },
  },
};

export default function ComfortShellPreview() {
  const [scenario, setScenario] = useState("locked");
  const [lastAction, setLastAction] = useState(null);

  const record = (name) => (payload) =>
    setLastAction(
      payload && typeof payload === "object" && !payload.nativeEvent
        ? `${name}(${JSON.stringify(payload)})`
        : `${name}()`
    );

  const current = SCENARIOS[scenario];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-left">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {/* Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <FlaskConical className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Phase 4C Shell Preview — presentation only
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-amber-700/90">
              Props-driven shell per contract
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
                PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md
              </code>
              — no API, schema, or persistence is wired (forbidden in this task).
            </p>
          </div>
        </div>

        {/* Scenario switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              data-testid={`preview-scenario-${key}`}
              onClick={() => {
                setScenario(key);
                setLastAction(null);
              }}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                (scenario === key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900")
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* The shell under preview */}
        <ComfortPreferencesShell
          key={scenario}
          {...current.props}
          onGrantConsent={record("onGrantConsent")}
          onWithdrawConsent={record("onWithdrawConsent")}
          onDeleteProfile={record("onDeleteProfile")}
          onSavePreferences={record("onSavePreferences")}
        />

        {/* Callback observer — proves shells emit callbacks without side effects */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Info className="mt-0.5 shrink-0 text-slate-400" size={16} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Last callback emitted
            </p>
            <p
              data-testid="preview-last-action"
              className="mt-0.5 break-all font-mono text-sm text-slate-700"
            >
              {lastAction || "— none yet —"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
