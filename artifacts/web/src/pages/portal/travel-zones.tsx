/**
 * Provider travel-zone management — /provider/travel-zones.
 *
 * Web-only surface over the EXISTING owner-scoped travel-zone contract:
 *   GET    /providers/me/travel-zones          (useListMyTravelZones)
 *   POST   /providers/me/travel-zones          (useCreateTravelZone)
 *   DELETE /providers/me/travel-zones/:zoneId  (useDeleteTravelZone)
 *
 * The contract exposes add/list/remove only (no update endpoint), so this
 * page offers exactly those operations. Readiness C5 remains server-owned:
 * this page never computes readiness — it only invalidates the readiness
 * query so the server's next answer is reflected everywhere.
 */
import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMyTravelZones,
  useCreateTravelZone,
  useDeleteTravelZone,
  getListMyTravelZonesQueryKey,
  getGetMyProviderReadinessQueryKey,
} from '@workspace/api-client-react';
import { MapPin, Plus, Trash2, AlertCircle, LogIn, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { ROUTES } from '@/lib/routes';
import { httpStatusOf } from '@/hooks/use-notification-center';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-6" data-testid="travel-zones-page">
      {children}
    </div>
  );
}

const Header = (
  <header>
    <Link
      href={ROUTES.provider.readiness}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
      data-testid="travel-zones-back-link"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to readiness
    </Link>
    <h1 className="text-3xl font-serif font-bold text-foreground">Travel zones</h1>
    <p className="text-muted-foreground mt-1">
      Tell clients where you work. Add at least one zone to satisfy your service-area requirement.
    </p>
  </header>
);

export default function PortalTravelZones() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const query = useListMyTravelZones();
  const errorStatus = httpStatusOf(query.error);

  const [form, setForm] = useState({ zoneName: '', city: '', notes: '' });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMyTravelZonesQueryKey() });
    // Server-owned readiness (C5) may have changed — refetch, never recompute.
    queryClient.invalidateQueries({ queryKey: getGetMyProviderReadinessQueryKey() });
  };

  const createZone = useCreateTravelZone({
    mutation: {
      onSuccess: () => {
        toast.success('Travel zone added');
        setForm({ zoneName: '', city: '', notes: '' });
        invalidate();
      },
      onError: () => toast.error('Could not add the travel zone. Please try again.'),
    },
  });

  const deleteZone = useDeleteTravelZone({
    mutation: {
      onSuccess: () => {
        toast.success('Travel zone removed');
        invalidate();
      },
      onError: () => toast.error('Could not remove the travel zone. Please try again.'),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.zoneName.trim() || !form.city.trim()) {
      toast.error('Zone name and city are both required.');
      return;
    }
    createZone.mutate({
      data: {
        zoneName: form.zoneName.trim(),
        city: form.city.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <Shell>
        {Header}
        <ul className="space-y-3" aria-hidden="true" data-testid="travel-zones-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (query.isError) {
    if (errorStatus === 401) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="travel-zones-unauthorized">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LogIn /></EmptyMedia>
              <EmptyTitle>Please sign in</EmptyTitle>
              <EmptyDescription>
                Your session has expired. Sign in again to manage your travel zones.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setLocation(ROUTES.login)} data-testid="travel-zones-signin">
                Go to sign in
              </Button>
            </EmptyContent>
          </Empty>
        </Shell>
      );
    }
    if (errorStatus === 403) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="travel-zones-forbidden">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ShieldCheck /></EmptyMedia>
              <EmptyTitle>Travel zones are only available for provider accounts</EmptyTitle>
              <EmptyDescription>
                Switch to or create a provider account to manage where you work.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => setLocation(ROUTES.onboarding.provider)}
                data-testid="travel-zones-become-provider"
              >
                Become a provider
              </Button>
            </EmptyContent>
          </Empty>
        </Shell>
      );
    }
    return (
      <Shell>
        {Header}
        <Empty className="border" data-testid="travel-zones-error">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle>We couldn't load your travel zones</EmptyTitle>
            <EmptyDescription>Something went wrong. Please try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              data-testid="travel-zones-retry"
            >
              {query.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </EmptyContent>
        </Empty>
      </Shell>
    );
  }

  const zones = query.data?.zones ?? [];

  return (
    <Shell>
      {Header}

      {/* ── Existing zones ──────────────────────────────────────────────── */}
      {zones.length === 0 ? (
        <Empty className="border" data-testid="travel-zones-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
            <EmptyTitle>No travel zones yet</EmptyTitle>
            <EmptyDescription>
              Add your first zone below so clients know where you offer visits.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-3" data-testid="travel-zones-list">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4"
              data-testid={`travel-zone-${zone.id}`}
            >
              <div className="mt-0.5 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate" data-testid={`travel-zone-${zone.id}-name`}>
                  {zone.zoneName}
                </h3>
                <p className="text-sm text-muted-foreground">{zone.city}</p>
                {zone.notes ? (
                  <p className="text-sm text-muted-foreground/80 mt-1">{zone.notes}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => deleteZone.mutate({ zoneId: zone.id })}
                disabled={deleteZone.isPending}
                aria-label={`Remove ${zone.zoneName}`}
                className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                data-testid={`travel-zone-${zone.id}-remove`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Add zone (existing POST contract; no edit endpoint exists) ────── */}
      <form
        onSubmit={submit}
        className="bg-card border border-border rounded-2xl p-5 space-y-4"
        data-testid="travel-zone-add-form"
      >
        <h2 className="font-semibold text-foreground">Add a travel zone</h2>
        <div className="space-y-1.5">
          <label htmlFor="tz-name" className="text-sm font-medium text-foreground">
            Zone name <span className="text-destructive">*</span>
          </label>
          <input
            id="tz-name"
            value={form.zoneName}
            onChange={(e) => setForm({ ...form, zoneName: e.target.value })}
            maxLength={120}
            required
            placeholder="e.g. Downtown core"
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none"
            data-testid="travel-zone-name-input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tz-city" className="text-sm font-medium text-foreground">
            City <span className="text-destructive">*</span>
          </label>
          <input
            id="tz-city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            maxLength={120}
            required
            placeholder="e.g. Toronto"
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none"
            data-testid="travel-zone-city-input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tz-notes" className="text-sm font-medium text-foreground">
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="tz-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={500}
            rows={2}
            placeholder="e.g. Weekdays only; free parking required"
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none resize-none"
            data-testid="travel-zone-notes-input"
          />
        </div>
        <Button
          type="submit"
          disabled={createZone.isPending}
          className="w-full rounded-full font-semibold"
          data-testid="travel-zone-add-btn"
        >
          {createZone.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add zone
        </Button>
      </form>
    </Shell>
  );
}
