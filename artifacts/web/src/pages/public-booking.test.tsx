import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PublicBookingPage, { readAttributionSource } from './public-booking';
import {
  useGetPublicBookingPage,
  useListProviderReviews,
  useGetMe,
  useCheckBookingPageServiceArea,
} from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetPublicBookingPage: vi.fn(),
  useListProviderReviews: vi.fn(),
  useGetMe: vi.fn(),
  useCheckBookingPageServiceArea: vi.fn(),
}));
const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useRoute: () => [true, { slug: 'sarah-chen' }],
  useLocation: () => ['/book/sarah-chen', setLocation],
}));
vi.mock('@/components/ui/booking-modal', () => ({
  default: ({
    providerId, source, initialPostalCode,
  }: { providerId: number; source?: string | null; initialPostalCode?: string }) => (
    <div
      data-testid="mock-booking-modal"
      data-provider-id={providerId}
      data-source={source ?? ''}
      data-initial-postal={initialPostalCode ?? ''}
    />
  ),
}));

const mockPage = vi.mocked(useGetPublicBookingPage);
const mockReviews = vi.mocked(useListProviderReviews);
const mockMe = vi.mocked(useGetMe);
const mockCheck = vi.mocked(useCheckBookingPageServiceArea);

const MESSAGES = {
  eligible: 'Great \u2014 this provider serves your area. Choose a service and time.',
  ineligible:
    'This provider does not currently serve this area. Check the postal code or try another provider nearby.',
  needs_review:
    'We could not confirm this location yet. Check the postal code or contact the provider for service-area review before booking.',
  invalid:
    'Enter a valid Canadian postal code and location details to check service availability.',
  unavailable:
    'Online booking is not currently available for this provider\u2019s service area.',
} as const;

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
    serviceArea: {
      configured: true,
      description: 'Serving downtown Toronto and East York.',
      countryCode: 'CA',
      provinceCode: 'ON',
      city: 'Toronto',
    },
    cancellationPolicy: {
      noticeHours: 24,
      summary:
        'Free cancellation until 24 hours before the visit. Later cancellations are recorded as late — no fee is charged.',
    },
  },
};

type CheckStatus = keyof typeof MESSAGES;

/** Arm the eligibility mutation so submit resolves to the given status. */
function armCheck(status: CheckStatus, reason = 'fsa_match') {
  const mutate = vi.fn(
    (
      _vars: unknown,
      opts?: { onSuccess?: (res: { eligibility: { status: string; reason: string; message: string } }) => void },
    ) => {
      opts?.onSuccess?.({ eligibility: { status, reason, message: MESSAGES[status] } });
    },
  );
  mockCheck.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCheckBookingPageServiceArea>);
  return mutate;
}

