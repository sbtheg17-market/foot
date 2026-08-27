/**
 * Upcoming bookings list with a 7-day / 30-day window toggle.
 * Status is shown with color AND text; locations are FSA/city only (the API
 * never sends the full address here).
 */
import React from 'react';
import { Link } from 'wouter';
import { Calendar, Clock, MapPin } from 'lucide-react';
import type { ProviderDashboardBooking } from '@workspace/api-client-react';
import { formatBookingDate, formatBookingTime } from '@/lib/marketplace-time';
import { ROUTES } from '@/lib/routes';

const STATUS_STYLES: Record<string, { chip: string; label: string }> = {
  confirmed: { chip: 'bg-emerald-100 text-emerald-800', label: 'Confirmed' },
  requested: { chip: 'bg-amber-100 text-amber-800', label: 'Awaiting your reply' },
  rescheduled: { chip: 'bg-sky-100 text-sky-800', label: 'Rescheduled' },
};

export default function UpcomingBookings({
  bookings,
  timezone,
  timezoneReady,
}: {
  bookings: ProviderDashboardBooking[];
  timezone: string | undefined;
  timezoneReady: boolean;
}) {
  const [windowDays, setWindowDays] = React.useState<7 | 30>(7);
  const cutoff = Date.now() + windowDays * 24 * 60 * 60 * 1000;
  const visible = bookings.filter((b) => new Date(b.date).getTime() <= cutoff);

  return (
    <section
      data-testid="upcoming-bookings-section"
      aria-labelledby="upcoming-heading"
      className="space-y-4"
    >
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <h2 id="upcoming-heading" className="text-xl font-serif font-semibold">
          Upcoming bookings
        </h2>
        <div
          className="flex items-center gap-1 bg-secondary rounded-full p-1"
          role="group"
          aria-label="Upcoming bookings window"
        >
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              data-testid={`upcoming-toggle-${days}`}
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                windowDays === days
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Next {days} days
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          data-testid="upcoming-empty"
          className="bg-secondary/50 rounded-2xl p-6 text-center border border-border/50"
        >
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="text-muted-foreground font-medium">
            No bookings in the next {windowDays} days
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Sharing your booking link is the fastest way to fill your calendar.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((booking) => {
            const status = STATUS_STYLES[booking.status] ?? {
              chip: 'bg-secondary text-secondary-foreground',
              label: booking.status,
            };
            return (
              <li
                key={booking.id}
                data-testid={`upcoming-booking-${booking.id}`}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {timezoneReady
                      ? formatBookingDate(booking.date, timezone, { month: 'short' }, 'en-US')
                      : '—'}
                  </span>
                  <span className="text-lg font-serif font-bold text-foreground leading-none mt-0.5">
                    {timezoneReady
                      ? formatBookingDate(booking.date, timezone, { day: 'numeric' }, 'en-US')
                      : '—'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">
                      {timezoneReady
                        ? formatBookingTime(
                            booking.date,
                            timezone,
                            { hour: 'numeric', minute: '2-digit' },
                            'en-US',
                          )
                        : '…'}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground truncate mt-1">
                    {booking.clientName} · {booking.serviceName}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    {booking.location} area
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={ROUTES.provider.bookings}
        data-testid="upcoming-see-all-link"
        className="inline-block text-sm font-medium text-primary hover:underline"
      >
        Manage all bookings →
      </Link>
    </section>
  );
}
