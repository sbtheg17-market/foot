/**
 * Provider-owned public booking page — /book/:providerSlug (roadmap #11).
 *
 * One canonical, shareable booking surface per provider (social bio links,
 * texts, QR cards, print, provider websites). Renders from
 * GET /booking-pages/:slug — the same source of truth as marketplace
 * discovery — and books through the existing slots + bookings endpoints via
 * the returned provider id (no duplicated booking logic).
 *
 * Missing, unpublished, and inactive providers all render the same generic
 * not-found state. An optional allowlisted ?source= attribution parameter
 * (instagram, qr-card, text, facebook, website) is forwarded with the booking
 * request; anything else is ignored client-side and dropped server-side.
 */
import React, { useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import {
  useGetPublicBookingPage,
  useListProviderReviews,
  useGetMe,
} from '@workspace/api-client-react';
import {
  MapPin, Star, ShieldCheck, Clock, CheckCircle2, CalendarClock, Globe, CalendarX2,
} from 'lucide-react';
import BookingModal from '@/components/ui/booking-modal';
import { ROUTES } from '@/lib/routes';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Client-side mirror of the server attribution allowlist. */
export const BOOKING_SOURCE_ALLOWLIST = ['instagram', 'qr-card', 'text', 'facebook', 'website'] as const;

/** Normalize + allowlist the ?source= parameter; unknown values become null. */
export function readAttributionSource(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get('source');
    if (!raw) return null;
    const value = raw.trim().toLowerCase();
    return (BOOKING_SOURCE_ALLOWLIST as readonly string[]).includes(value) ? value : null;
  } catch {
    return null;
  }
}

