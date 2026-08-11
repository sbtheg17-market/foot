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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

/**
 * ComfortPreferencesShell — Phase 4C client shell.
 *
 * CONTRACT: docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md
 *
 * Purity rules (§5.4): props-driven presentation ONLY.
 * - No fetch/axios, no storage, no global state. Callbacks out.
 * - Ephemeral local editor draft state is permitted (presentation concern).
 *
 * States present at 4C (§5.2): consent-lock, empty, active editor.
 * loading / error / unauthorized states are added at C-3 — NOT here.
 *
 * Invariants honored:
 * - Editor remains locked until consent is active.
 * - Withdraw hides; it never deletes. Withdraw and Delete are separate actions.
 * - Verbatim copy (§5.3) rendered byte-exact next to the withdraw action.
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
  onGrantConsent = () => {},
  onWithdrawConsent = () => {},
  onDeleteProfile = () => {},
  onSavePreferences = () => {},
}) {
  const [draft, setDraft] = useState(preferences || EMPTY_DRAFT);

  // Re-seed the ephemeral draft when upstream props change (presentation concern only).
  useEffect(() => {
    setDraft(preferences || EMPTY_DRAFT);
  }, [preferences, isConsentActive, hasProfile]);

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

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
          className="flex flex-col items-center gap-4 px-8 py-14 text-center"
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
          <Button
            data-testid="comfort-shell-grant-btn"
            onClick={onGrantConsent}
            className="mt-1 bg-teal-600 text-white hover:bg-teal-700"
          >
            <ShieldCheck size={16} className="mr-1.5" />
            Grant consent
          </Button>
        </div>
      )}

      {/* Active: empty state or editor */}
      {isConsentActive && (
        <div className="px-6 py-6">
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
