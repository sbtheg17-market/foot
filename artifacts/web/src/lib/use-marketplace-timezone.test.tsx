import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMarketplaceTimezone } from './marketplace-time';
import { useGetProviderAvailability } from '@workspace/api-client-react';

vi.mock('@workspace/api-client-react', () => ({
  useGetProviderAvailability: vi.fn(),
}));

const mockAvailability = vi.mocked(useGetProviderAvailability);

function setQuery(result: { data?: unknown; isError?: boolean }) {
  mockAvailability.mockReturnValue({
    data: result.data,
    isError: result.isError ?? false,
  } as ReturnType<typeof useGetProviderAvailability>);
}

describe('useMarketplaceTimezone', () => {
  beforeEach(() => mockAvailability.mockReset());

  it('is idle without a provider id (query disabled, never guesses)', () => {
    setQuery({ data: undefined });
    const { result } = renderHook(() => useMarketplaceTimezone(undefined));
    expect(result.current).toEqual({ timezone: undefined, status: 'idle' });
  });

  it('reports loading before the timezone arrives — never an unlabeled value', () => {
    setQuery({ data: undefined });
    const { result } = renderHook(() => useMarketplaceTimezone(1));
    expect(result.current).toEqual({ timezone: undefined, status: 'loading' });
  });

  it('returns the marketplace timezone when the query resolves', () => {
    setQuery({ data: { timezone: 'America/Toronto' } });
    const { result } = renderHook(() => useMarketplaceTimezone(1));
    expect(result.current).toEqual({ timezone: 'America/Toronto', status: 'ready' });
  });

  it('reports unavailable on a definitive failure so callers label the device fallback', () => {
    setQuery({ isError: true });
    const { result } = renderHook(() => useMarketplaceTimezone(1));
    expect(result.current).toEqual({ timezone: undefined, status: 'unavailable' });
  });
});
