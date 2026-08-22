import React, { useState } from 'react';
import { useGetClientCareHistory, useListBookings, useUpdateBookingStatus } from '@workspace/api-client-react';
import { Calendar, MapPin, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { useClientBookingStatusFeedback } from '@/hooks/use-client-booking-status-feedback';
import { formatBookingDate, formatBookingTime, useMarketplaceTimezone } from '@/lib/marketplace-time';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Tab = 'upcoming' | 'past' | 'cancelled';

const TAB_STATUSES: Record<Tab, string[]> = {
  upcoming: ['requested', 'confirmed', 'rescheduled'],
  past: ['completed', 'no_show'],
  cancelled: ['cancelled'],
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  requested: { label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  rescheduled: { label: 'Rescheduled', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-primary/10 text-primary' },
  cancelled: { label: 'Cancelled', color: 'bg-secondary text-muted-foreground' },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-800' },
};

export default function ClientBookings() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useListBookings(undefined, {
    query: {
      queryKey: ['client-bookings'],
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useGetClientCareHistory(
    { limit: 50, offset: 0 },
    {
      query: {
        enabled: activeTab === 'past',
        queryKey: ['client-care-history'],
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  );

  const updateStatus = useUpdateBookingStatus();
  const statusFeedback = useClientBookingStatusFeedback(data?.bookings);

  const bookings = (data?.bookings ?? []).filter((b) =>
    TAB_STATUSES[activeTab].includes(b.status)
  );
  const history = historyData?.history ?? [];
  const isActiveTabLoading = activeTab === 'past' ? isHistoryLoading : isLoading;
  // Authoritative marketplace timezone (global on the server, so any
  // booking's provider resolves the same value — one cached request).
  const timezoneProviderId = data?.bookings?.[0]?.providerId ?? history[0]?.providerId;
  const { timezone: marketplaceTimezone, status: timezoneStatus } = useMarketplaceTimezone(timezoneProviderId);

  const requestCancel = (id: number) => {
    if (cancellingId !== null) return; // guard against double-tap
    const booking = data?.bookings.find((item) => item.id === id);
    if (!booking || !['requested', 'confirmed', 'rescheduled'].includes(booking.status)) {
      toast.info('This booking can no longer be cancelled. Refreshing.');
      void refetch();
      return;
    }
    setConfirmingCancelId(id);
  };

  const handleCancel = (id: number) => {
    if (cancellingId !== null) return; // guard against double-tap
    setConfirmingCancelId(null);
    setCancellingId(id);
    updateStatus.mutate(
      {
        bookingId: id,
        data: { status: 'cancelled', cancellationReason: 'Cancelled by client' },
      },
      {
        onSuccess: () => {
          toast.success('Booking cancelled.');
          statusFeedback.suppressNextStatusChange(id, 'cancelled');
          void refetch();
          setCancellingId(null);
        },
        onError: (err) => {
          const status = (err as { status?: number }).status;
          if (status === 409) {
            toast.info('This booking was already updated — refreshing.');
          } else if (status === 400 || status === 403) {
            toast.error('This booking can no longer be cancelled.');
          } else {
            toast.error('Could not cancel booking. Please try again.');
          }
          void refetch();
          setCancellingId(null);
        },
      }
    );
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="flex-1 flex flex-col pb-10">
      {/* Hero */}
      <div className="bg-primary px-6 py-8 rounded-b-[2rem] shadow-sm">
        <h1 className="text-3xl font-serif font-semibold text-primary-foreground mb-1">
          My Bookings
        </h1>
        <p className="text-primary-foreground/75 text-sm">
          Track your appointments and care history.
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-5">
        <div className="flex bg-secondary p-1 rounded-xl shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
              }`}
            >
              {tab.label}
              {tab.id === 'upcoming' && (data?.bookings ?? []).filter((b) => TAB_STATUSES.upcoming.includes(b.status)).length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                  {(data?.bookings ?? []).filter((b) => TAB_STATUSES.upcoming.includes(b.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-6 mt-5 flex flex-col gap-4">
        {isActiveTabLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-28 animate-pulse" />
          ))
        ) : activeTab === 'past' && isHistoryError ? (
          <div className="text-center py-14 px-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1">History unavailable</h3>
            <p className="text-muted-foreground text-sm mb-5">
              We couldn’t load your care history. Please try again.
            </p>
            <button
              onClick={() => void refetchHistory()}
              className="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-sm hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (activeTab === 'past' ? history.length === 0 : bookings.length === 0) ? (
          <div className="text-center py-14 px-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1">
              {activeTab === 'past' ? 'Your care history starts here' : `No ${activeTab} bookings`}
            </h3>
            {activeTab === 'upcoming' && (
              <>
                <p className="text-muted-foreground text-sm mb-5">
                  Find a provider and request your first appointment.
                </p>
                <Link
                  href="/discover"
                  className="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Find a provider
                </Link>
              </>
            )}
          </div>
        ) : (
          (activeTab === 'past' ? history : bookings).map((booking) => {
            const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, color: 'bg-secondary text-foreground' };
            const canCancel = ['requested', 'confirmed', 'rescheduled'].includes(booking.status);
            const historyEntry = 'provider' in booking ? booking : null;
            const providerName = historyEntry
              ? `${historyEntry.provider.firstName} ${historyEntry.provider.lastName}`
              : null;

            return (
              <div
                key={booking.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-muted-foreground">#{booking.id}</span>
                    </div>
                     <p className="font-semibold text-foreground text-base truncate">
                       {historyEntry?.service.title ?? 'Foot care appointment'}
                    </p>
                     {providerName && (
                       <p className="text-sm text-muted-foreground truncate">{providerName}</p>
                     )}
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => requestCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      className="ml-3 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      title="Cancel booking"
                      aria-label="Cancel booking"
                    >
                      {cancellingId === booking.id ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    {timezoneStatus === 'loading' ? (
                      <span
                        className="inline-block h-4 w-48 animate-pulse rounded bg-secondary"
                        data-testid={`booking-${booking.id}-time-loading`}
                        aria-label="Loading appointment time"
                      />
                    ) : (
                      <span data-testid={`booking-${booking.id}-time`}>
                        {formatBookingDate(booking.scheduledAt, marketplaceTimezone, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' at '}
                        {formatBookingTime(booking.scheduledAt, marketplaceTimezone)}
                        {timezoneStatus === 'unavailable' && (
                          <span className="text-xs" data-testid={`booking-${booking.id}-device-time`}>
                            {' '}(device time)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{booking.address}, {booking.city}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
                  >
                    View details
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                   {booking.status === 'completed' && (
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="text-sm text-muted-foreground font-medium hover:text-primary hover:underline"
                      >
                        Leave a review
                      </Link>
                      <Link
                        href={`/bookings/${booking.id}`}
                        data-testid={`book-again-link-${booking.id}`}
                        aria-label="Book this visit again"
                        className="inline-flex items-center rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Book again
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* In-app cancellation confirmation (never the native browser confirm) */}
      <AlertDialog
        open={confirmingCancelId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingCancelId(null);
        }}
      >
        <AlertDialogContent data-testid="cancel-booking-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Your provider will be notified and this time slot will be released. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-booking-keep">Keep booking</AlertDialogCancel>
            <AlertDialogAction
              data-testid="cancel-booking-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmingCancelId !== null) handleCancel(confirmingCancelId);
              }}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
