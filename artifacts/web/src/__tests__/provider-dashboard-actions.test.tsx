/**
 * Provider Dashboard Phase A — Next Best Action + Pending Reschedules.
 *
 * Covers: next-action loading/error fallback, every server nextAction code
 * (heading + deep link truthfulness), publish/share in-page scroll, all_set
 * linking to the server-proven public page, honest under-review copy,
 * pending reschedule zero/one/many states, deep link into the existing
 * bookings Reschedules tab, action priority ordering (reschedule work first
 * only when present), privacy (no full client names/addresses rendered),
 * ?tab= deep-link allowlisting, and axe scans on both action states.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import PortalDashboard from '../pages/portal/dashboard';
import { initialBookingsTab } from '../pages/portal/bookings';
import {
  useGetMyProviderDashboard,
  useGetMyProviderActivationStatus,
} from '@workspace/api-client-react';
import type {
  ProviderActivationNextAction,
  ProviderActivationStatusResponse,
  ProviderDashboardResponse,
} from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyProviderDashboard: vi.fn(),
  useGetMyProviderActivationStatus: vi.fn(),
  getGetMyProviderActivationStatusQueryKey: () => ['/providers/me/activation-status'],
}));
vi.mock('@/components/readiness-summary-card', () => ({
  default: () => <div data-testid="mock-readiness-card" />,
}));
vi.mock('@/components/first-booking-card', () => ({
  default: () => <div data-testid="mock-first-booking-card" />,
}));
vi.mock('@/components/booking-page-card', () => ({
  default: () => <div data-testid="mock-booking-page-card" />,
}));
vi.mock('wouter', () => ({
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/marketplace-time', () => ({
  useMarketplaceTimezone: () => ({ timezone: 'America/Toronto', status: 'ready' }),
  formatBookingDate: (iso: string) => `Sep ${new Date(iso).getUTCDate()}`,
  formatBookingTime: () => '2:00 PM',
}));

const mockDashboard = vi.mocked(useGetMyProviderDashboard);
const mockActivation = vi.mocked(useGetMyProviderActivationStatus);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const baseDashboard: ProviderDashboardResponse = {
  providerId: 7,
  providerName: 'Sarah Chen',
  slug: 'sarah-chen',
  bookingPagePublished: true,
  bookingUrl: '/book/sarah-chen',
  todayBookingsCount: 0,
  nextBooking: null,
  upcomingBookings: [],
  pendingReschedules: { count: 0, nextRequest: null },
  metrics: {
    completionRate: 0,
    cancellationRate: 0,
    noShowRate: 0,
    repeatClientRate: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    resolvedBookings: 0,
  },
  sourceAttribution: {
    instagram: 0,
    qrCard: 0,
    text: 0,
    facebook: 0,
    website: 0,
    other: 0,
    unknown: 0,
  },
  recentActivity: [],
  earningsPreview: { estimatedMonthlyCents: null, available: false },
  updatedAt: new Date(now).toISOString(),
};

function activationData(
  nextAction: ProviderActivationNextAction,
): ProviderActivationStatusResponse {
  return {
    activation: {
      applicationStatus: 'approved',
      rejectionReason: null,
      submittedAt: null,
      reviewedAt: null,
      canEdit: false,
      canReset: false,
      canResubmit: false,
      verification: { status: 'approved', submittedAt: null, canResubmit: false },
      milestones: {
        accountCreated: true,
        profileCompleted: true,
        verificationSubmitted: true,
        approved: true,
        serviceAreaConfigured: true,
        activeServiceConfigured: true,
        availabilityConfigured: true,
        bookingPagePublished: true,
        firstBookingReceived: true,
      },
      milestonesCompleted: 9,
      milestonesTotal: 9,
      bookingPage: {
        slug: 'sarah-chen',
        published: true,
        publishedAt: null,
        path: '/book/sarah-chen',
        eligible: true,
        verificationStatus: 'approved',
        serviceAreaConfigured: true,
      },
      nextAction,
    },
  };
}

function mockDashboardLoaded(data: ProviderDashboardResponse) {
  mockDashboard.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGetMyProviderDashboard>);
}

function mockActivationLoaded(nextAction: ProviderActivationNextAction) {
  mockActivation.mockReturnValue({
    data: activationData(nextAction),
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useGetMyProviderActivationStatus>);
}

const pendingOne: ProviderDashboardResponse['pendingReschedules'] = {
  count: 1,
  nextRequest: {
    id: 31,
    date: new Date(now + 3 * DAY).toISOString(),
    clientName: 'Alex M.',
    serviceName: 'Routine nail care',
    location: 'L2R',
    status: 'rescheduled',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('next best action states', () => {
  it('shows a non-blocking skeleton while activation status loads', () => {
    mockDashboardLoaded(baseDashboard);
    mockActivation.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useGetMyProviderActivationStatus>);
    render(<PortalDashboard />);
    expect(screen.getByTestId('next-action-loading')).toBeInTheDocument();
    // The rest of the dashboard is never blocked by this card.
    expect(screen.getByTestId('dashboard-greeting')).toBeInTheDocument();
  });

  it('falls back to a quiet status-hub link on error without blocking the dashboard', () => {
    mockDashboardLoaded(baseDashboard);
    mockActivation.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useGetMyProviderActivationStatus>);
    render(<PortalDashboard />);
    expect(screen.getByTestId('next-action-error')).toBeInTheDocument();
    expect(screen.getByTestId('next-action-status-link')).toHaveAttribute(
      'href',
      '/provider/application-status',
    );
    expect(screen.getByTestId('dashboard-greeting')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  const linkCases: Array<[ProviderActivationNextAction, string, string]> = [
    ['continue_onboarding', 'Finish setting up your account', '/onboarding/provider'],
    ['wait_for_review', 'Your application is under review', '/provider/application-status'],
    ['review_update_needed', 'A small update is needed', '/provider/application-status'],
    ['contact_support', 'Your account needs attention', '/provider/application-status'],
    ['complete_profile', 'Complete your profile', '/provider/profile'],
    ['configure_service_area', 'Finish your service area', '/provider/service-area'],
    ['add_service', 'Add your first service', '/provider/services'],
    ['set_availability', 'Set your availability', '/provider/availability'],
    ['all_set', "You're all set", '/book/sarah-chen'],
  ];

  it.each(linkCases)(
    'renders %s with a truthful heading and existing deep link',
    (nextAction, heading, href) => {
      mockDashboardLoaded(baseDashboard);
      mockActivationLoaded(nextAction);
      render(<PortalDashboard />);
      const card = screen.getByTestId('next-action-card');
      expect(card).toHaveAttribute('data-action', nextAction);
      expect(card).toHaveTextContent(heading);
      expect(screen.getByTestId('next-action-primary')).toHaveAttribute('href', href);
    },
  );

  it.each([
    ['publish_booking_page', 'Publish your booking page'],
    ['share_booking_page', 'Your page is live'],
  ] as Array<[ProviderActivationNextAction, string]>)(
    'scrolls %s to the existing booking-link card instead of duplicating publish/share UI',
    (nextAction, heading) => {
      mockDashboardLoaded(baseDashboard);
      mockActivationLoaded(nextAction);
      render(<PortalDashboard />);
      expect(screen.getByTestId('next-action-card')).toHaveTextContent(heading);
      const primary = screen.getByTestId('next-action-primary');
      expect(primary.tagName).toBe('BUTTON');
      fireEvent.click(primary);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    },
  );

  it('never claims approval or a live page while under review', () => {
    mockDashboardLoaded(baseDashboard);
    mockActivationLoaded('wait_for_review');
    render(<PortalDashboard />);
    const card = screen.getByTestId('next-action-card');
    expect(card.textContent).not.toMatch(/approved/i);
    expect(card.textContent).not.toMatch(/is live/i);
    expect(card.textContent).not.toMatch(/clients are waiting/i);
  });
});

describe('pending reschedules', () => {
  it('shows the calm zero state after the next action', () => {
    mockDashboardLoaded(baseDashboard);
    mockActivationLoaded('all_set');
    render(<PortalDashboard />);
    const empty = screen.getByTestId('pending-reschedules-empty');
    expect(empty).toHaveTextContent('No pending schedule changes');
    expect(screen.queryByTestId('pending-reschedules-card')).not.toBeInTheDocument();
    // Ordering: nextAction leads when there is no schedule work.
    const nextCard = screen.getByTestId('next-action-card');
    expect(
      nextCard.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('surfaces one pending request with the soonest summary and deep link', () => {
    mockDashboardLoaded({ ...baseDashboard, pendingReschedules: pendingOne });
    mockActivationLoaded('all_set');
    render(<PortalDashboard />);
    const card = screen.getByTestId('pending-reschedules-card');
    expect(card).toHaveTextContent('1 reschedule request needs your attention');
    expect(screen.getByTestId('pending-reschedule-next')).toHaveTextContent('Alex M.');
    expect(screen.getByTestId('pending-reschedule-next')).toHaveTextContent(
      'Routine nail care',
    );
    const link = screen.getByTestId('pending-reschedules-review-link');
    expect(link).toHaveTextContent('Review request');
    expect(link).toHaveAttribute('href', '/provider/bookings?tab=rescheduled');
  });

  it('pluralizes multiple pending requests', () => {
    mockDashboardLoaded({
      ...baseDashboard,
      pendingReschedules: { ...pendingOne, count: 3 },
    });
    mockActivationLoaded('all_set');
    render(<PortalDashboard />);
    expect(screen.getByTestId('pending-reschedules-card')).toHaveTextContent(
      '3 reschedule requests need your attention',
    );
    expect(screen.getByTestId('pending-reschedules-review-link')).toHaveTextContent(
      'Review requests',
    );
  });

  it('prioritizes pending schedule work above the next action when present', () => {
    mockDashboardLoaded({ ...baseDashboard, pendingReschedules: pendingOne });
    mockActivationLoaded('set_availability');
    render(<PortalDashboard />);
    const pendingCard = screen.getByTestId('pending-reschedules-card');
    const nextCard = screen.getByTestId('next-action-card');
    expect(
      pendingCard.compareDocumentPosition(nextCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders only privacy-trimmed data (no full names or addresses)', () => {
    mockDashboardLoaded({ ...baseDashboard, pendingReschedules: pendingOne });
    mockActivationLoaded('all_set');
    const { container } = render(<PortalDashboard />);
    expect(container.textContent).toContain('Alex M.');
    expect(container.textContent).not.toContain('Morgan');
    expect(container.textContent).not.toMatch(/\d+ .*(Lane|Street|Ave)/);
  });
});

describe('bookings tab deep link', () => {
  it('allowlists ?tab= values and falls back to the default tab', () => {
    window.history.pushState({}, '', '/provider/bookings?tab=rescheduled');
    expect(initialBookingsTab()).toBe('rescheduled');
    window.history.pushState({}, '', '/provider/bookings?tab=confirmed');
    expect(initialBookingsTab()).toBe('confirmed');
    window.history.pushState({}, '', '/provider/bookings?tab=bogus');
    expect(initialBookingsTab()).toBe('requested');
    window.history.pushState({}, '', '/provider/bookings');
    expect(initialBookingsTab()).toBe('requested');
  });
});

describe('phase a accessibility', () => {
  it('has no axe violations with a pending reschedule and next action', async () => {
    mockDashboardLoaded({ ...baseDashboard, pendingReschedules: pendingOne });
    mockActivationLoaded('set_availability');
    const { container } = render(<PortalDashboard />);
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });

  it('has no axe violations in the zero-pending all-set state', async () => {
    mockDashboardLoaded(baseDashboard);
    mockActivationLoaded('all_set');
    const { container } = render(<PortalDashboard />);
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });
});
