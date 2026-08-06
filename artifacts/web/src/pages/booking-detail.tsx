import React, { useState } from 'react';
import {
  getGetBookingReviewQueryKey,
  getListProviderReviewsQueryKey,
  useGetBooking,
  useGetBookingReview,
  useGetProviderById,
  useListProviderServices,
  useUpdateBookingStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Calendar, Clock, FileText, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/routes';
import { useClientBookingStatusFeedback } from '@/hooks/use-client-booking-status-feedback';
import ClientReviewForm from '@/components/client-review-form';

const STATUS_META: Record<string, { label: string; className: string; description: string }> = {
  requested: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800',
    description: 'Your request is with the provider for review.',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-100 text-emerald-800',
    description: 'Your visit is scheduled.',
  },
  rescheduled: {
    label: 'Rescheduled',
    className: 'bg-blue-100 text-blue-800',
    description: 'The appointment time was changed and needs your attention.',
  },
  completed: {
    label: 'Completed',
    className: 'bg-primary/10 text-primary',
    description: 'This visit has been completed.',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-secondary text-muted-foreground',
    description: 'This booking is no longer active.',
  },
  no_show: {
    label: 'No show',
    className: 'bg-red-100 text-red-800',
    description: 'The visit was marked as a no-show.',
  },
};

function formatDate(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }),
  };
}

export default function ClientBookingDetail() {
  const [, params] = useRoute('/bookings/:id');
  const [, setLocation] = useLocation();
  const bookingId = Number(params?.id);

  const { data, isLoading, error, refetch } = useGetBooking(bookingId, {
    query: {
      enabled: Number.isFinite(bookingId) && bookingId > 0,
      queryKey: ['client-booking', bookingId],
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });
  const booking = data?.booking;
  const [isCancelling, setIsCancelling] = useState(false);
  const updateStatus = useUpdateBookingStatus();
  const statusFeedback = useClientBookingStatusFeedback(booking ? [booking] : undefined);
  const queryClient = useQueryClient();
  const { data: providerData, isLoading: providerLoading } = useGetProviderById(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider', booking?.providerId] },
  });
  const { data: servicesData } = useListProviderServices(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider-services', booking?.providerId] },
  });
  const { data: reviewData } = useGetBookingReview(bookingId, {
    query: {
      enabled: booking?.status === 'completed',
      queryKey: ['client-booking-review', bookingId],
      retry: false,
    },
  });

  if (isLoading) {
    return <div className="p-6 pt-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (error || !booking) {
    return (
      <div className="p-6 pt-10">
        <button onClick={() => setLocation(ROUTES.client.bookings)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to bookings
        </button>
        <div className="mt-16 text-center">
          <h1 className="font-serif text-2xl font-semibold">Booking unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">We couldn’t load this booking. It may no longer be available.</p>
        </div>
      </div>
    );
  }

  const status = STATUS_META[booking.status] ?? {
    label: booking.status,
    className: 'bg-secondary text-foreground',
    description: 'The booking status was updated.',
  };
  const scheduled = formatDate(booking.scheduledAt);
  const provider = providerData?.provider;
  const service = servicesData?.services.find((item) => item.id === booking.serviceId);
  const canCancel = ['requested', 'confirmed', 'rescheduled'].includes(booking.status);
  const isReviewEligible = booking.status === 'completed';

  const handleCancel = () => {
    if (isCancelling || !canCancel) {
      if (!canCancel) {
        toast.info('This booking can no longer be cancelled. Refreshing.');
      }
      return;
    }
    if (!window.confirm('Cancel this booking?\n\nThis cannot be undone.')) return;

    setIsCancelling(true);
    updateStatus.mutate(
      {
        bookingId: booking.id,
        data: { status: 'cancelled', cancellationReason: 'Cancelled by client' },
      },
      {
        onSuccess: () => {
          toast.success('Booking cancelled.');
          statusFeedback.suppressNextStatusChange(booking.id, 'cancelled');
          void refetch();
          setIsCancelling(false);
        },
        onError: (err) => {
          const statusCode = (err as { status?: number }).status;
          if (statusCode === 409) {
            toast.info('This booking was already updated — refreshing.');
          } else if (statusCode === 400 || statusCode === 403) {
            toast.error('This booking can no longer be cancelled.');
          } else {
            toast.error('Could not cancel booking. Please try again.');
          }
          void refetch();
          setIsCancelling(false);
        },
      },
    );
  };

  return (
    <div className="flex-1 bg-background pb-10">
      <div className="bg-primary px-6 pt-5 pb-8 rounded-b-[2rem]">
        <button
          onClick={() => setLocation(ROUTES.client.bookings)}
          className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to bookings
        </button>
        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-primary-foreground/70">Booking #{booking.id}</p>
            <h1 className="mt-1 text-3xl font-serif font-semibold text-primary-foreground">Appointment details</h1>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-3 text-sm text-primary-foreground/80">{status.description}</p>
      </div>

      <div className="px-6 -mt-4 space-y-4 relative">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold">Your visit</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">{scheduled.date}</p>
                <p className="text-sm text-muted-foreground">{scheduled.time}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">{booking.address}</p>
                <p className="text-sm text-muted-foreground">
                  {booking.city}{booking.postalCode ? ` · ${booking.postalCode}` : ''}
                </p>
              </div>
            </div>
            {service && (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{service.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.durationMinutes} minutes · ${(service.priceCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-semibold">Your provider</h2>
              {providerLoading ? (
                <div className="mt-3 h-5 w-40 animate-pulse rounded bg-secondary" />
              ) : provider ? (
                <>
                  <p className="mt-2 font-semibold">{provider.firstName} {provider.lastName}</p>
                  <p className="text-sm text-primary">{provider.title || 'Foot care professional'}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {provider.verificationStatus === 'approved' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" /> Credentials verified
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-1">{provider.city}</span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Provider information is temporarily unavailable.</p>
              )}
            </div>
          </div>
        </section>

        {(booking.clientNotes || booking.cancellationReason) && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-semibold">
                  {booking.cancellationReason ? 'Cancellation note' : 'Visit notes'}
                </h2>
                {booking.cancellationReason && <p className="mt-2 text-sm text-muted-foreground">{booking.cancellationReason}</p>}
                {!booking.cancellationReason && booking.clientNotes && <p className="mt-2 text-sm text-muted-foreground">{booking.clientNotes}</p>}
              </div>
            </div>
          </section>
        )}

        {isReviewEligible && (
          <ClientReviewForm
            bookingId={booking.id}
            existingReview={reviewData?.review}
            onSubmitted={() => {
              toast.success('Thanks — your review was saved.');
              void queryClient.invalidateQueries({ queryKey: getGetBookingReviewQueryKey(booking.id) });
              void queryClient.invalidateQueries({ queryKey: getListProviderReviewsQueryKey(booking.providerId) });
              void queryClient.invalidateQueries({ queryKey: ['provider', booking.providerId] });
            }}
          />
        )}

        <button
          onClick={() => setLocation(ROUTES.client.provider(booking.providerId))}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary shadow-sm hover:bg-secondary"
        >
          View provider profile
        </button>
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        )}
      </div>
    </div>
  );
}