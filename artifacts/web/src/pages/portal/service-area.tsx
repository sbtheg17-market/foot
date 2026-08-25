/**
 * Provider service-area settings — /provider/service-area (roadmap #12).
 *
 * "Areas you serve": Canada-first coverage by postal area (FSA — the first
 * three characters of a Canadian postal code, e.g. M5V). Owner-scoped over:
 *   GET    /providers/me/service-area                    (useGetMyServiceArea)
 *   PUT    /providers/me/service-area                    (useUpdateMyServiceArea)
 *   POST   /providers/me/service-area/prefixes           (useAddMyServiceAreaPrefix)
 *   DELETE /providers/me/service-area/prefixes/:prefixId (useRemoveMyServiceAreaPrefix)
 *
 * Also shows the centrally managed travel/setup buffer (visible, not
 * editable — provider overrides are deferred) and publish eligibility for
 * the public booking page. Coverage changes apply to FUTURE bookings and
 * future reschedules only; existing confirmed appointments stay valid.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMyServiceArea,
  useUpdateMyServiceArea,
  useAddMyServiceAreaPrefix,
  useRemoveMyServiceAreaPrefix,
  getGetMyServiceAreaQueryKey,
} from '@workspace/api-client-react';
import {
  MapPin, Plus, Trash2, AlertCircle, LogIn, ShieldCheck, ArrowLeft, Loader2,
  Clock, Globe2, CheckCircle2, ExternalLink,
} from 'lucide-react';
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
import { CANADIAN_PROVINCES } from '@/lib/canadian-geo';
import { httpStatusOf } from '@/hooks/use-notification-center';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-6" data-testid="service-area-page">
      {children}
    </div>
  );
}

const Header = (
  <header>
    <Link
      href={ROUTES.provider.dashboard}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
      data-testid="service-area-back-link"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to dashboard
    </Link>
    <h1 className="text-3xl font-serif font-bold text-foreground">Areas you serve</h1>
    <p className="text-muted-foreground mt-1">
      Clients check their postal code on your booking page before they book — clients
      outside these postal areas cannot book by mistake.
    </p>
  </header>
);

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border ' +
  'focus:ring-2 focus:ring-primary focus:outline-none text-foreground';

export default function PortalServiceArea() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const query = useGetMyServiceArea();
  const errorStatus = httpStatusOf(query.error);

  const serviceArea = query.data?.serviceArea;

  const [form, setForm] = useState({ provinceCode: '', city: '', publicDescription: '' });
  const [newPrefix, setNewPrefix] = useState('');

  // Hydrate the settings form once from the server response.
  useEffect(() => {
    if (serviceArea) {
      setForm({
        provinceCode: serviceArea.provinceCode ?? '',
        city: serviceArea.city ?? '',
        publicDescription: serviceArea.publicDescription ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetMyServiceAreaQueryKey() });
    // Publish eligibility on the booking-page card may have changed.
    queryClient.invalidateQueries({ queryKey: ['my-booking-page'] });
  };

  const updateArea = useUpdateMyServiceArea({
    mutation: {
      onSuccess: () => {
        toast.success('Service area saved');
        invalidate();
      },
      onError: (err: unknown) => {
        const apiError = err as { data?: { error?: string } | null };
        toast.error(apiError.data?.error ?? 'Could not save your service area. Please try again.');
      },
    },
  });

  const addPrefix = useAddMyServiceAreaPrefix({
    mutation: {
      onSuccess: () => {
        toast.success('Postal area added');
        setNewPrefix('');
        invalidate();
      },
      onError: (err: unknown) => {
        const apiError = err as { data?: { error?: string } | null };
        toast.error(apiError.data?.error ?? 'Could not add the postal area. Please try again.');
      },
    },
  });

  const removePrefix = useRemoveMyServiceAreaPrefix({
    mutation: {
      onSuccess: () => {
        toast.success('Postal area removed');
        invalidate();
      },
      onError: () => toast.error('Could not remove the postal area. Please try again.'),
    },
  });

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provinceCode) {
      toast.error('Choose your province or territory first.');
      return;
    }
    updateArea.mutate({
      data: {
        countryCode: 'CA',
        provinceCode: form.provinceCode,
        city: form.city.trim() || null,
        publicDescription: form.publicDescription.trim() || null,
      },
    });
  };

  const submitPrefix = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix.trim()) {
      toast.error('Enter a postal area first — for example M5V.');
      return;
    }
    addPrefix.mutate({ data: { prefix: newPrefix.trim() } });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <Shell>
        {Header}
        <div className="space-y-3" aria-hidden="true" data-testid="service-area-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (query.isError) {
    if (errorStatus === 401) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="service-area-unauthorized">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LogIn /></EmptyMedia>
              <EmptyTitle>Please sign in</EmptyTitle>
              <EmptyDescription>
                Your session has expired. Sign in again to manage the areas you serve.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setLocation(ROUTES.login)} data-testid="service-area-signin">
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
          <Empty className="border" data-testid="service-area-forbidden">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ShieldCheck /></EmptyMedia>
              <EmptyTitle>Service areas are only available for provider accounts</EmptyTitle>
              <EmptyDescription>
                Switch to or create a provider account to manage the areas you serve.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => setLocation(ROUTES.onboarding.provider)}
                data-testid="service-area-become-provider"
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
        <Empty className="border" data-testid="service-area-error">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle>We couldn't load your service area</EmptyTitle>
            <EmptyDescription>Something went wrong. Please try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              data-testid="service-area-retry"
            >
              {query.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </EmptyContent>
        </Empty>
      </Shell>
    );
  }

  if (!serviceArea) return null;

  const prefixes = serviceArea.prefixes;
  const hasConfig = Boolean(serviceArea.provinceCode);

  return (
    <Shell>
      {Header}

      {/* ── Status: publish eligibility ─────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-4 flex items-start gap-3 ${
          serviceArea.configured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-secondary/60 border-border text-muted-foreground'
        }`}
        role="status"
        data-testid="service-area-status"
      >
        {serviceArea.configured ? (
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <Globe2 className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
        )}
        <p className="text-sm leading-relaxed">
          {serviceArea.configured ? (
            <>
              <span className="font-semibold">Your service area is set.</span> Clients check
              their postal code on your booking page before choosing a time, and your public
              booking page can be published.
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">Not set up yet.</span> Save your
              province and add at least one postal area below — this is required before your
              public booking page can be published.
            </>
          )}
        </p>
      </div>

      {/* ── Settings form ────────────────────────────────────────────────── */}
      <form
        onSubmit={saveSettings}
        className="bg-card border border-border rounded-2xl p-5 space-y-4"
        data-testid="service-area-settings-form"
      >
        <h2 className="font-semibold text-foreground">Where you work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="sa-country" className="text-sm font-medium text-foreground">
              Country
            </label>
            <select id="sa-country" value="CA" disabled className={inputClass} data-testid="service-area-country-select">
              <option value="CA">Canada</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sa-province" className="text-sm font-medium text-foreground">
              Province or territory <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <select
              id="sa-province"
              value={form.provinceCode}
              onChange={(e) => setForm({ ...form, provinceCode: e.target.value })}
              required
              className={inputClass}
              data-testid="service-area-province-select"
            >
              <option value="" disabled>Select…</option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sa-city" className="text-sm font-medium text-foreground">
            Main city <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="sa-city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            maxLength={120}
            placeholder="e.g. Toronto"
            className={inputClass}
            data-testid="service-area-city-input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sa-description" className="text-sm font-medium text-foreground">
            Service area description <span className="text-muted-foreground font-normal">(shown to clients)</span>
          </label>
          <textarea
            id="sa-description"
            value={form.publicDescription}
            onChange={(e) => setForm({ ...form, publicDescription: e.target.value })}
            maxLength={500}
            rows={2}
            placeholder="e.g. Serving downtown Toronto and East York"
            className={`${inputClass} resize-none`}
            data-testid="service-area-description-input"
          />
          <p className="text-xs text-muted-foreground">
            Appears on your public booking page. Your postal-area list itself is never shown
            to clients — they only see whether their own postal code is covered.
          </p>
        </div>
        <Button
          type="submit"
          disabled={updateArea.isPending}
          className="w-full rounded-full font-semibold"
          data-testid="service-area-save-btn"
        >
          {updateArea.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save service area
        </Button>
      </form>

      {/* ── Postal areas ────────────────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="postal-areas-heading">
        <div>
          <h2 id="postal-areas-heading" className="font-semibold text-foreground">Postal areas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            In Canada, the first three characters of a postal code identify a local area,
            for example <span className="font-mono font-semibold text-foreground">M5V</span>.
            Add each area you travel to.
          </p>
        </div>

        {prefixes.length === 0 ? (
          <Empty className="border" data-testid="service-area-prefixes-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
              <EmptyTitle>No postal areas yet</EmptyTitle>
              <EmptyDescription>
                Add your first postal area below so clients can check whether you serve them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="service-area-prefix-list">
            {prefixes.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card pl-4 pr-2 py-1.5"
                data-testid={`service-area-prefix-${p.id}`}
              >
                <span className="font-mono font-semibold text-foreground">{p.prefix}</span>
                <button
                  type="button"
                  onClick={() => removePrefix.mutate({ prefixId: p.id })}
                  disabled={removePrefix.isPending}
                  aria-label={`Remove postal area ${p.prefix}`}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  data-testid={`service-area-prefix-${p.id}-remove`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submitPrefix} className="flex gap-2" data-testid="service-area-prefix-form">
          <div className="flex-1">
            <label htmlFor="sa-new-prefix" className="sr-only">
              Add a postal area (first three characters of a postal code, e.g. M5V)
            </label>
            <input
              id="sa-new-prefix"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
              maxLength={7}
              placeholder="e.g. M5V"
              disabled={!hasConfig}
              className={inputClass}
              data-testid="service-area-prefix-input"
            />
          </div>
          <Button
            type="submit"
            disabled={addPrefix.isPending || !hasConfig}
            className="rounded-full font-semibold shrink-0"
            data-testid="service-area-prefix-add-btn"
          >
            {addPrefix.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </form>
        {!hasConfig && (
          <p className="text-xs text-muted-foreground" data-testid="service-area-prefix-hint">
            Save your province above first, then add postal areas.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Removing a postal area only affects new bookings and future time changes —
          appointments already on your calendar stay exactly as scheduled.
        </p>
      </section>

      {/* ── Travel/setup buffer (visible, centrally managed) ─────────────── */}
      <section
        className="bg-card border border-border rounded-2xl p-5"
        aria-labelledby="buffer-heading"
        data-testid="service-area-buffer"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="buffer-heading" className="font-semibold text-foreground">Time between appointments</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Available appointment times automatically include{' '}
              <span className="font-semibold text-foreground" data-testid="service-area-buffer-minutes">
                {serviceArea.bufferMinutes} minutes
              </span>{' '}
              between appointments for your travel and setup. This is managed by OnCall Foot
              for all providers right now — you don't need to pad your availability yourself.
            </p>
          </div>
        </div>
      </section>

      {/* ── What clients see / preview ───────────────────────────────────── */}
      <section className="bg-secondary/60 border border-border rounded-2xl p-5" data-testid="service-area-client-view">
        <h2 className="font-semibold text-foreground mb-1">What clients see</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          On your booking page, clients enter their postal code first. If it's inside your
          postal areas they continue to services and times; if not, they see a friendly
          message that you don't currently serve that area. Your exact postal-area list is
          never shown.
        </p>
        <Link
          href={ROUTES.provider.listingPreview}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          data-testid="service-area-preview-link"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Preview and share your booking page
        </Link>
      </section>
    </Shell>
  );
}
