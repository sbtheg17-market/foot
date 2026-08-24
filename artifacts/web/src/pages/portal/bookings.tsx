import React, { useState, useMemo } from 'react';
import {
  useListBookings,
  useListProviderServices,
  useUpdateBookingStatus,
  ListBookingsStatus,
} from '@workspace/api-client-react';
import { Calendar, MapPin, Clock, FileText, Phone, X, Check, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import RescheduleModal from '@/components/ui/reschedule-modal';
import { formatBookingDateTime, useMarketplaceTimezone } from '@/lib/marketplace-time';

const mapsUrl = (address: string, city: string, postalCode?: string | null) =>
  `https://maps.google.com/?q=${encodeURIComponent([address, city, postalCode].filter(Boolean).join(', '))}`;

const telUrl = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;

export default function PortalBookings() {
  const [activeTab, setActiveTab] = useState<ListBookingsStatus>('requested');

  // Single fetch; filtering is local + presentational (no booking writes).
  const { data, isLoading, refetch } = useListBookings(
    { limit: 100 },
    { query: { queryKey: ['bookings'] } }
  );

  // Authoritative marketplace timezone (global on the server; the provider's
  // own bookings all resolve the same value — one cached request).
  const timezoneProviderId = data?.bookings?.[0]?.providerId;
  const { timezone: marketplaceTimezone, status: timezoneStatus } = useMarketplaceTimezone(timezoneProviderId);

  // Own services — needed to open the reschedule modal (slot queries are
  // per-service). Public endpoint; one cached request for the whole page.
  const { data: servicesData } = useListProviderServices(timezoneProviderId ?? 0, {
    query: { enabled: !!timezoneProviderId, queryKey: ['portal-services', timezoneProviderId] },
  });

  // Provider-initiated rescheduling (server-enforced: confirmed → rescheduled).
  const [rescheduling, setRescheduling] = useState<{
    bookingId: number;
    providerId: number;
    clientName: string;
    currentScheduledAt: string;
    service: { id: number; title: string; priceCents: number; durationMinutes: number };
  } | null>(null);

  const countsByStatus = useMemo(() => {
    const counts: Partial<Record<ListBookingsStatus, number>> = {};
    for (const b of data?.bookings ?? []) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const filteredBookings = useMemo(
    () => (data?.bookings ?? []).filter(b => b.status === activeTab),
    [data, activeTab]
  );

  const updateStatus = useUpdateBookingStatus();
  // Per-booking in-flight guard: only one action per booking at a time.
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleStatusChange = (
    id: number,
    newStatus: ListBookingsStatus,
    cancellationReason?: string,
    successMessage?: string,
  ) => {
    if (pendingId !== null) return; // another request is already in flight
    setPendingId(id);
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status: newStatus,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
      },
      {
        onSuccess: () => {
          const labels: Partial<Record<ListBookingsStatus, string>> = {
            confirmed: 'Booking accepted ✓',
            cancelled: 'Booking declined',
            completed: 'Marked as completed ✓',
          };
          toast.success(successMessage ?? labels[newStatus] ?? `Booking marked as ${newStatus.replace('_', ' ')}`);
          refetch();
          setPendingId(null);
        },
        onError: (err) => {
          // 409 means the booking status changed before we could act on it.
          // Silently refetch so the UI shows the real current state.
          if ((err as { status?: number }).status === 409) {
            toast.info('This booking was already updated — refreshing.');
            refetch();
          } else {
            toast.error('Could not update booking. Please try again.');
          }
          setPendingId(null);
        },
      }
    );
  };

  const tabs: { id: ListBookingsStatus; label: string }[] = [
    { id: 'requested', label: 'Requests' },
    { id: 'rescheduled', label: 'Reschedules' },
    { id: 'confirmed', label: 'Upcoming' },
    { id: 'completed', label: 'Past' },
  ];

  const clientNameOf = (booking: { clientFirstName?: string | null; clientLastName?: string | null; clientId: number }) =>
    booking.clientFirstName
      ? `${booking.clientFirstName} ${booking.clientLastName ?? ''}`.trim()
      : `Client ID: ${booking.clientId}`;

  const openReschedule = (booking: {
    id: number;
    providerId: number;
    serviceId: number;
    scheduledAt: string;
    clientFirstName?: string | null;
    clientLastName?: string | null;
    clientId: number;
  }) => {
    const service = servicesData?.services.find((s) => s.id === booking.serviceId);
    if (!service) {
      // Service deactivated (or services still loading) — the server would
      // reject the reschedule anyway; surface the same friendly explanation.
      toast.error("This booking's service is no longer offered, so it cannot be rescheduled.");
      return;
    }
    setRescheduling({
      bookingId: booking.id,
      providerId: booking.providerId,
      clientName: clientNameOf(booking),
      currentScheduledAt: booking.scheduledAt,
      service: {
        id: service.id,
        title: service.title,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
      },
    });
  };

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto h-full flex flex-col">
      <h1 className="text-3xl font-serif font-bold text-foreground mb-6">Bookings</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar" data-testid="booking-status-filters">
        {tabs.map(tab => {
          const count = countsByStatus[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`booking-filter-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
              }`}
            >
              {tab.label}
              <span
                data-testid={`booking-filter-${tab.id}-count`}
                className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-bold text-center ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-foreground/70'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-32 animate-pulse" />
          ))
        ) : filteredBookings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1 text-foreground">No bookings found</h3>
            <p className="text-muted-foreground">There are no {activeTab} bookings.</p>
          </div>
        ) : (
          filteredBookings.map(booking => (
            <div key={booking.id} className="bg-card border border-border rounded-3xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    {timezoneStatus === 'loading' ? (
                      <span
                        className="inline-block h-4 w-44 animate-pulse rounded bg-secondary"
                        data-testid={`booking-${booking.id}-time-loading`}
                        aria-label="Loading appointment time"
                      />
                    ) : (
                      <span data-testid={`booking-${booking.id}-time`}>
                        {formatBookingDateTime(booking.scheduledAt, marketplaceTimezone, {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        }, 'en-US')}
                        {timezoneStatus === 'unavailable' && (
                          <span className="text-xs" data-testid={`booking-${booking.id}-device-time`}>
                            {' '}(device time)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-lg text-foreground" data-testid={`booking-${booking.id}-client-name`}>
                    {clientNameOf(booking)}
                  </h3>
                  {booking.clientPhone && (
                    <a
                      href={telUrl(booking.clientPhone)}
                      data-testid={`booking-${booking.id}-phone-link`}
                      className="text-sm text-primary font-medium mt-0.5 flex items-center gap-1.5 hover:underline active:opacity-70"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {booking.clientPhone}
                    </a>
                  )}
                  <a
                    href={mapsUrl(booking.address, booking.city, booking.postalCode)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`booking-${booking.id}-address-link`}
                    className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 hover:text-primary hover:underline active:opacity-70"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {booking.address}, {booking.city}
                  </a>
                </div>
              </div>

              {booking.clientNotes && (
                <div className="bg-secondary/50 rounded-xl p-3 mb-4 flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80 italic">"{booking.clientNotes}"</p>
                </div>
              )}

              {/* Actions based on status */}
              {activeTab === 'requested' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(booking.id, 'confirmed')}
                    disabled={pendingId === booking.id}
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <><Check className="w-5 h-5" /> Accept</>
                    }
                  </button>
                  <button
                    onClick={() => handleStatusChange(booking.id, 'cancelled', 'Request declined by provider')}
                    disabled={pendingId === booking.id}
                    className="w-12 h-12 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <X className="w-5 h-5" />
                    }
                  </button>
                </div>
              )}

              {/* Reschedules — the time shown above is the PROPOSED new time.
                  Server state machine: rescheduled → confirmed | cancelled. */}
              {activeTab === 'rescheduled' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(booking.id, 'confirmed', undefined, 'New time confirmed ✓')}
                    disabled={pendingId === booking.id}
                    data-testid={`booking-${booking.id}-confirm-reschedule`}
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <><Check className="w-5 h-5" /> Confirm new time</>
                    }
                  </button>
                  <button
                    onClick={() => handleStatusChange(booking.id, 'cancelled', 'Reschedule declined by provider', 'Reschedule declined')}
                    disabled={pendingId === booking.id}
                    data-testid={`booking-${booking.id}-decline-reschedule`}
                    aria-label="Decline reschedule and cancel booking"
                    className="w-12 h-12 bg-secondary text-secondary-foreground rounded-xl flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <X className="w-5 h-5" />
                    }
                  </button>
                </div>
              )}

              {activeTab === 'confirmed' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(booking.id, 'completed')}
                    disabled={pendingId === booking.id}
                    className="flex-1 py-3 border-2 border-primary text-primary bg-primary/5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingId === booking.id
                      ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : 'Mark Completed'
                    }
                  </button>
                  <button
                    onClick={() => openReschedule(booking)}
                    disabled={pendingId === booking.id}
                    data-testid={`booking-${booking.id}-reschedule`}
                    className="py-3 px-4 border-2 border-border text-foreground bg-card rounded-xl font-semibold flex items-center justify-center gap-2 hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarClock className="w-5 h-5" /> Reschedule
                  </button>
                </div>
              )}

              {activeTab === 'completed' && (
                <div className="w-full text-center py-2 text-sm font-medium text-muted-foreground bg-secondary/30 rounded-xl">
                  Completed
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Provider-initiated reschedule — consent-first: this creates a pending
          PROPOSAL; the client's confirmed time never changes until they accept. */}
      {rescheduling && (
        <RescheduleModal
          perspective="provider"
          bookingId={rescheduling.bookingId}
          providerId={rescheduling.providerId}
          providerName={rescheduling.clientName}
          service={rescheduling.service}
          currentScheduledAt={rescheduling.currentScheduledAt}
          onClose={() => setRescheduling(null)}
          onSuccess={() => {
            setRescheduling(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
