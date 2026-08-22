/**
 * Marketplace-timezone helpers for booking summaries.
 *
 * The marketplace timezone is a single global value on the server
 * (`getMarketplaceTimezone()`, backed by MARKETPLACE_TIMEZONE) — every
 * provider's availability, slots, and booking enforcement use the same
 * zone. It is exposed through the existing public endpoint
 * `GET /providers/:id/availability`, so any booking's provider resolves
 * the identical value; one cached request per screen is per-booking
 * correct by construction (no N+1, no API change).
 *
 * DST is handled by Intl's timezone-aware formatting — never by manual
 * offsets. When the timezone cannot be loaded, callers must label the
 * device-timezone fallback explicitly instead of failing silently.
 */
import { useGetProviderAvailability } from '@workspace/api-client-react';

export type MarketplaceTimezoneStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useMarketplaceTimezone(providerId: number | undefined): {
  timezone: string | undefined;
  status: MarketplaceTimezoneStatus;
} {
  const enabled = typeof providerId === 'number' && providerId > 0;
  const { data, isError } = useGetProviderAvailability(providerId ?? 0, {
    // Same query-key family as the booking-detail screen so the value is
    // fetched once and shared through the react-query cache.
    query: { enabled, queryKey: ['booking-provider-availability', providerId] },
  });
  if (!enabled) return { timezone: undefined, status: 'idle' };
  if (isError) return { timezone: undefined, status: 'unavailable' };
  if (!data?.timezone) return { timezone: undefined, status: 'loading' };
  return { timezone: data.timezone, status: 'ready' };
}

/** Date parts (no abbreviation) in the marketplace timezone when known. */
export function formatBookingDate(
  value: string | Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-CA',
): string {
  return new Date(value).toLocaleDateString(locale, {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Time with an explicit zone abbreviation (e.g. "2:26 p.m. EDT") when known. */
export function formatBookingTime(
  value: string | Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  locale = 'en-CA',
): string {
  return new Date(value).toLocaleTimeString(locale, {
    ...options,
    ...(timeZone ? { timeZone, timeZoneName: 'short' as const } : {}),
  });
}

/** Combined date + time with a zone abbreviation when known. */
export function formatBookingDateTime(
  value: string | Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-CA',
): string {
  return new Date(value).toLocaleString(locale, {
    ...options,
    ...(timeZone ? { timeZone, timeZoneName: 'short' as const } : {}),
  });
}
