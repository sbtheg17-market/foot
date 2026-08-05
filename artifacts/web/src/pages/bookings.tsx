import React, { useState } from 'react';
import { useListBookings, useUpdateBookingStatus } from '@workspace/api-client-react';
import { Calendar, MapPin, Clock, ChevronRight, X, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';

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

  const { data, isLoading, refetch } = useListBookings(undefined, {
    query: { queryKey: ['client-bookings'] },
  });

  const updateStatus = useUpdateBookingStatus();

  const bookings = (data?.bookings ?? []).filter((b) =>
    TAB_STATUSES[activeTab].includes(b.status)
  );

  const handleCancel = (id: number) => {
    if (cancellingId !== null) return; // guard against double-tap
    setCancellingId(id);
    updateStatus.mutate(
      {
        bookingId: id,
        data: { status: 'cancelled', cancellationReason: 'Cancelled by client' },
      },
      {
        onSuccess: () => {
          toast.success('Booking cancelled.');
          refetch();
          setCancellingId(null);
        },
        onError: (err) => {
          if ((err as { status?: number }).status === 409) {
            toast.info('This booking was already updated — refreshing.');
            refetch();
          } else {
            toast.error('Could not cancel booking. Please try again.');
          }
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
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl h-28 animate-pulse" />
          ))
        ) : bookings.length === 0 ? (
          <div className="text-center py-14 px-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="font-serif font-medium text-lg mb-1">No {activeTab} bookings</h3>
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
          bookings.map((booking) => {
            const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, color: 'bg-secondary text-foreground' };
            const canCancel = ['requested', 'confirmed', 'rescheduled'].includes(booking.status);
            const scheduledDate = new Date(booking.scheduledAt);

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
                      Appointment
                    </p>
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      className="ml-3 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      title="Cancel booking"
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
                    <span>
                      {scheduledDate.toLocaleDateString('en-CA', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' at '}
                      {scheduledDate.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{booking.address}, {booking.city}</span>
                  </div>
                </div>

                {booking.status === 'completed' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Link
                      href={`/providers/${booking.providerId}`}
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Leave a review →
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
