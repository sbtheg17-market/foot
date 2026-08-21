/**
 * Provider listing preview — owner-scoped (/provider/listing-preview).
 *
 * Renders how the provider's marketplace listing appears — profile, active
 * services, weekly availability, effective timezone, and real generated
 * 30-minute slots — using the owner-scoped GET /providers/me/listing-preview.
 * Draft/under-review providers can preview before approval; the page never
 * implies the provider is publicly bookable before approval.
 */
import React from 'react';
import { Link } from 'wouter';
import {
  MapPin, Star, Clock, CalendarClock, Globe, ShieldCheck, Eye, ListChecks, AlertCircle,
} from 'lucide-react';
import { useGetMyListingPreview } from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';
import { READINESS_ITEMS, labelForCode } from '@/lib/readiness';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PortalListingPreview() {
  const { data, isLoading, isError, refetch, isFetching } = useGetMyListingPreview({
    query: { queryKey: ['listing-preview'] },
  });

  if (isLoading) {
    return (
      <div className="p-6 pt-20 flex justify-center" data-testid="listing-preview-loading">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !data?.preview) {
    return (
      <div className="p-6 pt-10 max-w-2xl mx-auto" data-testid="listing-preview-error">
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">We couldn't load your listing preview</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="listing-preview-retry"
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  const p = data.preview;
  const readiness = p.readiness ?? null;
  const missingItems = readiness
    ? READINESS_ITEMS.filter((it) => !readiness.criteria[it.criterion])
    : [];
  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: p.timezone,
    });

  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-6" data-testid="listing-preview-page">
      <header>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" /> Listing preview
        </h1>
        <p className="text-muted-foreground mt-1">This is how clients see you on the marketplace.</p>
      </header>

      {/* State banner */}
      {p.isPublic ? (
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
          data-testid="listing-preview-state-live" data-state="live"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Live marketplace view</p>
            <p className="text-sm text-emerald-800/80">Your listing is approved — clients can discover and book you.</p>
          </div>
        </div>
      ) : (
        <div
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3"
          data-testid="listing-preview-state-preview" data-state="preview"
        >
          <Eye className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">Preview — not public yet</p>
            <p className="text-sm text-amber-800/80">
              Only you can see this. Your listing becomes bookable after your application is approved.
            </p>
          </div>
        </div>
      )}

      {/* Not-ready next action */}
      {readiness && !readiness.activated && (
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="listing-preview-missing">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Before clients can book you</h2>
          </div>
          <ul className="space-y-1.5 mb-4">
            {missingItems.map((it) => (
              <li key={it.code} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`listing-preview-missing-${it.code}`}>
                <span className="text-amber-500 mt-0.5">•</span>{it.missingDescription}
              </li>
            ))}
            {readiness.missing
              .filter((code) => !READINESS_ITEMS.some((it) => it.code === code))
              .map((code) => (
                <li key={code} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>{labelForCode(code).description}
                </li>
              ))}
          </ul>
          <Link
            href={ROUTES.provider.readiness}
            data-testid="listing-preview-readiness-link"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Go to readiness checklist
          </Link>
        </div>
      )}

      {/* Profile card */}
      <section className="bg-card border border-border rounded-3xl p-6" data-testid="listing-preview-profile">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-2xl font-serif font-bold text-secondary-foreground overflow-hidden shrink-0">
            {p.profile.avatarUrl
              ? <img src={p.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              : (p.profile.firstName?.[0] ?? 'P')}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-serif font-bold text-foreground">
              {p.profile.firstName} {p.profile.lastName}
            </h2>
            <p className="text-primary font-medium">{p.profile.title}</p>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.profile.city}</span>
              {typeof p.profile.rating === 'number' && p.profile.reviewCount > 0 && (
                <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" />{p.profile.rating.toFixed(1)} ({p.profile.reviewCount})</span>
              )}
            </div>
          </div>
        </div>
        {p.profile.bio && <p className="text-sm text-muted-foreground mt-4 leading-6">{p.profile.bio}</p>}
      </section>

      {/* Services */}
      <section data-testid="listing-preview-services">
        <h2 className="text-lg font-serif font-semibold mb-3">Services</h2>
        {p.services.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-dashed border-border rounded-2xl p-4">
            No active services yet. Add a service so clients have something to book.
          </p>
        ) : (
          <div className="space-y-3">
            {p.services.map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between" data-testid={`listing-preview-service-${s.id}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{s.title}</p>
                  {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{s.durationMinutes} min</p>
                </div>
                <span className="font-semibold text-foreground shrink-0">${(s.priceCents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly availability */}
      <section data-testid="listing-preview-availability">
        <h2 className="text-lg font-serif font-semibold mb-3 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" /> Weekly availability
        </h2>
        {p.availability?.length ? (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            {DAY_NAMES.map((name, dow) => {
              const wins = p.availability!.filter((w) => w.dayOfWeek === dow);
              if (wins.length === 0) return null;
              return (
                <div key={dow} className="flex items-center justify-between text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0">
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="text-muted-foreground">{wins.map((w) => `${w.startTime}–${w.endTime}`).join(', ')}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground bg-card border border-dashed border-border rounded-2xl p-4">
            No availability set yet. Add weekly hours so clients can pick a time.
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2" data-testid="listing-preview-timezone">
          <Globe className="w-3.5 h-3.5" /> Times shown in {p.timezone.replace(/_/g, ' ')}
        </p>
      </section>

      {/* Real slot preview */}
      <section data-testid="listing-preview-slots">
        <h2 className="text-lg font-serif font-semibold mb-3">Bookable times (next 7 days)</h2>
        {p.slotPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-dashed border-border rounded-2xl p-4" data-testid="listing-preview-no-slots">
            No bookable slots yet — add an active service and weekly availability to generate real slots.
          </p>
        ) : (
          <div className="space-y-4">
            {p.slotPreview.slice(0, 3).map((day) => (
              <div key={day.date} className="bg-card border border-border rounded-2xl p-4" data-testid={`listing-preview-slotday-${day.date}`}>
                <p className="text-sm font-semibold text-foreground mb-2">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {day.slots.slice(0, 12).map((s) => (
                    <span key={s.start} className="px-2 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary/40 text-foreground text-center">
                      {slotLabel(s.start)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
