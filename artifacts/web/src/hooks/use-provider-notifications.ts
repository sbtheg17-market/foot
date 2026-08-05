import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface NewBookingEvent {
  type: 'new-booking';
  providerId: number;
  bookingId: number;
  city: string;
  scheduledAt: string;
}

type StreamEvent = NewBookingEvent | { type: 'connected'; providerId: number };

/**
 * Opens a Server-Sent Events connection to /api/notifications/stream and
 * shows a sonner toast when a new booking arrives for this provider.
 * Also invalidates the ['bookings', 'requested'] query so the count updates.
 *
 * Call this hook inside any component that is only rendered for authenticated
 * providers (e.g. ProviderLayout).
 */
export function useProviderNotifications() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('oncallfoot_token');
    if (!token) return;

    // EventSource cannot send custom headers — pass token as query param
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = `${base}/api/notifications/stream?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(e.data) as StreamEvent;
      } catch {
        return;
      }

      if (event.type === 'new-booking') {
        const date = new Date(event.scheduledAt);
        const formatted = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        toast.success('New booking request!', {
          description: `${event.city} · ${formatted}`,
          duration: 8_000,
          action: {
            label: 'View',
            onClick: () => {
              window.location.href = `${base}/portal/bookings`;
            },
          },
        });

        // Refresh the pending requests count / list
        queryClient.invalidateQueries({ queryKey: ['bookings', 'requested'] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error; nothing to do
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [queryClient]);
}
