import { X, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export const TravelZoneEditor = ({ value, onChange }) => {
  const [pincodeInput, setPincodeInput] = useState("");

  const setMode = (mode) => onChange({ ...value, mode });
  const setField = (k) => (e) => onChange({ ...value, [k]: e.target.value });

  const addPincode = () => {
    const v = pincodeInput.trim();
    if (!v) return;
    if ((value.pincodes || []).includes(v)) {
      setPincodeInput("");
      return;
    }
    onChange({ ...value, pincodes: [...(value.pincodes || []), v] });
    setPincodeInput("");
  };

  const removePincode = (p) =>
    onChange({ ...value, pincodes: (value.pincodes || []).filter((x) => x !== p) });

  return (
    <div className="space-y-5" data-testid="travel-zone-editor">
      <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-muted" data-testid="travel-mode-toggle">
        {["radius", "pincodes"].map((m) => {
          const selected = value.mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-10 rounded-full text-sm font-semibold transition-colors duration-200 ${
                selected ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              data-testid={`travel-mode-${m}`}
            >
              {m === "radius" ? "By radius" : "By zip / pincode"}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tz-home">Home base address</Label>
        <Input
          id="tz-home"
          value={value.home_address || ""}
          onChange={setField("home_address")}
          placeholder="Neighborhood or full address"
          className="h-12 rounded-xl"
          data-testid="travel-home-input"
        />
        <p className="text-xs text-muted-foreground">Used only to compute your reach. Not shown publicly.</p>
      </div>

      {value.mode === "radius" ? (
        <div className="space-y-2">
          <Label htmlFor="tz-radius">Travel radius (km)</Label>
          <Input
            id="tz-radius"
            type="number"
            inputMode="numeric"
            min="0"
            max="500"
            step="1"
            value={value.radius_km ?? 0}
            onChange={(e) => onChange({ ...value, radius_km: Number(e.target.value) })}
            placeholder="20"
            className="h-12 rounded-xl"
            data-testid="travel-radius-input"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="tz-pincode">Zip / pincode</Label>
          <div className="flex gap-2">
            <Input
              id="tz-pincode"
              value={pincodeInput}
              onChange={(e) => setPincodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPincode())}
              placeholder="Add zip or pincode"
              className="h-12 rounded-xl"
              data-testid="travel-pincode-input"
            />
            <button
              type="button"
              onClick={addPincode}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform duration-200"
              data-testid="travel-pincode-add"
              aria-label="Add pincode"
            >
              <Plus size={18} />
            </button>
          </div>
          {(value.pincodes || []).length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="travel-pincode-list">
              {value.pincodes.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                  data-testid={`travel-pincode-chip-${p}`}
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removePincode(p)}
                    aria-label={`Remove ${p}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {(value.pincodes || []).length === 0 && (
            <p className="text-xs text-muted-foreground">Add every zip / pincode you'll travel to.</p>
          )}
        </div>
      )}
    </div>
  );
};
