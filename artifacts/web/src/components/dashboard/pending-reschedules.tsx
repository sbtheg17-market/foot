/**
 * Pending reschedule requests (Provider Dashboard Phase A).
 *
 * Surfaces client-initiated reschedule requests (bookings in status
 * `rescheduled`, state machine rescheduled → confirmed | cancelled) that
 * are waiting on the provider. Data comes from the same owner-scoped
 * dashboard read (GET /providers/me/dashboard) — count plus the
 * privacy-trimmed soonest request only. All review/confirm/decline actions
 * stay in the existing bookings workflow; nothing is auto-accepted,
 * auto-declined, or auto-cancelled here.
 */
import React from 'react';
import { Link } from 'wouter';
import { CalendarCheck2, CalendarClock } from 'lucide-react';
import type { ProviderDashboardResponse } from '@workspace/api-client-react';
import { formatBookingDate, formatBookingTime } from '@/lib/marketplace-time';
import { ROUTES } from '@/lib/routes';

/** Deep link into the existing bookings page, Reschedules tab. */
export const RESCHEDULES_TAB_HREF = `${ROUTES.provider.bookings}?tab=rescheduled`;

export default function PendingReschedules({
  pending,
  timezone,
  timezoneReady,
}: {
  pending: ProviderDashboardResponse['pendingReschedules'];
  timezone: string | undefined;
  timezoneReady: boolean;
}) {
  if (pending.count === 0) {
    return (
      <section
        className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2.5 text-sm text-muted-foreground"
        data-testid="pending-reschedules-empty"
        aria-label="Schedule change requests"
      >
        <CalendarCheck2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>No pending schedule changes</span>
      </section>
    );
  }

  const many = pending.count > 1;
  const next = pending.nextRequest;

  return (
    <section
      className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-3"
      data-testid="pending-reschedules-card"
      aria-labelledby="pending-reschedules-heading"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
          <CalendarClock className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2
            id="pending-reschedules-heading"
            className="text-lg font-serif font-semibold text-amber-900"
          >
            {pending.count} reschedule request{many ? 's' : ''} need{many ? '' : 's'} your
            attention
          </h2>
          <p className="text-sm text-amber-800/90 mt-1">
            A client requested a new appointment time. Review it in your bookings to
            confirm the new time or decline.
          </p>
          {next && (
            <p
              className="text-sm text-amber-900 bg-white/70 border border-amber-200 rounded-xl px-3 py-2 mt-3"
              data-testid="pending-reschedule-next"
            >
              Soonest requested time:{' '}
              <span className="font-semibold">
                {timezoneReady
                  ? `${formatBookingDate(
                      next.date,
                      timezone,
                      { weekday: 'short', month: 'short', day: 'numeric' },
                      'en-US',
                    )} at ${formatBookingTime(
                      next.date,
                      timezone,
                      { hour: 'numeric', minute: '2-digit' },
                      'en-US',
                    )}`
                  : '…'}
              </span>{' '}
              — {next.clientName}, {next.serviceName}
            </p>
          )}
        </div>
      </div>
      <Link
        href={RESCHEDULES_TAB_HREF}
        data-testid="pending-reschedules-review-link"
        className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Review request{many ? 's' : ''}
      </Link>
    </section>
  );
}
