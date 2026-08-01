import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBookings, updateBookingStatus, getEarnings, getProvider, getOpportunities,
  updateAvailability, adminListProviders, cents, pct,
} from "../lib/api";
import { PROVIDER } from "../constants/testIds";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import PlanBadge from "../components/PlanBadge";
import { EmptyState, LoadingBlock, ErrorBlock } from "../components/States";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Wallet, TrendingUp, Route, Sparkles, AlertCircle, Info } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

function OpportunityCards({ providerId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["opportunities", providerId],
    queryFn: () => getOpportunities(providerId),
  });
  if (isLoading) return null;
  const items = data?.opportunities || [];
  const iconFor = (tone) => (tone === "positive" ? CheckCircle2 : tone === "warn" ? AlertCircle : Info);
  const cls = (tone) =>
    tone === "positive" ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : tone === "warn" ? "bg-amber-50 text-amber-800 border-amber-100"
      : "bg-blue-50 text-blue-800 border-blue-100";
  return (
    <section data-testid="provider-opportunities" className="rounded-3xl border border-border bg-card p-6 soft-shadow">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-semibold">Opportunities for you</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Real signals from client searches and bookings in your area — the OS working for you.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((o) => {
          const Icon = iconFor(o.tone);
          return (
            <div key={o.id} data-testid={`opportunity-${o.id}`} className={`rounded-2xl border p-4 ${cls(o.tone)}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">{o.title}</div>
                  <div className="mt-1 text-xs opacity-90">{o.body}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EarningsWidget({ providerId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["earnings", providerId], queryFn: () => getEarnings(providerId),
  });
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  const t = data.totals;
  return (
    <div data-testid={PROVIDER.earnings} className="grid gap-4 md:grid-cols-3">
      <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Wallet className="h-4 w-4" /> Paid out</div>
        <div className="font-heading text-3xl font-semibold mt-2">{cents(t.provider_net_cents)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t.completed_count} completed · at {pct(data.commission_rate)} commission</div>
      </CardContent></Card>
      <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><TrendingUp className="h-4 w-4" /> Coming up</div>
        <div className="font-heading text-3xl font-semibold mt-2">{cents(t.pending_net_cents)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t.upcoming_count} accepted · {t.requested_count} requested</div>
      </CardContent></Card>
      <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide"><Clock className="h-4 w-4" /> Platform fee</div>
        <div className="font-heading text-3xl font-semibold mt-2">{cents(t.platform_fee_cents)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Gross {cents(t.gmv_cents)} · fee {pct(data.commission_rate)}</div>
      </CardContent></Card>
    </div>
  );
}

function BookingsPanel({ providerId }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["bookings", "provider", providerId],
    queryFn: () => listBookings({ provider_id: providerId }),
  });
  const mut = useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", "provider", providerId] });
      qc.invalidateQueries({ queryKey: ["earnings", providerId] });
      toast.success("Booking updated");
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e.message),
  });
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    return data.filter((b) => b.status === filter);
  }, [data, filter]);

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", "requested", "accepted", "completed", "declined"].map((f) => (
          <button
            key={f}
            data-testid={`provider-booking-filter-${f}`}
            onClick={() => setFilter(f)}
            className={`h-10 rounded-full px-4 text-sm font-medium border transition-colors ${
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:bg-secondary"
            }`}
          >{f}</button>
        ))}
      </div>
      {filtered.length === 0 && (<EmptyState title="No bookings here yet" message="Requests will appear here as clients book." />)}
      <div className="grid gap-3">
        {filtered.map((b) => (
          <article key={b.id} data-testid={PROVIDER.bookingRow(b.id)}
            className="rounded-3xl border border-border bg-card p-6 soft-shadow flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-semibold">{b.client_name}</h3>
                <StatusBadge status={b.status} />
                {b.payment_status === "paid" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-medium">Paid</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{b.service?.title}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{new Date(b.start_time).toLocaleString()}</span>
                <span>{b.client_email}</span>
                {b.client_phone && <span>{b.client_phone}</span>}
              </div>
              {b.notes && <p className="mt-2 text-xs text-muted-foreground italic">"{b.notes}"</p>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Your net</div>
              <div className="font-heading text-lg font-semibold">{cents(b.provider_net_cents)}</div>
              <div className="text-[11px] text-muted-foreground">of {cents(b.gmv_cents)} gross</div>
            </div>
            <div className="flex gap-2 md:flex-col">
              {b.status === "requested" && (
                <>
                  <Button data-testid={PROVIDER.acceptBtn(b.id)} size="sm" className="rounded-full h-10 bg-primary"
                    onClick={() => mut.mutate({ id: b.id, status: "accepted" })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button data-testid={PROVIDER.declineBtn(b.id)} variant="outline" size="sm" className="rounded-full h-10"
                    onClick={() => mut.mutate({ id: b.id, status: "declined" })}>
                    <XCircle className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </>
              )}
              {b.status === "accepted" && (
                <Button data-testid={PROVIDER.completeBtn(b.id)} size="sm" className="rounded-full h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => mut.mutate({ id: b.id, status: "completed" })}>Mark completed</Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AvailabilityPanel({ providerId }) {
  const qc = useQueryClient();
  const providerQ = useQuery({ queryKey: ["provider", providerId], queryFn: () => getProvider(providerId) });
  const [form, setForm] = useState(null);
  const [blocked, setBlocked] = useState("");

  React.useEffect(() => {
    if (providerQ.data && !form) {
      const p = providerQ.data;
      setForm({
        weekly_hours: { ...p.weekly_hours },
        blocked_dates: [...(p.blocked_dates || [])],
        minimum_lead_hours: p.minimum_lead_hours,
        travel_zone: { ...p.travel_zone },
      });
    }
  }, [providerQ.data, form]);

  const saveMut = useMutation({
    mutationFn: (payload) => updateAvailability(providerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider", providerId] });
      qc.invalidateQueries({ queryKey: ["availability", providerId] });
      qc.invalidateQueries({ queryKey: ["opportunities", providerId] });
      toast.success("Availability saved");
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e.message),
  });

  if (providerQ.isLoading || !form) return <LoadingBlock />;
  if (providerQ.error) return <ErrorBlock error={providerQ.error} />;

  const updateDay = (day, index, value) => {
    const arr = [...(form.weekly_hours[day] || [])];
    if (value === "") { setForm({ ...form, weekly_hours: { ...form.weekly_hours, [day]: [] } }); return; }
    while (arr.length < 2) arr.push(0);
    arr[index] = Number(value);
    setForm({ ...form, weekly_hours: { ...form.weekly_hours, [day]: arr } });
  };

  const removeBlocked = (d) => setForm({ ...form, blocked_dates: form.blocked_dates.filter((x) => x !== d) });
  const addBlocked = () => {
    if (blocked && !form.blocked_dates.includes(blocked)) {
      setForm({ ...form, blocked_dates: [...form.blocked_dates, blocked] });
      setBlocked("");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
        <h3 className="font-heading text-lg font-semibold">Weekly hours</h3>
        <p className="mt-1 text-xs text-muted-foreground">Set open windows per day (24-hour). Leave blank to close.</p>
        <div className="mt-4 space-y-2">
          {DAYS.map(({ key, label }) => {
            const window = form.weekly_hours[key] || [];
            return (
              <div key={key} data-testid={PROVIDER.availDay(key)} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium">{label}</span>
                <Input data-testid={PROVIDER.availDayStart(key)} type="number" min="0" max="23" placeholder="—" value={window[0] ?? ""} onChange={(e) => updateDay(key, 0, e.target.value)} className="h-11 rounded-xl w-24" />
                <span className="text-muted-foreground">→</span>
                <Input data-testid={PROVIDER.availDayEnd(key)} type="number" min="0" max="24" placeholder="—" value={window[1] ?? ""} onChange={(e) => updateDay(key, 1, e.target.value)} className="h-11 rounded-xl w-24" />
                <button type="button" onClick={() => setForm({ ...form, weekly_hours: { ...form.weekly_hours, [key]: [] } })} className="ml-auto text-xs text-muted-foreground hover:text-rose-600">Clear</button>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      <div className="space-y-6">
        <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
          <h3 className="font-heading text-lg font-semibold">Blocked dates</h3>
          <div className="mt-4 flex gap-2">
            <Input data-testid={PROVIDER.availBlockedInput} type="date" value={blocked} onChange={(e) => setBlocked(e.target.value)} className="h-11 rounded-xl flex-1" />
            <Button data-testid={PROVIDER.availBlockedAdd} type="button" onClick={addBlocked} className="h-11 rounded-full bg-primary">Add</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {form.blocked_dates.length === 0 && (<span className="text-xs text-muted-foreground">No blocked dates.</span>)}
            {form.blocked_dates.map((d) => (
              <span key={d} className="inline-flex items-center gap-2 rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-xs">
                {d}<button onClick={() => removeBlocked(d)}><XCircle className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        </CardContent></Card>

        <Card className="rounded-3xl border-border soft-shadow"><CardContent className="p-6">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><Route className="h-5 w-5" /> Travel zone & lead time</h3>
          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Base city</label>
              <Input data-testid={PROVIDER.availTravelCity} value={form.travel_zone.base_city} onChange={(e) => setForm({ ...form, travel_zone: { ...form.travel_zone, base_city: e.target.value } })} className="h-11 rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Radius (km)</label>
              <Input data-testid={PROVIDER.availTravelRadius} type="number" min="1" value={form.travel_zone.radius_km} onChange={(e) => setForm({ ...form, travel_zone: { ...form.travel_zone, radius_km: Number(e.target.value) } })} className="h-11 rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Minimum lead time (hours)</label>
              <Input data-testid={PROVIDER.availLeadInput} type="number" min="0" value={form.minimum_lead_hours} onChange={(e) => setForm({ ...form, minimum_lead_hours: Number(e.target.value) })} className="h-11 rounded-xl mt-1" />
            </div>
          </div>
        </CardContent></Card>

        <Button data-testid={PROVIDER.availSaveBtn} size="lg" className="w-full rounded-full h-12 bg-primary" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : "Save availability"}
        </Button>
      </div>
    </div>
  );
}

export default function ProviderDashboard() {
  const { status, user, provider } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const adminProvidersQ = useQuery({
    queryKey: ["admin", "providers", "all-for-picker"],
    queryFn: () => adminListProviders(),
    enabled: !!isAdmin,
  });
  const [selectedId, setSelectedId] = useState(null);

  const activeProviderId = provider?.id || selectedId ||
    (isAdmin && adminProvidersQ.data?.[0]?.id) || null;

  const providerQ = useQuery({
    queryKey: ["provider", activeProviderId],
    queryFn: () => getProvider(activeProviderId),
    enabled: !!activeProviderId,
  });

  if (status === "loading") return <LoadingBlock />;
  if (status === "anon") {
    return (
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
        <h2 className="font-heading text-xl font-semibold">Provider dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with Google to access your dashboard, then apply as a provider if you don't have a profile yet.</p>
        <Button className="mt-6 h-11 rounded-full bg-primary" onClick={() => navigate("/login")}>Sign in</Button>
      </div>
    );
  }
  if (!provider && !isAdmin) {
    return (
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-8 soft-shadow text-center">
        <h2 className="font-heading text-xl font-semibold">You don't have a provider profile yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">Apply to join the marketplace — the admin team will review and approve.</p>
        <Link to="/become-provider"><Button className="mt-6 h-11 rounded-full bg-primary">Apply to be a provider</Button></Link>
      </div>
    );
  }

  return (
    <div data-testid={PROVIDER.dash} className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6 soft-shadow flex flex-col md:flex-row md:items-center gap-6">
        <img src={providerQ.data?.avatar_url} alt="" className="h-16 w-16 rounded-2xl object-cover border border-border" />
        <div className="flex-1">
          <h1 className="font-heading text-2xl md:text-3xl font-semibold">
            {providerQ.data ? providerQ.data.name : "Provider dashboard"}
          </h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {providerQ.data && <StatusBadge status={providerQ.data.status} />}
            {providerQ.data && <PlanBadge plan={providerQ.data.plan} />}
            {providerQ.data?.listing_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-medium">Listing active</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-xs font-medium">Listing paused</span>
            )}
          </div>
        </div>
        {isAdmin && adminProvidersQ.data && (
          <div className="w-full md:w-64">
            <label className="text-xs font-medium text-muted-foreground">View as (admin)</label>
            <select
              data-testid={PROVIDER.identityPicker}
              value={activeProviderId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
            >
              {adminProvidersQ.data.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.city} ({p.status})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeProviderId && <OpportunityCards providerId={activeProviderId} />}

      {activeProviderId && (
        <Tabs defaultValue="bookings">
          <TabsList className="rounded-full bg-secondary p-1 h-12">
            <TabsTrigger data-testid={PROVIDER.tabBookings} value="bookings" className="rounded-full h-10 px-5">Bookings</TabsTrigger>
            <TabsTrigger data-testid={PROVIDER.tabEarnings} value="earnings" className="rounded-full h-10 px-5">Earnings</TabsTrigger>
            <TabsTrigger data-testid={PROVIDER.tabAvailability} value="availability" className="rounded-full h-10 px-5">Availability</TabsTrigger>
          </TabsList>
          <TabsContent value="bookings" className="mt-6"><BookingsPanel providerId={activeProviderId} /></TabsContent>
          <TabsContent value="earnings" className="mt-6"><EarningsWidget providerId={activeProviderId} /></TabsContent>
          <TabsContent value="availability" className="mt-6"><AvailabilityPanel providerId={activeProviderId} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
