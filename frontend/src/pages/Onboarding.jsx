import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Plus, X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

const STEPS = ["Your details", "About you", "Certifications"];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(user?.photo || null);
  const [bio, setBio] = useState("");
  const [certs, setCerts] = useState([]);
  const [certInput, setCertInput] = useState("");
  const [saving, setSaving] = useState(false);

  const onPhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const addCert = () => {
    const v = certInput.trim();
    if (!v) return;
    setCerts((c) => [...c, v]);
    setCertInput("");
  };

  const finish = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/providers/me", { name, photo, bio, certifications: certs });
      setUser(data);
      toast.success("Profile complete. Welcome aboard!");
      navigate("/");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-8" data-testid="onboarding-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Step {step + 1} of 3
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">{STEPS[step]}</h1>

        {step === 0 && (
          <div className="space-y-6" data-testid="onboarding-step-details">
            <div className="flex flex-col items-start gap-3">
              <Label>Profile photo</Label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative h-24 w-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors duration-200"
                data-testid="onboarding-photo-btn"
              >
                {photo ? (
                  <img src={photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="text-muted-foreground" size={26} />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} data-testid="onboarding-photo-input" />
              <p className="text-sm text-muted-foreground">Optional, but clients trust a friendly face.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-name">Full name</Label>
              <Input
                id="ob-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl"
                data-testid="onboarding-name-input"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6" data-testid="onboarding-step-bio">
            <div className="space-y-2">
              <Label htmlFor="ob-bio">Short bio</Label>
              <Textarea
                id="ob-bio"
                rows={6}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Certified foot care nurse with 8 years of experience in diabetic foot care, home visits across the city..."
                className="rounded-xl resize-none"
                data-testid="onboarding-bio-input"
              />
              <p className="text-sm text-muted-foreground">This appears on your public profile.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6" data-testid="onboarding-step-certs">
            <div className="space-y-2">
              <Label htmlFor="ob-cert">Add certification</Label>
              <div className="flex gap-2">
                <Input
                  id="ob-cert"
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCert())}
                  placeholder="e.g. Certified Foot Care Nurse (CFCN)"
                  className="h-12 rounded-xl"
                  data-testid="onboarding-cert-input"
                />
                <Button type="button" onClick={addCert} className="h-12 w-12 rounded-xl shrink-0" data-testid="onboarding-cert-add-btn">
                  <Plus size={20} />
                </Button>
              </div>
            </div>
            {certs.length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="onboarding-cert-list">
                {certs.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                    {c}
                    <button type="button" onClick={() => setCerts(certs.filter((_, j) => j !== i))} data-testid={`onboarding-cert-remove-${i}`}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">You can skip this and add certifications later from your profile.</p>
          </div>
        )}

        <div className="flex gap-3 mt-10">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="h-12 rounded-full px-6 active:scale-95 transition-transform duration-200"
              data-testid="onboarding-back-btn"
            >
              <ArrowLeft size={18} className="mr-1" /> Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !name.trim()}
              className="h-12 rounded-full px-6 flex-1 font-semibold active:scale-95 transition-transform duration-200"
              data-testid="onboarding-next-btn"
            >
              Continue <ArrowRight size={18} className="ml-1" />
            </Button>
          ) : (
            <Button
              onClick={finish}
              disabled={saving || !name.trim()}
              className="h-12 rounded-full px-6 flex-1 font-semibold active:scale-95 transition-transform duration-200"
              data-testid="onboarding-finish-btn"
            >
              {saving ? "Saving..." : (<><Check size={18} className="mr-1" /> Finish setup</>)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
