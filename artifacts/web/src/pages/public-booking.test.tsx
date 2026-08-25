import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PublicBookingPage, { readAttributionSource } from './public-booking';
import {
  useGetPublicBookingPage,
  useListProviderReviews,
  useGetMe,
} from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetPublicBookingPage: vi.fn(),
  useListProviderReviews: vi.fn(),
  useGetMe: vi.fn(),
}));
const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useRoute: () => [true, { slug: 'sarah-chen' }],
  useLocation: () => ['/book/sarah-chen', setLocation],
}));
vi.mock('@/components/ui/booking-modal', () => ({
  default: ({ providerId, source }: { providerId: number; source?: string | null }) => (
    <div data-testid="mock-booking-modal" data-provider-id={providerId} data-source={source ?? ''} />
  ),
}));

const mockPage = vi.mocked(useGetPublicBookingPage);
const mockReviews = vi.mocked(useListProviderReviews);
const mockMe = vi.mocked(useGetMe);

const pageData = {
  page: {
    slug: 'sarah-chen',
    provider: {
      id: 7,
      firstName: 'Sarah',
      lastName: 'Chen',
      avatarUrl: null,
      title: 'Mobile foot-care specialist',
      bio: 'Calm, client-first care.',
      city: 'Toronto',
      serviceAreaNotes: null,
      rating: '4.85',
      reviewCount: 12,
      yearsExperience: 8,
      acceptsNewClients: true,
      verificationStatus: 'approved' as const,
    },
    services: [
      { id: 1, title: 'Nail trim', description: null, durationMinutes: 60, priceCents: 4500, category: 'foot_care', eligibilityNotes: null },
      { id: 2, title: 'Diabetic foot check', description: 'Gentle full assessment', durationMinutes: 45, priceCents: 9000, category: 'diabetic_care', eligibilityNotes: null },
    ],
    availability: {
      timezone: 'America/Toronto',
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
    },
  },
};

function arm({
  loading = false,
  error = null as null | { status: number },
  data = pageData as typeof pageData | undefined,
  me = undefined as undefined | { user: { role: string } },
} = {}) {
  mockPage.mockReturnValue({
    data: loading || error ? undefined : data,
    isLoading: loading,
    isError: Boolean(error),
    error,
    refetch: vi.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof useGetPublicBookingPage>);
  mockReviews.mockReturnValue({ data: { reviews: [] } } as unknown as ReturnType<typeof useListProviderReviews>);
  mockMe.mockReturnValue({ data: me, isLoading: false } as unknown as ReturnType<typeof useGetMe>);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/book/sarah-chen');
});

describe('readAttributionSource', () => {
  it('accepts allowlisted values and normalizes case/whitespace', () => {
    expect(readAttributionSource('?source=instagram')).toBe('instagram');
    expect(readAttributionSource('?source=QR-Card')).toBe('qr-card');
    expect(readAttributionSource('?source=%20website%20')).toBe('website');
  });

  it('rejects unknown or missing values', () => {
    expect(readAttributionSource('?source=evil-tracker')).toBeNull();
    expect(readAttributionSource('?source=')).toBeNull();
    expect(readAttributionSource('')).toBeNull();
  });
});

describe('PublicBookingPage', () => {
  it('shows a loading state while the page resolves', () => {
    arm({ loading: true });
    render(<PublicBookingPage />);
    expect(screen.getByTestId('public-booking-loading')).toBeInTheDocument();
  });

  it('renders the generic not-found state on 404 without leaking provider details', () => {
    arm({ error: { status: 404 } });
    render(<PublicBookingPage />);
    expect(screen.getByTestId('public-booking-not-found')).toBeInTheDocument();
    expect(screen.getByText("This booking page isn't available")).toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-provider-name')).not.toBeInTheDocument();
  });

  it('renders provider identity, services, availability, and timezone', () => {
    arm();
    render(<PublicBookingPage />);
    expect(screen.getByTestId('public-booking-provider-name')).toHaveTextContent('Sarah Chen');
    expect(screen.getByTestId('public-booking-service-1')).toHaveTextContent('Nail trim');
    expect(screen.getByTestId('public-booking-service-2')).toHaveTextContent('Diabetic foot check');
    expect(screen.getByTestId('public-booking-availability')).toHaveTextContent('Monday');
    expect(screen.getByTestId('public-booking-timezone')).toHaveTextContent('America/Toronto');
  });

  it('keeps the booking CTA disabled until a service is selected', () => {
    arm();
    render(<PublicBookingPage />);
    const cta = screen.getByTestId('public-booking-cta');
    expect(cta).toBeDisabled();
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    expect(cta).toBeEnabled();
  });

  it('sends unauthenticated visitors to sign in when they try to book', () => {
    arm();
    render(<PublicBookingPage />);
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    expect(setLocation).toHaveBeenCalledWith('/login');
  });

  it('opens the shared booking modal with the allowlisted source for a client', () => {
    window.history.replaceState({}, '', '/book/sarah-chen?source=instagram');
    arm({ me: { user: { role: 'client' } } });
    render(<PublicBookingPage />);
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    const modal = screen.getByTestId('mock-booking-modal');
    expect(modal).toHaveAttribute('data-provider-id', '7');
    expect(modal).toHaveAttribute('data-source', 'instagram');
  });

  it('drops non-allowlisted source values before they reach the booking modal', () => {
    window.history.replaceState({}, '', '/book/sarah-chen?source=evil-tracker');
    arm({ me: { user: { role: 'client' } } });
    render(<PublicBookingPage />);
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    expect(screen.getByTestId('mock-booking-modal')).toHaveAttribute('data-source', '');
  });

  it('has no accessibility violations on the rendered page', async () => {
    arm();
    const { container } = render(<PublicBookingPage />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations on the not-found state', async () => {
    arm({ error: { status: 404 } });
    const { container } = render(<PublicBookingPage />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
