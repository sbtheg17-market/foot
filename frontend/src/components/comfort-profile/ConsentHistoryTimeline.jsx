import { ScrollText, ShieldCheck, EyeOff } from "lucide-react";

/**
 * ConsentHistoryTimeline — V3.1 addendum (§11) patient-facing consent audit trail.
 *
 * PURE PRESENTATION (shell purity rules §5.4): props in, nothing out.
 * Renders the owner-scoped consent timeline: every grant and withdrawal with
 * timestamp, shared categories, consent text version, text hash and purpose.
 * Entries recorded before consent versioning show a legacy note instead.
 *
 * The history is append-only on the server — this component never mutates.
 */

const CATEGORY_LABELS = {
  temperature: "Room temperature",
  lighting: "Lighting",
  noise: "Noise level",
  notes: "Notes (free text)",
};

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ConsentHistoryTimeline({ history = null }) {
  return (
    <section
      data-testid="consent-history-root"
      className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <ScrollText className="text-slate-500" size={20} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Consent history</h2>
          <p className="text-sm text-slate-500">
            A permanent record of every grant and withdrawal — newest first
          </p>
        </div>
      </header>

      <div className="px-6 py-5">
        {(!history || history.length === 0) && (
          <p data-testid="consent-history-empty" className="text-sm text-slate-500">
            No consent events yet. Granting or withdrawing consent is recorded here.
          </p>
        )}

        {history && history.length > 0 && (
          <ol data-testid="consent-history-list" className="space-y-0">
            {history.map((entry, i) => {
              const granted = entry.status === "ACTIVE";
              const isLast = i === history.length - 1;
              return (
                <li
                  key={entry.id || i}
                  data-testid="consent-history-item"
                  className="relative flex gap-3.5 pb-5 last:pb-0"
                >
                  {/* timeline spine */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-slate-200"
                    />
                  )}
                  <span
                    className={
                      "z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                      (granted ? "bg-teal-50" : "bg-slate-100")
                    }
                  >
                    {granted ? (
                      <ShieldCheck size={15} className="text-teal-600" />
                    ) : (
                      <EyeOff size={15} className="text-slate-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p
                        data-testid="consent-history-item-status"
                        className={
                          "text-sm font-semibold " +
                          (granted ? "text-teal-800" : "text-slate-700")
                        }
                      >
                        {granted ? "Consent granted" : "Consent withdrawn"}
                      </p>
                      <p className="text-xs text-slate-400">{formatWhen(entry.createdAt)}</p>
                    </div>

                    {granted && entry.scope && entry.scope.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.scope.map((key) => (
                          <span
                            key={key}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {CATEGORY_LABELS[key] || key}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.consentVersion ? (
                      <p
                        data-testid="consent-history-item-version"
                        className="font-mono text-[11px] text-slate-400"
                        title={entry.consentTextHash || ""}
                      >
                        Consent text v{entry.consentVersion}
                        {entry.consentTextHash
                          ? ` · sha256 ${entry.consentTextHash.slice(0, 12)}…`
                          : ""}
                        {entry.purpose ? ` · ${entry.purpose}` : ""}
                      </p>
                    ) : (
                      <p
                        data-testid="consent-history-item-legacy"
                        className="text-[11px] italic text-slate-400"
                      >
                        Recorded before consent versioning
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