function arm({
  loading = false,
  error = null as null | { status: number },
  data = pageData as typeof pageData | undefined,
  me = undefined as undefined | { user: { role: string } },
  check = 'eligible' as CheckStatus,
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
  return armCheck(check);
}

/** Complete the eligibility step (province + postal + submit). */
function passEligibility() {
  fireEvent.change(screen.getByTestId('service-area-province'), { target: { value: 'ON' } });
  fireEvent.change(screen.getByTestId('service-area-postal'), { target: { value: 'M5V 2T6' } });
  fireEvent.click(screen.getByTestId('service-area-submit'));
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

  // ── Service-area eligibility gate (roadmap #12) ──────────────────────────

  it('asks for eligibility BEFORE services or slots are shown', () => {
    arm();
    render(<PublicBookingPage />);
    expect(screen.getByTestId('service-area-check')).toBeInTheDocument();
    expect(screen.getByText('Enter your postal code to confirm this provider serves your area.')).toBeInTheDocument();
    // No services, no CTA, no slots until the server confirms eligibility.
    expect(screen.queryByTestId('public-booking-services')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-booking-modal')).not.toBeInTheDocument();
  });

  it('shows the public service-area summary without leaking coverage entries', () => {
    arm();
    const { container } = render(<PublicBookingPage />);
    expect(screen.getByTestId('service-area-summary')).toHaveTextContent(
      'Serving downtown Toronto and East York.',
    );
    // The provider's raw prefix list is never in the page payload or DOM.
    expect(container.innerHTML).not.toContain('M5V,');
    expect(container.innerHTML).not.toContain('prefixes');
  });

  it('reveals services and the CTA after an eligible result', () => {
    arm({ check: 'eligible' });
    render(<PublicBookingPage />);
    passEligibility();
    expect(screen.getByTestId('service-area-result-eligible')).toHaveTextContent(MESSAGES.eligible);
    expect(screen.getByTestId('public-booking-services')).toBeInTheDocument();
    expect(screen.getByTestId('public-booking-cta')).toBeInTheDocument();
  });

  it('keeps booking hidden and shows the approved message when ineligible', () => {
    arm({ check: 'ineligible' });
    render(<PublicBookingPage />);
    passEligibility();
    expect(screen.getByTestId('service-area-result-ineligible')).toHaveTextContent(MESSAGES.ineligible);
    expect(screen.queryByTestId('public-booking-services')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-cta')).not.toBeInTheDocument();
  });

  it('offers the safe manual-review fallback for needs_review — booking stays paused', () => {
    arm({ check: 'needs_review' });
    render(<PublicBookingPage />);
    passEligibility();
    expect(screen.getByTestId('service-area-result-needs_review')).toHaveTextContent(MESSAGES.needs_review);
    expect(screen.getByTestId('service-area-needs-review-help')).toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-services')).not.toBeInTheDocument();
  });

  it('shows the invalid-input message and keeps booking hidden', () => {
    arm({ check: 'invalid' });
    render(<PublicBookingPage />);
    passEligibility();
    expect(screen.getByTestId('service-area-result-invalid')).toHaveTextContent(MESSAGES.invalid);
    expect(screen.queryByTestId('public-booking-services')).not.toBeInTheDocument();
  });

  it('renders the unavailable state when the provider has no active coverage', () => {
    const unconfigured = {
      page: {
        ...pageData.page,
        serviceArea: { configured: false, description: null, countryCode: null, provinceCode: null, city: null },
      },
    };
    arm({ data: unconfigured as unknown as typeof pageData });
    render(<PublicBookingPage />);
    expect(screen.getByTestId('service-area-unavailable')).toHaveTextContent(MESSAGES.unavailable);
    expect(screen.queryByTestId('service-area-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-services')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-booking-cta')).not.toBeInTheDocument();
  });

  it('announces the eligibility result via a status live region (not color-only)', () => {
    arm({ check: 'eligible' });
    render(<PublicBookingPage />);
    passEligibility();
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent(MESSAGES.eligible);
    // Non-color indicator: a textual label accompanies the styling.
    expect(region).toHaveTextContent(/service area/i);
  });

  // ── Booking flow after eligibility ─────────────────────────────────────────

  it('keeps the booking CTA disabled until a service is selected', () => {
    arm();
    render(<PublicBookingPage />);
    passEligibility();
    const cta = screen.getByTestId('public-booking-cta');
    expect(cta).toBeDisabled();
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    expect(cta).toBeEnabled();
  });

  it('sends unauthenticated visitors to sign in when they try to book', () => {
    arm();
    render(<PublicBookingPage />);
    passEligibility();
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    expect(setLocation).toHaveBeenCalledWith('/login');
  });

  it('opens the shared booking modal with source attribution AND the checked postal code', () => {
    window.history.replaceState({}, '', '/book/sarah-chen?source=instagram');
    arm({ me: { user: { role: 'client' } } });
    render(<PublicBookingPage />);
    passEligibility();
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    const modal = screen.getByTestId('mock-booking-modal');
    expect(modal).toHaveAttribute('data-provider-id', '7');
    expect(modal).toHaveAttribute('data-source', 'instagram');
    expect(modal).toHaveAttribute('data-initial-postal', 'M5V 2T6');
  });

  it('drops non-allowlisted source values before they reach the booking modal', () => {
    window.history.replaceState({}, '', '/book/sarah-chen?source=evil-tracker');
    arm({ me: { user: { role: 'client' } } });
    render(<PublicBookingPage />);
    passEligibility();
    fireEvent.click(screen.getByTestId('public-booking-service-1'));
    fireEvent.click(screen.getByTestId('public-booking-cta'));
    expect(screen.getByTestId('mock-booking-modal')).toHaveAttribute('data-source', '');
  });

  // ── Accessibility ───────────────────────────────────────────────────────────

  it('has no accessibility violations on the eligibility step', async () => {
    arm();
    const { container } = render(<PublicBookingPage />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations after an eligible result', async () => {
    arm({ check: 'eligible' });
    const { container } = render(<PublicBookingPage />);
    passEligibility();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations on the not-found state', async () => {
    arm({ error: { status: 404 } });
    const { container } = render(<PublicBookingPage />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
