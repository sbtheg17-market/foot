import { useEffect, useState } from "react";
import {
  Lock,
  ShieldCheck,
  EyeOff,
  Trash2,
  Thermometer,
  Lamp,
  Volume2,
  Save,
  ClipboardList,
  StickyNote,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

/**
 * ComfortPreferencesShell — Phase 4C client shell.
 *
 * CONTRACT: docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md (incl. V3.1 addendum §11)
 *
 * Purity rules (§5.4): props-driven presentation ONLY.
 * - No fetch/axios, no storage, no global state. Callbacks out.
 * - Ephemeral local editor draft state is permitted (presentation concern).
 * - The consent SCOPE PICKER is ephemeral local selection state (presentation
 *   concern); the chosen scope leaves the shell only through onGrantConsent(scope).
 *
 * States present at 4C (§5.2): consent-lock (now with scope picker), empty, active editor.
 * loading / error / unauthorized states are added at C-3 — NOT here.
 *
 * Invariants honored:
 * - Editor remains locked until consent is active.
 * - Withdraw hides; it never deletes. Withdraw and Delete are separate actions.
 * - Verbatim copy (§5.3) rendered byte-exact next to the withdraw action.
 * - Conservative scope defaults (V3.1 §11): the free-text "notes" category is
 *   OFF by default — it is only shared when the patient explicitly turns it on.
 */

// §5.3 — normative, byte-exact. Do not edit without contract alteration approval.
export const WITHDRAW_COPY_VERBATIM =
  "Withdrawing consent hides your comfort profile from providers. Your data is not deleted.";

const TEMPERATURE_OPTIONS = [
  { value: "cool", label: "Cool" },
  { value: "moderate", label: "Moderate" },
  { value: "warm", label: "Warm" },
];
const LIGHTING_OPTIONS = [
  { value: "dim", label: "Dim" },
  { value: "soft", label: "Soft" },
  { value: "bright", label: "Bright" },
];
const NOISE_OPTIONS = [
  { value: "quiet", label: "Quiet" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
];

const EMPTY_DRAFT = { temperature: null, lighting: null, noise: null, notes: "" };

// V3.1 — the four shareable categories. `notes` (the single free-text field)
// defaults to NOT shared; everything else defaults to shared.
export const SCOPE_CATEGORIES = [
  { key: "temperature", label: "Room temperature", icon: Thermometer, defaultOn: true },
  { key: "lighting", label: "Lighting", icon: Lamp, defaultOn: true },
  { key: "noise", label: "Noise level", icon: Volume2, defaultOn: true },
  { key: "notes", label: "Notes (free text)", icon: StickyNote, defaultOn: false },
];

const DEFAULT_SCOPE_SELECTION = Object.fromEntries(
  SCOPE_CATEGORIES.map((c) => [c.key, c.defaultOn])
);

const CATEGORY_LABELS = Object.fromEntries(
  SCOPE_CATEGORIES.map((c) => [c.key, c.label])
);

function OptionRow({ icon: Icon, label, options, value, onChange, testIdPrefix }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5 text-slate-700">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-4.5 w-4.5 text-slate-500" size={18} />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              data-testid={`${testIdPrefix}-${opt.value}`}
              aria-pressed={active}
              onClick={() => onChange(active ? null : opt.value)}
              className={
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-800")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ComfortPreferencesShell({
  isConsentActive = false,
  hasProfile = false,
  preferences = null,
  consentStatement = "",
  sharedScope = null,
  onGrantConsent = () => {},
  onWithdrawConsent = () => {},
  onDeleteProfile = () => {},
  onSavePreferences = () => {},
}) {
  const [draft, setDraft] = useState(preferences || EMPTY_DRAFT);
  // Ephemeral scope selection for the consent-lock picker (presentation concern).
  const [scopeSelection, setScopeSelection] = useState(DEFAULT_SCOPE_SELECTION);

  // Re-seed the ephemeral draft when upstream props change (presentation concern only).
  useEffect(() => {
    setDraft(preferences || EMPTY_DRAFT);
  }, [preferences, isConsentActive, hasProfile]);

  // Reset the picker to conservative defaults whenever the lock state is re-entered.
  useEffect(() => {
    if (!isConsentActive) setScopeSelection(DEFAULT_SCOPE_SELECTION);
  }, [isConsentActive]);

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const selectedScope = SCOPE_CATEGORIES.filter((c) => scopeSelection[c.key]).map(
    (c) => c.key
  );

  return (
    <section
      data-testid="comfort-shell-root"
      className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
            <ClipboardList className="text-teal-600" size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Comfort profile</h2>
            <p className="text-sm text-slate-500">
              Preferences shared with your care team
            </p>
          </div>
        </div>
        {isConsentActive ? (
          <Badge
            data-testid="comfort-shell-status-badge"
            className="gap-1.5 border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50"
          >
            <ShieldCheck size={14} /> Consent active
          </Badge>
        ) : (
          <Badge
            data-testid="comfort-shell-status-badge"
            className="gap-1.5 border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100"
          >
            <Lock size={14} /> Locked
          </Badge>
        )}
      </header>

      {/* Consent-lock state — editor stays locked until consent is active */}
      {!isConsentActive && (
        <div
          data-testid="comfort-shell-consent-lock"
          className="flex flex-col items-center gap-5 px-8 py-10 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Lock className="text-slate-400" size={26} />
          </span>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-slate-900">
              Sharing is locked
            </h3>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-500">
              Your comfort preferences stay private until you grant consent. The
              editor unlocks once consent is active.
            </p>
          </div>

          {/* V3.1 — scope picker: choose exactly which categories to share */}
          <div className="w-full max-w-md space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Choose what to share
            </p>
            {SCOPE_CATEGORIES.map((c) => {
              const on = !!scopeSelection[c.key];
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  data-testid={`comfort-shell-scope-${c.key}`}
                  onClick={() =>
                    setScopeSelection((s) => ({ ...s, [c.key]: !s[c.key] }))
                  }
                  className={
                    "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition-colors " +
                    (on
                      ? "border-teal-200 bg-teal-50/60"
                      : "border-slate-200 bg-white hover:bg-slate-50")
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className={on ? "text-teal-600" : "text-slate-400"} />
                    <span className={"text-sm font-medium " + (on ? "text-teal-900" : "text-slate-600")}>
                      {c.label}
                    </span>
                    {c.key === "notes" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        off by default
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "flex h-5 w-5 items-center justify-center rounded-md border " +
                      (on
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-300 bg-white text-transparent")
                    }
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
            <p className="text-xs leading-relaxed text-slate-400">
              Free-text notes are only shared if you turn them on. You can withdraw
              at any time.
            </p>
          </div>

          {consentStatement && (
            <p
              data-testid="comfort-shell-consent-statement"
              className="mx-auto w-full max-w-md rounded-lg bg-slate-50 px-4 py-3 text-left text-xs leading-relaxed text-slate-600"
            >
              {consentStatement}
            </p>
          )}

          <Button
            data-testid="comfort-shell-grant-btn"
            onClick={() => onGrantConsent(selectedScope)}
            disabled={selectedScope.length === 0}
            className="mt-1 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <ShieldCheck size={16} className="mr-1.5" />
            Grant consent
            {selectedScope.length > 0 && (
              <span className="ml-1.5 rounded-full bg-teal-500/60 px-1.5 text-xs">
                {selectedScope.length}
              </span>
            )}
          </Button>
          {selectedScope.length === 0 && (
            <p data-testid="comfort-shell-scope-empty-hint" className="-mt-2 text-xs text-slate-400">
              Select at least one category to grant consent.
            </p>
          )}
        </div>
      )}

      {/* Active: empty state or editor */}
      {isConsentActive && (
        <div className="px-6 py-6">
          {/* V3.1 — currently shared categories (server-derived, read-only chips) */}
          {Array.isArray(sharedScope) && sharedScope.length > 0 && (
            <div
              data-testid="comfort-shell-shared-scope"
              className="mb-5 flex flex-wrap items-center gap-1.5"
            >
              <span className="text-xs font-medium text-slate-400">Sharing:</span>
              {sharedScope.map((key) => (
                <span
                  key={key}
                  data-testid={`comfort-shell-shared-chip-${key}`}
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                >
                  {CATEGORY_LABELS[key] || key}
                </span>
              ))}
            </div>
          )}

          {!hasProfile && (
            <div
              data-testid="comfort-shell-empty"
              className="mb-6 rounded-xl border border-dashed border-teal-200 bg-teal-50/50 px-5 py-4"
            >
              <p className="text-sm font-medium text-teal-800">
                No preferences yet
              </p>
              <p className="mt-0.5 text-sm text-teal-700/80">
                Set your first comfort preferences below — your care team will see
                only what you share.
              </p>
            </div>
          )}

          <div data-testid="comfort-shell-editor" className="space-y-5">
            <OptionRow
              icon={Thermometer}
              label="Room temperature"
              options={TEMPERATURE_OPTIONS}
              value={draft.temperature}
              onChange={(v) => setField("temperature", v)}
              testIdPrefix="comfort-shell-temperature"
            />
            <OptionRow
              icon={Lamp}
              label="Lighting"
              options={LIGHTING_OPTIONS}
              value={draft.lighting}
              onChange={(v) => setField("lighting", v)}
              testIdPrefix="comfort-shell-lighting"
            />
            <OptionRow
              icon={Volume2}
              label="Noise level"
              options={NOISE_OPTIONS}
              value={draft.noise}
              onChange={(v) => setField("noise", v)}
              testIdPrefix="comfort-shell-noise"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="comfort-notes">
                Notes for your care team
              </label>
              <Textarea
                id="comfort-notes"
                data-testid="comfort-shell-notes"
                placeholder="Anything else that helps you feel comfortable…"
                value={draft.notes || ""}
                onChange={(e) => setField("notes", e.target.value)}
                className="min-h-[88px] resize-none border-slate-200 focus-visible:ring-teal-500"
              />
            </div>

            <div className="flex justify-end">
              <Button
                data-testid="comfort-shell-save-btn"
                onClick={() => onSavePreferences(draft)}
                className="bg-teal-600 text-white hover:bg-teal-700"
              >
                <Save size={16} className="mr-1.5" />
                Save preferences
              </Button>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Danger zone — withdraw (hide) and delete are SEPARATE operations */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sharing & data controls
            </h4>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md">
                <p className="text-sm font-medium text-slate-800">Withdraw consent</p>
                {/* §5.3 verbatim copy — byte-exact, do not modify */}
                <p
                  data-testid="comfort-shell-withdraw-copy"
                  className="mt-0.5 text-sm text-slate-500"
                >
                  {WITHDRAW_COPY_VERBATIM}
                </p>
              </div>
              <Button
                data-testid="comfort-shell-withdraw-btn"
                variant="outline"
                onClick={onWithdrawConsent}
                className="shrink-0 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <EyeOff size={16} className="mr-1.5" />
                Withdraw & hide
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md">
                <p className="text-sm font-medium text-red-800">Delete profile</p>
                <p className="mt-0.5 text-sm text-red-600/80">
                  Permanently removes your comfort profile data. This is separate
                  from withdrawing consent and cannot be undone.
                </p>
              </div>
              <Button
                data-testid="comfort-shell-delete-btn"
                variant="outline"
                onClick={onDeleteProfile}
                className="shrink-0 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={16} className="mr-1.5" />
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
