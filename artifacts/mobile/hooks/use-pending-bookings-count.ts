/**
 * Returns the number of pending booking requests the current user should act on.
 *
 * Providers: count of bookings in "requested" status (new requests awaiting their response).
 * Clients + unauthenticated: always 0 (clients have nothing to act on here).
 *
 * Refetches every 30 s so the badge stays reasonably fresh without hammering the API.
 */
import { useListBookings } from '@workspace/api-client-react';
import { useAuth } from '@/context/auth';
import { ListBookingsStatus } from '@workspace/api-client-react';

export function usePendingBookingsCount(): number {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider';

  const { data } = useListBookings(
    { status: ListBookingsStatus.requested },
    {
      query: {
        enabled: isProvider,
        refetchInterval: 30_000,
      },
    }
  );

  if (!isProvider) return 0;
  return data?.total ?? 0;
}
