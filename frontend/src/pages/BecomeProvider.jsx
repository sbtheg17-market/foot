import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { providerSignup, uploadDoc } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, CITIES } from "../constants/seed";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { LoadingBlock } from "../components/States";
import { toast } from "sonner";
import { Upload, FileText, Trash2 } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" }, { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" }, { key: "sun", label: "Sunday" },
];

export default function BecomeProvider() {
  const { status, user, provider, refresh } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || "",
    bio: "",
    city: "San Francisco",
    categories: [],
    senior_friendly: false,
    weekly_hours: { mon: [9, 17], tue: [9, 17], wed: [9, 17], thu: [9, 17], fri: [9, 17], sat: [], sun: [] },
    minimum_lead_hours: 6,
    travel_zone: { base_city: "San Francisco", radius_km: 15 },
    document_paths: [],
  });
  const [uploading, setUploading] = useState(false);
  const [docNames, setDocNames] = useState([]);

  const mut = useMutation({
    mutationFn: providerSignup,
    onSuccess: async () => {
      toast.success("Application submitted! Our admin team will review your docs.");
      await refresh();
      navigate("/provider", { replace: true });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e.message),
  });

  if (status === "loading") return <LoadingBlock />;
  if (status === "anon") {
    return (
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
        <h2 className="font-heading text-xl font-semibold">Please sign in first</h2>
        <p className="mt-2 text-sm text-muted-foreground">You need a Google account to apply as a provider.</p>
        <Link to="/login">
          <Button className="mt-6 h-11 rounded-full bg-primary">Sign in</Button>
        </Link>
      </div>
    );
  }
  if (provider) {
    return (
      <div className="max-w-lg mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
        <h2 className="font-heading text-xl font-semibold">You already have a provider profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">Head to your dashboard to manage bookings and availability.</p>
        <Button onClick={() => navigate("/provider")} className="mt-6 h-11 rounded-full bg-primary">Go to dashboard</Button>
      </div>
    );
  }

  const toggleCategory = (c) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));
  };

  const setDay = (day, idx, val) => {
    const arr = [...(form.weekly_hours[day] || [])];
    if (val === "") {
      setForm({ ...form, weekly_hours: { ...form.weekly_hours, [day]: [] } });
      return;
    }
    while (arr.length < 2) arr.push(0);
    arr[idx] = Number(val);
    setForm({ ...form, weekly_hours: { ...form.weekly_hours, [day]: arr } });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDoc(file);
      setForm((f) => ({ ...f, document_paths: [...f.document_paths, res.path] }));
      setDocNames((n) => [...n, file.name]);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeDoc = (i) => {
    setForm((f) => ({ ...f, document_paths: f.document_paths.filter((_, k) => k !== i) }));
    setDocNames((n) => n.filter((_, k) => k !== i));
  };

  const submit = (e) => {
    e.preventDefault();
    if (form.categories.length === 0) return toast.error("Pick at least one category");
    mut.mutate(form);
  };

  return (
    <form data-testid="become-provider-form" onSubmit={submit} className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Apply to be a SoleCare provider</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tell us about your practice. Approval usually takes 1–2 business days.</p>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
        <h2 className="font-heading text-lg font-semibold">Your profile</h2>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Display name</label>
          <Input required data-testid="signup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Short bio</label>
          <Textarea required data-testid="signup-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="rounded-xl mt-1" placeholder="Certified in… bringing calm, senior-friendly care to…" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Base city</label>
            <select required data-testid="signup-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, travel_zone: { ...form.travel_zone, base_city: e.target.value } })} className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Travel radius (km)</label>
            <Input type="number" min="1" data-testid="signup-radius" value={form.travel_zone.radius_km} onChange={(e) => setForm({ ...form, travel_zone: { ...form.travel_zone, radius_km: Number(e.target.value) } })} className="h-11 rounded-xl mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Categories</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                data-testid={`signup-cat-${c}`}
                className={`h-10 rounded-full px-4 text-sm font-medium border capitalize transition-colors ${
                  form.categories.includes(c)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-foreground border-border hover:bg-secondary"
                }`}
              >
                {c.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="signup-senior"
            checked={form.senior_friendly}
            onChange={(e) => setForm({ ...form, senior_friendly: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          I welcome senior clients and understand their comfort needs.
        </label>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
        <h2 className="font-heading text-lg font-semibold">Weekly hours</h2>
        <p className="text-xs text-muted-foreground">Set a start and end (24-hour). Blank = closed. You can refine later.</p>
        <div className="grid gap-2">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 text-sm font-medium">{label}</span>
              <Input type="number" min="0" max="23" data-testid={`signup-day-${key}-start`} placeholder="—" value={form.weekly_hours[key][0] ?? ""} onChange={(e) => setDay(key, 0, e.target.value)} className="h-11 rounded-xl w-24" />
              <span className="text-muted-foreground">→</span>
              <Input type="number" min="0" max="24" data-testid={`signup-day-${key}-end`} placeholder="—" value={form.weekly_hours[key][1] ?? ""} onChange={(e) => setDay(key, 1, e.target.value)} className="h-11 rounded-xl w-24" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow space-y-4">
        <h2 className="font-heading text-lg font-semibold">Verification documents</h2>
        <p className="text-xs text-muted-foreground">Upload certifications, insurance, or ID (PDF or image). Docs are private and only visible to admins.</p>
        <label className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 h-11 text-sm font-medium cursor-pointer hover:bg-primary/20">
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Add document"}
          <input type="file" accept=".pdf,image/*" onChange={handleFile} className="hidden" data-testid="signup-doc-input" disabled={uploading} />
        </label>
        <div className="grid gap-2">
          {docNames.map((n, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm truncate">{n}</span>
              <button type="button" onClick={() => removeDoc(i)} className="text-rose-600 hover:text-rose-700">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <Button
        type="submit"
        data-testid="signup-submit"
        size="lg"
        className="w-full rounded-full h-12 bg-primary hover:bg-primary/90 text-base"
        disabled={mut.isPending}
      >
        {mut.isPending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
