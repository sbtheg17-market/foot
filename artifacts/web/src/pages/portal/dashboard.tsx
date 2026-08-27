/**
 * Provider dashboard (canonical /provider/dashboard) — conversion-first.
 *
 * One owner-scoped read (GET /api/providers/me/dashboard) drives every
 * section: greeting + today, quick actions, upcoming bookings, personal
 * performance metrics, booking-link tools with source attribution, recent
 * activity, and the earnings preview. Read-only; the only mutations reachable
 * from here are the existing booking-page publish/share actions.
 */
import React from 'react';
import { useGetMyProviderDashboard } from '@workspace/api-client-react';
import { useMarketplaceTimezone, formatBookingDate, formatBookingTime } from '@/lib/marketplace-time';
import ReadinessSummaryCard from '@/components/readiness-summary-card';
import FirstBookingCard from '@/components/first-booking-card';
import BookingPageCard from '@/components/booking-page-card';
import QuickActions from '@/components/dashboard/quick-actions';
import NextBestActionCard from '@/components/dashboard/next-best-action';
import PendingReschedules from '@/components/dashboard/pending-reschedules';
import UpcomingBookings from '@/components/dashboard/upcoming-bookings';
import PerformanceMetrics from '@/components/dashboard/performance-metrics';
import SourceAttributionChart from '@/components/dashboard/source-attribution-chart';
import RecentActivity from '@/components/dashboard/recent-activity';
import EarningsPreview from '@/components/dashboard/earnings-preview';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function PortalDashboard() {
  const { data, isLoading, isError, refetch } = useGetMyProviderDashboard({
    query: { queryKey: ['my-dashboard'] },
  });
  const { timezone, status: timezoneStatus } = useMarketplaceTimezone(data?.providerId);
  const timezoneReady = timezoneStatus === 'ready' || timezoneStatus === 'unavailable';

  if (isLoading) {
    return (
      <div
        className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-6"
        data-testid="dashboard-loading"
        aria-busy="true"
        aria-label="Loading your dashboard"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-secondary/60 rounded-3xl animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 pt-20 max-w-md mx-auto text-center space-y-4" data-testid="dashboard-error">
        <h1 className="text-xl font-serif font-semibold text-foreground">
          We couldn't load your dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again. If this keeps happening, the support link at the
          bottom of the page will reach us.
        </p>
        <button
          type="button"
          data-testid="dashboard-retry"
          onClick={() => refetch()}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }

  const firstName = data.providerName.split(' ')[0] || 'there';
  const next = data.nextBooking;
  const pendingReschedules = data.pendingReschedules;
  // Action priority (Phase A, documented in docs/provider-dashboard.md):
  // a client-initiated reschedule holds a live appointment unconfirmed until
  // the provider confirms or declines, and the requested time itself expires
  // — so it outranks setup guidance when present. Otherwise the server's
  // nextAction leads and the schedule-change row stays compact.
  const scheduleFirst = pendingReschedules.count > 0;

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-8" data-testid="provider-dashboard">
      <header className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground" data-testid="dashboard-greeting">
          {greetingForHour(new Date().getHours())}, {firstName}
        </h1>
        <p className="text-muted-foreground" data-testid="dashboard-today-count">
          {data.todayBookingsCount > 0
            ? `You have ${data.todayBookingsCount} booking${
                data.todayBookingsCount === 1 ? '' : 's'
              } today — you're all set.`
            : 'No bookings today — a great day to share your booking link.'}
        </p>
        {next && (
          <p
            className="text-sm text-foreground bg-secondary/60 border border-border/50 rounded-2xl px-4 py-3"
            data-testid="dashboard-next-booking"
          >
            Your next booking is{' '}
            <span className="font-semibold">
              {timezoneReady
                ? `${formatBookingDate(
                    next.date,
                    timezone,
                    { weekday: 'long', month: 'short', day: 'numeric' },
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
      </header>

      {scheduleFirst ? (
        <>
          <PendingReschedules
            pending={pendingReschedules}
            timezone={timezone}
            timezoneReady={timezoneReady}
          />
          <NextBestActionCard />
        </>
      ) : (
        <>
          <NextBestActionCard />
          <PendingReschedules
            pending={pendingReschedules}
            timezone={timezone}
            timezoneReady={timezoneReady}
          />
        </>
      )}

      <QuickActions />

      {/* Activation readiness + first-booking conversion (server-computed) */}
      <ReadinessSummaryCard />
      <FirstBookingCard />

      <UpcomingBookings
        bookings={data.upcomingBookings}
        timezone={timezone}
        timezoneReady={timezoneReady}
      />

      <PerformanceMetrics metrics={data.metrics} />

      <section
        id="booking-link-card"
        aria-labelledby="share-heading"
        className="space-y-4"
        data-testid="booking-link-section"
      >
        <h2 id="share-heading" className="text-xl font-serif font-semibold">
          Your booking link
        </h2>
        <BookingPageCard />
        <div className="bg-card border border-border rounded-3xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Where your bookings come from
          </h3>
          <SourceAttributionChart sources={data.sourceAttribution} />
        </div>
      </section>

      <RecentActivity items={data.recentActivity} />

      <EarningsPreview preview={data.earningsPreview} />
    </div>
  );
}
