import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListProviders, adminSetProviderStatus, adminToggleListing, adminRevenue, cents } from "../lib/api";
import { ADMIN } from "../constants/testIds";
import StatusBadge from "../components/StatusBadge";
import PlanBadge from "../components/PlanBadge";
import { EmptyState, LoadingBlock, ErrorBlock } from "../components/States";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { FileText, BadgeCheck, XCircle, TrendingUp, DollarSign, CalendarCheck2 } from "lucide-react";

function VerificationQueue() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "providers", "pending"],
    queryFn: () => adminListProviders({ status: "pending" }),
  });
  const mut = useMutation({
    mutationFn: ({ id, status }) => adminSetProviderStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "providers", "pending"] });
      qc.invalidateQueries({ queryKey: ["admin", "providers", "all"] });
      qc.invalidateQueries({ queryKey: ["admin", "revenue"] });
      toast.success(`Provider ${vars.status}`);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || e.message),
  });
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!data.length) return <EmptyState title="Queue is clear" message="No providers waiting for review." />;

  return (
    <div className="grid gap-4">
      {data.map((p) => (
        <article
          key={p.id}
          data-testid={ADMIN.queueRow(p.id)}
          className="rounded-3xl border border-border bg-card p-6 soft-shadow"
        >
          <div className="flex flex-col md:flex-row gap-6">
            <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover border border-border" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-lg font-semibold">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.city} · {p.categories.join(" · ")}</p>
              <p className="mt-2 text-sm">{p.bio}</p>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Documents</div>
                <div className="flex flex-wrap gap-2">
                  {p.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={ADMIN.docLink(p.id, i)}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary hover:bg-secondary/70 px-3 py-2 text-xs font-medium"
                    >
                      <FileText className="h-4 w-4" /> Doc {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex md:flex-col gap-2 md:min-w-[160px]">
              <Button
                data-testid={ADMIN.approveBtn(p.id)}
                className="rounded-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                onClick={() => mut.mutate({ id: p.id, status: "approved" })}
              >
                <BadgeCheck className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                data-testid={ADMIN.rejectBtn(p.id)}
                variant="outline"
                className="rounded-full h-11 flex-1"
                onClick={() => mut.mutate({ id: p.id, status: "rejected" })}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ListingManagement() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "providers", "all"],
    queryFn: () => adminListProviders(),
  });
  const mut = useMutation({
    mutationFn: ({ id, listing_active }) => adminToggleListing(id, listing_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "providers", "all"] });
      toast.success("Listing updated");
    },
  });
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  return (
    <div className="rounded-3xl border border-border bg-card soft-shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-6 py-4">Provider</th>
            <th className="text-left px-6 py-4">Status</th>
            <th className="text-left px-6 py-4">Plan</th>
            <th className="text-left px-6 py-4">Listing active</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} data-testid={ADMIN.listingRow(p.id)} className="border-t border-border">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-border" />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.city}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
              <td className="px-6 py-4"><PlanBadge plan={p.plan} /></td>
              <td className="px-6 py-4">
                <Switch
                  data-testid={ADMIN.listingToggle(p.id)}
                  checked={p.listing_active}
                  onCheckedChange={(v) => mut.mutate({ id: p.id, listing_active: v })}
                  disabled={p.status !== "approved"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueDashboard() {
  const [win, setWin] = useState("weekly");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "revenue", win],
    queryFn: () => adminRevenue(win),
  });
  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  const maxGmv = Math.max(1, ...data.series.map((s) => s.gmv_cents));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">View</span>
        <div data-testid={ADMIN.revenueWindow} className="inline-flex rounded-full border border-border bg-white p-1">
          {["weekly", "daily"].map((w) => (
            <button
              key={w}
              data-testid={`admin-revenue-${w}`}
              onClick={() => setWin(w)}
              className={`h-9 rounded-full px-4 text-sm font-medium capitalize ${
                win === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div data-testid={ADMIN.revenueStats} className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border-border soft-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <DollarSign className="h-4 w-4" /> GMV
            </div>
            <div className="font-heading text-3xl font-semibold mt-2">{cents(data.totals.gmv_cents)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border soft-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <TrendingUp className="h-4 w-4" /> Commission revenue
            </div>
            <div className="font-heading text-3xl font-semibold mt-2">{cents(data.totals.platform_fee_cents)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border soft-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <CalendarCheck2 className="h-4 w-4" /> Bookings
            </div>
            <div className="font-heading text-3xl font-semibold mt-2">{data.totals.total_bookings}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.totals.completed_bookings} completed · {data.totals.requested_bookings} pending
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border soft-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <BadgeCheck className="h-4 w-4" /> Providers
            </div>
            <div className="font-heading text-3xl font-semibold mt-2">{data.totals.active_providers}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.totals.pending_providers} awaiting review
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-border soft-shadow">
        <CardContent className="p-6">
          <h3 className="font-heading text-lg font-semibold">GMV over time</h3>
          <div className="mt-6 flex items-end gap-2 h-40">
            {data.series.map((s) => (
              <div key={s.period} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-primary/80 hover:bg-primary transition-colors"
                  style={{ height: `${(s.gmv_cents / maxGmv) * 100}%`, minHeight: s.gmv_cents ? 4 : 0 }}
                  title={cents(s.gmv_cents)}
                />
                <span className="text-[10px] text-muted-foreground">
                  {win === "daily"
                    ? new Date(s.period).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : new Date(s.period).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPortal() {
  return (
    <div data-testid={ADMIN.root} className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6 soft-shadow">
        <h1 className="font-heading text-2xl md:text-3xl font-semibold">Admin control room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify providers, keep listings healthy, and monitor platform revenue.
        </p>
      </div>
      <Tabs defaultValue="queue">
        <TabsList className="rounded-full bg-secondary p-1 h-12">
          <TabsTrigger data-testid={ADMIN.tabQueue} value="queue" className="rounded-full h-10 px-5">Verification queue</TabsTrigger>
          <TabsTrigger data-testid={ADMIN.tabListings} value="listings" className="rounded-full h-10 px-5">Listings</TabsTrigger>
          <TabsTrigger data-testid={ADMIN.tabRevenue} value="revenue" className="rounded-full h-10 px-5">Revenue</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-6"><VerificationQueue /></TabsContent>
        <TabsContent value="listings" className="mt-6"><ListingManagement /></TabsContent>
        <TabsContent value="revenue" className="mt-6"><RevenueDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