export default function PublicBookingPage() {
  const [, params] = useRoute('/book/:slug');
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? '';

  const source = useMemo(
    () => readAttributionSource(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useGetPublicBookingPage(slug, {
    query: { enabled: slug.length > 0, retry: false, queryKey: ['booking-page', slug] },
  });

  const page = data?.page;
  const providerId = page?.provider.id ?? 0;

  const { data: reviewsRes } = useListProviderReviews(providerId, undefined, {
    query: { enabled: providerId > 0, queryKey: ['reviews', providerId] },
  });
  const { data: me, isLoading: authLoading } = useGetMe({
    query: { retry: false, queryKey: ['me'] },
  });

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 pt-20 flex justify-center" data-testid="public-booking-loading">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const notFound = !slug || (isError && (error as { status?: number } | null)?.status === 404) || (!isError && !page);
  if (notFound) {
    return (
      <div className="p-6 pt-16 max-w-md mx-auto text-center" data-testid="public-booking-not-found">
        <CalendarX2 className="w-10 h-10 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-serif font-bold text-foreground">This booking page isn't available</h1>
        <p className="text-muted-foreground mt-2">
          The link may be incorrect, or the provider isn't taking online bookings right now.
        </p>
        <button
          type="button"
          onClick={() => setLocation(ROUTES.client.discover)}
          data-testid="public-booking-browse-link"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Browse providers
        </button>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="p-6 pt-16 max-w-md mx-auto text-center" data-testid="public-booking-error">
        <p className="font-semibold text-foreground">We couldn't load this booking page</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="public-booking-retry"
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium"
        >
          {isFetching ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    );
  }

  const provider = page.provider;
  const services = page.services;
  const windows = page.availability.windows;
  const timezone = page.availability.timezone;
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const canBook = me?.user?.role === 'client';

  const handleBook = () => {
    if (authLoading) return;
    if (!me?.user) {
      setLocation(ROUTES.login);
      return;
    }
    if (me.user.role !== 'client') {
      setLocation(me.user.role === 'provider' ? ROUTES.provider.root : ROUTES.admin.verification);
      return;
    }
    setShowBookingModal(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-card pb-24 relative" data-testid="public-booking-page">
      <div className="h-40 bg-secondary w-full relative">
        {provider.avatarUrl ? (
          <img src={provider.avatarUrl} className="w-full h-full object-cover" alt={`${provider.firstName} ${provider.lastName}`} />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-6xl font-serif font-bold text-primary/30">{provider.firstName[0]}</span>
          </div>
        )}
      </div>

      <div className="px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-border/50">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="public-booking-provider-name">
                {provider.firstName} {provider.lastName}
              </h1>
              <p className="text-primary font-medium">{provider.title || 'Foot care professional'}</p>
            </div>
            {provider.verificationStatus === 'approved' && (
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Credentials verified
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4 border-t border-border pt-4">
            {provider.reviewCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-accent text-accent" aria-hidden="true" />
                <span className="font-semibold text-foreground">{provider.rating}</span>
                <span>({provider.reviewCount} reviews)</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>{provider.city}</span>
            </div>
            {provider.yearsExperience != null && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" aria-hidden="true" />
                <span>{provider.yearsExperience} yrs exp.</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {provider.acceptsNewClients ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Accepting new clients
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-muted-foreground px-3 py-1.5 text-xs font-semibold">
                Currently fully booked
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 mt-8 space-y-8">
        {provider.bio && (
          <section>
            <h2 className="text-xl font-serif font-semibold mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed">{provider.bio}</p>
          </section>
        )}

        {provider.serviceAreaNotes && (
          <section className="rounded-2xl bg-secondary/60 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold mb-1">Service area</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{provider.serviceAreaNotes}</p>
              </div>
            </div>
          </section>
        )}

        <section data-testid="public-booking-services">
          <h2 className="text-xl font-serif font-semibold mb-4">Services</h2>
          {services.length === 0 ? (
            <p className="text-muted-foreground italic" data-testid="public-booking-no-services">
              No services are bookable right now.
            </p>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  aria-pressed={selectedServiceId === service.id}
                  data-testid={`public-booking-service-${service.id}`}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedServiceId === service.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-lg">{service.title}</h3>
                    <span className="font-serif font-semibold text-primary text-lg">
                      ${(service.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{service.durationMinutes} mins</span>
                  </div>
                  {service.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {windows.length > 0 && (
          <section data-testid="public-booking-availability">
            <h2 className="text-xl font-serif font-semibold mb-4 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" aria-hidden="true" />
              Weekly availability
            </h2>
            <div className="space-y-2">
              {DAY_NAMES.map((dayName, dow) => {
                const dayWindows = windows.filter((w) => w.dayOfWeek === dow);
                if (dayWindows.length === 0) return null;
                return (
                  <div key={dow} className="flex items-center justify-between text-sm border-b border-border/60 pb-2">
                    <span className="font-medium text-foreground">{dayName}</span>
                    <span className="text-muted-foreground">
                      {dayWindows.map((w) => `${w.startTime}–${w.endTime}`).join(', ')}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3" data-testid="public-booking-timezone">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              Times shown in {timezone.replace(/_/g, ' ')}
            </p>
          </section>
        )}

        <section>
          <h2 className="text-xl font-serif font-semibold mb-4">Reviews</h2>
          {!reviewsRes || reviewsRes.reviews.length === 0 ? (
            <p className="text-muted-foreground italic">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviewsRes.reviews.map((review) => (
                <div key={review.id} className="p-4 bg-secondary/50 rounded-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{review.clientFirstName}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-accent text-accent' : 'fill-muted text-muted'}`} aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-foreground/80">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-border max-w-[500px] mx-auto z-40">
        <button
          type="button"
          disabled={!selectedServiceId || !provider.acceptsNewClients}
          onClick={handleBook}
          data-testid="public-booking-cta"
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {provider.acceptsNewClients ? (
            selectedServiceId
              ? me?.user && !canBook
                ? 'Client account required to book'
                : 'Book Appointment'
              : 'Select a service to book'
          ) : 'Not accepting new clients'}
        </button>
      </div>

      {showBookingModal && selectedService && (
        <BookingModal
          providerId={provider.id}
          providerName={`${provider.firstName} ${provider.lastName}`}
          service={selectedService}
          source={source}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
}
