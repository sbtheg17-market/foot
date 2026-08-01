import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getProvider, listServices, getAvailability, createBooking, cents } from "../lib/api";
import { PROFILE } from "../constants/testIds";
import PlanBadge from "../components/PlanBadge";
import { LoadingBlock, ErrorBlock } from "../components/States";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { BadgeCheck, MapPin, Clock, Star, ArrowLeft, Route } from "lucide-react";

function formatSlot(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDay(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ProviderProfile() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const providerQ = useQuery({ queryKey: ["provider", providerId], queryFn: () => getProvider(providerId) });
  const servicesQ = useQuery({ queryKey: ["services", providerId], queryFn: () => listServices(providerId) });
  const availabilityQ = useQuery({
    queryKey: ["availability", providerId],
    queryFn: () => getAvailability(providerId, 14),
  });

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  React.useEffect(() => {
    if (user) { setName(user.name || ""); setEmail(user.email || ""); }
  }, [user]);

  const dayEntries = useMemo(() => {
    if (!availabilityQ.data) return [];
    return Object.entries(availabilityQ.data.slots);
  }, [availabilityQ.data]);

  React.useEffect(() => {
    if (!selectedDay && dayEntries.length) {
      const first = dayEntries.find(([, slots]) => slots.length);
      if (first) setSelectedDay(first[0]);
    }
  }, [dayEntries, selectedDay]);

  const bookMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (data) => {
      if (data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        toast.success("Booking requested!");
      }
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail || err?.message || "Booking failed";
      toast.error(detail);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return toast.error("Choose a service and time");
    bookMutation.mutate({
      client_name: name,
      client_email: email,
      client_phone: phone || null,
      provider_id: providerId,
      service_id: selectedService.id,
      start_time: selectedSlot,
      notes,
      origin_url: window.location.origin,
    });
  };

  if (providerQ.isLoading) return <LoadingBlock />;
  if (providerQ.error) return <ErrorBlock error={providerQ.error} />;
  const provider = providerQ.data;

  return (
    <div data-testid={PROFILE.root} className="space-y-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="relative overflow-hidden rounded-3xl border border-border soft-shadow">
        <img src={provider.cover_url} alt="" className="h-48 md:h-64 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          <img src={provider.avatar_url} alt={provider.name} className="h-20 w-20 rounded-2xl border-4 border-white object-cover" />
          <div className="flex-1 text-white">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl sm:text-3xl font-semibold">{provider.name}</h1>
              {provider.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
              <PlanBadge plan={provider.plan} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-white/90">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{provider.city}</span>
              <span className="inline-flex items-center gap-1"><Route className="h-4 w-4" />{provider.travel_zone?.radius_km} km radius</span>
              {provider.rating > 0 && (
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{provider.rating.toFixed(1)} ({provider.reviews_count})</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
            <h2 className="font-heading text-base md:text-lg font-semibold">About</h2>
            <p className="mt-2 text-sm text-muted-foreground">{provider.bio}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {provider.categories.map((c) => (
                <span key={c} className="rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-[11px] font-medium capitalize">{c.replace("-", " ")}</span>
              ))}
            </div>
          </section>

          <section data-testid={PROFILE.services} className="rounded-3xl border border-border bg-card p-6 soft-shadow">
            <h2 className="font-heading text-base md:text-lg font-semibold">Services</h2>
            <div className="mt-4 space-y-3">
              {servicesQ.isLoading && <LoadingBlock label="Loading services…" />}
              {servicesQ.data?.map((s) => (
                <label
                  key={s.id}
                  data-testid={PROFILE.serviceRow(s.id)}
                  className={`flex items-start gap-4 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    selectedService?.id === s.id ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-secondary/50"
                  }`}
                >
                  <input type="radio" name="service" className="mt-1 h-4 w-4 accent-primary" checked={selectedService?.id === s.id} onChange={() => setSelectedService(s)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-medium">{s.title}</h3>
                      <span className="font-semibold">{cents(s.price_cents)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {s.duration_min} min
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-3xl border border-border bg-card p-6 soft-shadow lg:sticky lg:top-24 h-fit">
          <h2 className="font-heading text-base md:text-lg font-semibold">Book a visit</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Min lead time: {availabilityQ.data?.minimum_lead_hours ?? provider.minimum_lead_hours}h · Secured by Stripe
          </p>

          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Pick a date</div>
            <div data-testid={PROFILE.timePicker} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {dayEntries.map(([day, slots]) => {
                const disabled = slots.length === 0;
                const active = day === selectedDay;
                return (
                  <button
                    key={day}
                    data-testid={PROFILE.daySlot(day)}
                    disabled={disabled}
                    onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                    className={`shrink-0 rounded-2xl px-3 py-2 text-left min-w-[92px] h-14 text-sm border transition-colors ${
                      active ? "border-primary bg-primary text-primary-foreground"
                        : disabled ? "border-border bg-secondary/40 text-muted-foreground/70 cursor-not-allowed"
                        : "border-border bg-white hover:bg-secondary"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wide opacity-80">{formatDay(day).split(",")[0]}</div>
                    <div className="font-medium">{formatDay(day).split(",")[1]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Pick a time</div>
            <div className="grid grid-cols-3 gap-2">
              {(availabilityQ.data?.slots?.[selectedDay] || []).map((iso) => (
                <button
                  key={iso}
                  data-testid={PROFILE.timeSlot(iso)}
                  onClick={() => setSelectedSlot(iso)}
                  className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                    selectedSlot === iso ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:bg-secondary"
                  }`}
                >{formatSlot(iso)}</button>
              ))}
              {selectedDay && (availabilityQ.data?.slots?.[selectedDay] || []).length === 0 && (
                <div className="col-span-3 text-xs text-muted-foreground py-4 text-center">No open slots this day</div>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Your name</label>
              <Input data-testid={PROFILE.formName} required value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl mt-1" placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input data-testid={PROFILE.formEmail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl mt-1" placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone (for SMS confirmation)</label>
              <Input data-testid="booking-form-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl mt-1" placeholder="+1 415 555 0100" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Textarea data-testid={PROFILE.formNotes} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl mt-1" placeholder="Access instructions, health notes…" />
            </div>
            {selectedService && (
              <div className="rounded-2xl bg-secondary/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{selectedService.title}</span><span className="font-medium">{cents(selectedService.price_cents)}</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">You'll be redirected to Stripe to complete payment.</div>
              </div>
            )}
            <Button
              type="submit"
              data-testid={PROFILE.formSubmit}
              size="lg"
              disabled={!selectedService || !selectedSlot || bookMutation.isPending}
              className="w-full rounded-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base"
            >{bookMutation.isPending ? "Preparing checkout…" : "Continue to payment"}</Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
