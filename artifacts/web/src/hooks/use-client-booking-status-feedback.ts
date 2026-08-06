import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

type ClientBookingStatus = {
  id: number;
  status: string;
};

const STATUS_FEEDBACK: Record<string, { title: string; description: string; kind: 'success' | 'info' }> = {
  confirmed: {
    title: 'Booking confirmed',
    description: 'Your provider accepted this appointment.',
    kind: 'success',
  },
  rescheduled: {
    title: 'Booking rescheduled',
    description: 'Your appointment time was changed.',
    kind: 'info',
  },
  completed: {
    title: 'Visit completed',
    description: 'Your provider marked this visit as completed.',
    kind: 'success',
  },
  cancelled: {
    title: 'Booking cancelled',
    description: 'This booking is no longer active.',
    kind: 'info',
  },
};

/**
 * Announces server-side booking changes after a refetch, while skipping the
 * initial load and allowing local mutations to provide their own immediate
 * confirmation.
 */
export function useClientBookingStatusFeedback(bookings: ClientBookingStatus[] | undefined) {
  const previousStatuses = useRef(new Map<number, string>());
  const suppressedStatuses = useRef(new Map<number, string>());

  const suppressNextStatusChange = useCallback((bookingId: number, status: string) => {
    suppressedStatuses.current.set(bookingId, status);
  }, []);

  useEffect(() => {
    if (!bookings) return;

    const currentStatuses = new Map(bookings.map((booking) => [booking.id, booking.status]));

    for (const [bookingId, currentStatus] of currentStatuses) {
      const previousStatus = previousStatuses.current.get(bookingId);
      if (!previousStatus || previousStatus === currentStatus) continue;

      if (suppressedStatuses.current.get(bookingId) === currentStatus) {
        suppressedStatuses.current.delete(bookingId);
        continue;
      }

      const feedback = STATUS_FEEDBACK[currentStatus];
      if (!feedback) continue;

      const message = `${feedback.title} · Booking #${bookingId}`;
      if (feedback.kind === 'success') {
        toast.success(message, { description: feedback.description });
      } else {
        toast.info(message, { description: feedback.description });
      }
    }

    previousStatuses.current = currentStatuses;
  }, [bookings]);

  return { suppressNextStatusChange };
}