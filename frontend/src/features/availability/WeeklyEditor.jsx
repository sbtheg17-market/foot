import { useState } from "react";
import { Plus, X, Copy } from "lucide-react";
import { Button } from "../../components/ui/button";

const DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const DEFAULT_SLOT = { start: "09:00", end: "17:00" };

const isValidSlot = (s) => s?.start && s?.end && s.start < s.end;

export const WeeklyEditor = ({ value, onChange }) => {
  const [copiedDay, setCopiedDay] = useState(null);

  const addSlot = (day) => {
    onChange({ ...value, [day]: [...(value[day] || []), { ...DEFAULT_SLOT }] });
  };

  const removeSlot = (day, idx) => {
    onChange({ ...value, [day]: (value[day] || []).filter((_, i) => i !== idx) });
  };

  const patchSlot = (day, idx, patch) => {
    const next = (value[day] || []).map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, [day]: next });
  };

  const copyDayToAll = (day) => {
    const src = value[day] || [];
    const nextVal = { ...value };
    DAYS.forEach(({ key }) => {
      if (key !== day) nextVal[key] = src.map((s) => ({ ...s }));
    });
    onChange(nextVal);
    setCopiedDay(day);
    setTimeout(() => setCopiedDay(null), 1600);
  };

  return (
    <div className="space-y-3" data-testid="weekly-editor">
      {DAYS.map(({ key, label, short }) => {
        const slots = value[key] || [];
        return (
          <div
            key={key}
            className="rounded-2xl border border-black/5 bg-card p-4"
            data-testid={`weekly-day-${key}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {slots.length === 0 ? "Closed" : `${slots.length} ${slots.length === 1 ? "slot" : "slots"}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {slots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => copyDayToAll(key)}
                    className="h-9 px-3 rounded-full text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    data-testid={`weekly-copy-${key}`}
                    title={`Copy ${short} to all days`}
                  >
                    <Copy size={12} className="inline mr-1" />
                    {copiedDay === key ? "Copied" : "Copy to all"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addSlot(key)}
                  className="h-9 w-9 rounded-full bg-secondary text-primary flex items-center justify-center hover:bg-accent transition-colors"
                  data-testid={`weekly-add-${key}`}
                  aria-label={`Add slot to ${label}`}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Tap + to add hours.</p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, i) => {
                  const invalid = !isValidSlot(slot);
                  return (
                    <div key={i} className="flex items-center gap-2" data-testid={`weekly-slot-${key}-${i}`}>
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => patchSlot(key, i, { start: e.target.value })}
                        className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid={`weekly-start-${key}-${i}`}
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => patchSlot(key, i, { end: e.target.value })}
                        className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid={`weekly-end-${key}-${i}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(key, i)}
                        className="h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors flex items-center justify-center"
                        data-testid={`weekly-remove-${key}-${i}`}
                        aria-label="Remove slot"
                      >
                        <X size={16} />
                      </button>
                      {invalid && (
                        <span className="text-xs text-destructive font-semibold ml-1">Fix</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const weeklyIsValid = (weekly) =>
  DAYS.every(({ key }) => (weekly[key] || []).every(isValidSlot));
