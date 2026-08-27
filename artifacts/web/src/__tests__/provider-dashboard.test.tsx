/**
 * Provider dashboard (/provider/dashboard) — web tests.
 *
 * Covers: loading/error/empty states, greeting + today count + next booking,
 * quick actions (links + share scroll), performance metrics (values, status
 * text, zero state), source-attribution chart (bars, counts, empty state),
 * upcoming bookings 7/30-day toggle, recent-activity collapsible, earnings
 * preview, and an axe accessibility scan.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PortalDashboard from '../pages/portal/dashboard';
import { useGetMyProviderDashboard } from '@workspace/api-client-react';
import type { ProviderDashboardResponse } from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMyProviderDashboard: vi.fn(),
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
  formatBookingDate: (iso: string) => `Aug ${new Date(iso).getUTCDate()}`,
  formatBookingTime: () => '2:00 PM',
}));

const mockDashboard = vi.mocked(useGetMyProviderDashboard);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const baseData: ProviderDashboardResponse = {
  providerId: 7,
  providerName: 'Sarah Chen',
  slug: 'sarah-chen',
  bookingPagePublished: true,
  bookingUrl: '/book/sarah-chen',
  todayBookingsCount: 2,
  nextBooking: {
    id: 21,
    date: new Date(now + DAY).toISOString(),
    clientName: 'Alex M.',
    serviceName: 'Routine nail care',
    location: 'L2R',
    status: 'confirmed' as const,
  },
  upcomingBookings: [
    {
      id: 21,
      date: new Date(now + DAY).toISOString(),
      clientName: 'Alex M.',
      serviceName: 'Routine nail care',
      location: 'L2R',
      status: 'confirmed' as const,
    },
    {
      id: 22,
      date: new Date(now + 20 * DAY).toISOString(),
      clientName: 'Jo P.',
      serviceName: 'Diabetic foot check',
      location: 'St. Catharines',
      status: 'requested' as const,
    },
  ],
  metrics: {
    completionRate: 0.92,
    cancellationRate: 0.25,
    noShowRate: 0.05,
    repeatClientRate: 0.5,
    totalBookings: 14,
    completedBookings: 11,
    cancelledBookings: 2,
    noShowBookings: 1,
    resolvedBookings: 12,
  },
  sourceAttribution: {
    instagram: 3,
    qrCard: 2,
    text: 0,
    facebook: 0,
    website: 1,
    other: 0,
    unknown: 4,
  },
  recentActivity: [
    {
      type: 'booking' as const,
      date: new Date(now - DAY).toISOString(),
      clientName: 'Alex M.',
      serviceName: 'Routine nail care',
      status: 'completed',
    },
    {
      type: 'cancellation' as const,
      date: new Date(now - 2 * DAY).toISOString(),
      clientName: 'Jo P.',
      serviceName: 'Callus care',
      status: 'cancelled',
    },
  ],
  earningsPreview: { estimatedMonthlyCents: 27000, available: false },
  updatedAt: new Date(now).toISOString(),
};

function mockLoaded(data: ProviderDashboardResponse) {
  mockDashboard.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGetMyProviderDashboard>);
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('provider dashboard states', () => {
  it('shows a loading skeleton while fetching', () => {
    mockDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGetMyProviderDashboard>);
    render(<PortalDashboard />);
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
  });

  it('shows an error state with a working retry button', () => {
    const refetch = vi.fn();
    mockDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useGetMyProviderDashboard>);
    render(<PortalDashboard />);
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('provider dashboard content', () => {
  it('greets the provider by first name with today count and next booking', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    expect(screen.getByTestId('dashboard-greeting').textContent).toMatch(
      /Good (morning|afternoon|evening), Sarah/,
    );
    expect(screen.getByTestId('dashboard-today-count')).toHaveTextContent(
      'You have 2 bookings today',
    );
    const next = screen.getByTestId('dashboard-next-booking');
    expect(next).toHaveTextContent('Alex M.');
    expect(next).toHaveTextContent('Routine nail care');
    expect(next).toHaveTextContent('2:00 PM');
  });

  it('renders quick actions with correct destinations and share scroll', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    expect(screen.getByTestId('quick-action-availability')).toHaveAttribute(
      'href',
      '/provider/availability',
    );
    expect(screen.getByTestId('quick-action-bookings')).toHaveAttribute(
      'href',
      '/provider/bookings',
    );
    fireEvent.click(screen.getByTestId('quick-action-share-link'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('renders performance metrics with values and text status chips', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    const completion = screen.getByTestId('metric-completion');
    expect(completion).toHaveTextContent('92%');
    expect(completion).toHaveTextContent('On track');
    const cancellation = screen.getByTestId('metric-cancellation');
    expect(cancellation).toHaveTextContent('25%');
    expect(cancellation).toHaveTextContent('Worth a look');
    const noShow = screen.getByTestId('metric-no-show');
    expect(noShow).toHaveTextContent('5%');
    expect(noShow).toHaveTextContent('On track');
    const repeat = screen.getByTestId('metric-repeat');
    expect(repeat).toHaveTextContent('50%');
    expect(repeat).toHaveTextContent('book again');
  });

  it('shows an honest metrics empty state before any resolved booking', () => {
    mockLoaded({
      ...baseData,
      metrics: { ...baseData.metrics, resolvedBookings: 0 },
    });
    render(<PortalDashboard />);
    expect(screen.getByTestId('metrics-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('metric-completion')).not.toBeInTheDocument();
  });

  it('renders the source-attribution chart with counts and hides zero rows', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    const chart = screen.getByTestId('source-attribution-chart');
    expect(within(chart).getByTestId('source-bar-instagram')).toHaveTextContent('Instagram');
    expect(within(chart).getByTestId('source-bar-instagram')).toHaveTextContent('3');
    expect(within(chart).getByTestId('source-bar-qrCard')).toHaveTextContent('QR card');
    expect(within(chart).getByTestId('source-bar-unknown')).toHaveTextContent('4');
    expect(within(chart).queryByTestId('source-bar-facebook')).not.toBeInTheDocument();
    expect(within(chart).queryByTestId('source-bar-other')).not.toBeInTheDocument();
  });

  it('shows the source-attribution empty state when there are no bookings', () => {
    mockLoaded({
      ...baseData,
      sourceAttribution: {
        instagram: 0,
        qrCard: 0,
        text: 0,
        facebook: 0,
        website: 0,
        other: 0,
        unknown: 0,
      },
    });
    render(<PortalDashboard />);
    expect(screen.getByTestId('source-attribution-empty')).toBeInTheDocument();
  });

  it('filters upcoming bookings by the 7/30-day toggle', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    // Default 7-day window: only the tomorrow booking is visible.
    expect(screen.getByTestId('upcoming-booking-21')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-booking-22')).not.toBeInTheDocument();
    expect(screen.getByTestId('upcoming-toggle-7')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('upcoming-toggle-30'));
    expect(screen.getByTestId('upcoming-toggle-30')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('upcoming-booking-22')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-booking-22')).toHaveTextContent('Awaiting your reply');
  });

  it('shows an upcoming empty state with encouragement to share', () => {
    mockLoaded({ ...baseData, upcomingBookings: [], nextBooking: null });
    render(<PortalDashboard />);
    expect(screen.getByTestId('upcoming-empty')).toHaveTextContent(
      'No bookings in the next 7 days',
    );
    expect(screen.queryByTestId('dashboard-next-booking')).not.toBeInTheDocument();
  });

  it('keeps recent activity collapsed until toggled open', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    expect(screen.queryByTestId('recent-activity-item-0')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('recent-activity-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('recent-activity-item-0')).toHaveTextContent('Completed');
    expect(screen.getByTestId('recent-activity-item-1')).toHaveTextContent('Cancelled');
  });

  it('renders the earnings preview as coming soon with an honest estimate', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    const section = screen.getByTestId('earnings-preview-section');
    expect(section).toHaveTextContent('Coming soon');
    expect(screen.getByTestId('earnings-estimate')).toHaveTextContent('$270.00');
    expect(section).toHaveTextContent('you keep 100%');
  });

  it('renders the shared cards (readiness, first booking, booking link)', () => {
    mockLoaded(baseData);
    render(<PortalDashboard />);
    expect(screen.getByTestId('mock-readiness-card')).toBeInTheDocument();
    expect(screen.getByTestId('mock-first-booking-card')).toBeInTheDocument();
    expect(screen.getByTestId('mock-booking-page-card')).toBeInTheDocument();
  });
});

describe('provider dashboard accessibility', () => {
  it('has no axe violations on the loaded dashboard', async () => {
    mockLoaded(baseData);
    const { container } = render(<PortalDashboard />);
    // Open the collapsible so its content is scanned too.
    fireEvent.click(screen.getByTestId('recent-activity-toggle'));
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });

  it('has no axe violations on the empty dashboard', async () => {
    mockLoaded({
      ...baseData,
      nextBooking: null,
      upcomingBookings: [],
      recentActivity: [],
      metrics: { ...baseData.metrics, resolvedBookings: 0 },
      sourceAttribution: {
        instagram: 0,
        qrCard: 0,
        text: 0,
        facebook: 0,
        website: 0,
        other: 0,
        unknown: 0,
      },
      earningsPreview: { estimatedMonthlyCents: null, available: false },
    });
    const { container } = render(<PortalDashboard />);
    const violations = await axeViolations(container);
    expect(violations).toEqual([]);
  });
});
