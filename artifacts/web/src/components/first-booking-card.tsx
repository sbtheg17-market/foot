/**
 * First-booking conversion card (provider dashboard).
 *
 * Server-computed readiness (GET /providers/me/readiness) is authoritative —
 * this component never derives activation locally and renders no public
 * sharing controls unless the server says `activated: true`.
 *
 * States for an activated provider:
 *   - zero bookings (count known)  → full "You're live" CTA with the
 *     canonical public listing URL, Share/Copy/Open actions, and concise
 *     next-step guidance;
 *   - one or more bookings         → compact persistent share row;
 *   - booking count unavailable    → compact row (never claims zero).
 *
 * Unapproved / not-ready providers: renders nothing — the dashboard's
 * readiness summary remains the only activation surface.
 */
import React from 'react';
import { PartyPopper, Share2 } from 'lucide-react';
import {
  useGetMyProviderProfile,
  useGetMyProviderReadiness,
  useListBookings,
} from '@workspace/api-client-react';
import ShareListingActions from '@/components/share-listing-actions';
import { publicListingUrl } from '@/lib/routes';

export default function FirstBookingCard() {
  const readinessQuery = useGetMyProviderReadiness({
    query: { queryKey: ['my-readiness'] },
  });
  const profileQuery = useGetMyProviderProfile({
    query: { queryKey: ['my-profile'] },
  });

  const activated = readinessQuery.data?.readiness?.activated === true;
  const providerId = profileQuery.data?.provider?.id;

  // Bookings are only listable by approved providers; keep the query gated
  // on server-confirmed activation so unready providers never fire it here.
  const bookingsQuery = useListBookings(undefined, {
    query: {
      queryKey: ['bookings', 'all-first-booking'],
      enabled: activated,
    },
  });

  // No sharing controls unless the server confirms activation and we know
  // the canonical public id.
  if (!activated || typeof providerId !== 'number') return null;

  const total = bookingsQuery.data?.total;
  const countKnown = bookingsQuery.isSuccess && typeof total === 'number';
  const hasZeroBookings = countKnown && total === 0;

  if (hasZeroBookings) {
    return (
      <section
        className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-4"
        data-testid="first-booking-cta"
        aria-labelledby="first-booking-cta-title"
      >
        <div className="flex items-start gap-4">
          <div className="mt-0.5 bg-emerald-100 p-2 rounded-full text-emerald-700 shrink-0">
            <PartyPopper className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="first-booking-cta-title"
              className="font-serif font-bold text-lg text-emerald-900"
            >
              You're live — share your listing
            </h2>
            <p className="text-sm text-emerald-800/80 mt-1">
              Clients can now find and book you. Share your listing with past
              clients and your community to land your first booking.
            </p>
          </div>
        </div>
        <p
          className="text-sm font-medium text-emerald-900 bg-white/70 border border-emerald-200 rounded-xl px-3 py-2 break-all"
          data-testid="first-booking-url"
        >
          {publicListingUrl(providerId)}
        </p>
        <ShareListingActions providerId={providerId} />
      </section>
    );
  }

  // One or more bookings — or count unavailable (never claim zero):
  // compact, persistent share row.
  return (
    <section
      className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3"
      data-testid="first-booking-share-row"
      aria-label="Share your listing"
    >
      <div className="bg-primary/10 p-2 rounded-full text-primary shrink-0">
        <Share2 className="w-4 h-4" aria-hidden="true" />
      </div>
      <span className="text-sm font-semibold text-foreground flex-1 min-w-32">
        Share your listing
      </span>
      <ShareListingActions providerId={providerId} variant="compact" />
    </section>
  );
}
