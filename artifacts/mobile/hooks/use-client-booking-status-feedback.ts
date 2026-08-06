import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

type ClientBookingStatus = {
  id: number;
  status: string;
};

const STATUS_FEEDBACK: Record<string, { title: string; description: string }> = {
  confirmed: {
    title: 'Booking confirmed',
    description: 'Your provider accepted this appointment.',
  },
  rescheduled: {
    title: 'Booking rescheduled',
    description: 'Your appointment time was changed.',
  },
  completed: {
    title: 'Visit completed',
    description: 'Your provider marked this visit as completed.',
  },
  cancelled: {
    title: 'Booking cancelled',
    description: 'This booking is no longer active.',
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
      if (feedback) {
        Alert.alert(`${feedback.title} · Booking #${bookingId}`, feedback.description);
      }
    }

    previousStatuses.current = currentStatuses;
  }, [bookings]);

  return { suppressNextStatusChange };
}