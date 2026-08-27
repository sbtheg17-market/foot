/**
 * /admin/pilot — Pilot Operations Dashboard (Part 2) web tests.
 *
 * Covers: loading/401/403/error+retry states (with no metric-data flash),
 * pilot window context (configured + projected), summary cards with honest
 * undefined-rate copy, activation ladder, provider health table + friendly
 * follow-up labels, retention control (update/saved/error-preserve/keyboard),
 * source chart + zero state, review prompts, CSV download flow, and axe.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPilot from '../pages/admin/pilot';
import {
  useGetAdminPilotMetrics,
  useUpdatePilotProviderRetention,
} from '@workspace/api-client-react';
import type { PilotMetricsResponse } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetAdminPilotMetrics: vi.fn(),
  useUpdatePilotProviderRetention: vi.fn(),
  getGetAdminPilotMetricsQueryKey: () => ['/api/admin/pilot/metrics'],
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('wouter', () => ({
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockMetrics = vi.mocked(useGetAdminPilotMetrics);
const mockRetention = vi.mocked(useUpdatePilotProviderRetention);

type RetentionOptions = {
  mutation?: {
    onSuccess?: (...args: unknown[]) => void;
    onError?: (...args: unknown[]) => void;
    onSettled?: (...args: unknown[]) => void;
  };
};

let retentionMutateCalls: Array<{ providerId: number; data: { retentionIntent: string } }> = [];
let retentionBehavior: 'success' | 'error' | 'none' = 'none';

const allMilestones = {
  accountCreated: true,
  profileCompleted: true,
  verificationSubmitted: true,
  approved: true,
  serviceAreaConfigured: true,
  serviceConfigured: true,
  availabilityConfigured: true,
  bookingPagePublished: true,
  firstBookingReceived: true,
};

const baseData: PilotMetricsResponse = {
  pilot: {
    startDate: '2026-08-27',
    endDate: '2026-10-01',
    isProjected: false,
    configWarning: null,
    providerTarget: 5,
    generatedAt: '2026-08-28T12:00:00.000Z',
  },
  summary: {
    approvedProviders: 2,
    activatedProviders: 2,
    activationRate: 1,
    providersWithPublishedBookingPage: 2,
    providersWithAttributedBookings: 1,
    totalBookings: 8,
    completedBookings: 6,
    cancelledBookings: 1,
    noShowBookings: 1,
    completionRate: 0.75,
    cancellationRate: 0.125,
    noShowRate: 0.125,
    supportEscalations: 1,
    retentionYes: 1,
    retentionNo: 1,
    retentionUnknown: 1,
  },
  providers: [
    {
      providerId: '4',
      providerName: 'Sarah Chen',
      approvalStatus: 'approved',
      activationStatus: 'active',
      onboardingMilestones: { ...allMilestones },
      bookingPagePublished: true,
      firstBookingAt: '2026-08-29T15:00:00.000Z',
      bookings: 6,
      completions: 5,
      cancellations: 1,
      noShows: 0,
      completionRate: 0.83,
      cancellationRate: 0.17,
      noShowRate: 0,
      repeatClientRate: 0.4,
      attributedBookings: 5,
      retentionIntent: 'yes',
      retentionUpdatedAt: '2026-08-30T00:00:00.000Z',
      riskFlags: [],
    },
    {
      providerId: '7',
      providerName: 'Maya Osei',
      approvalStatus: 'pending',
      activationStatus: 'in_progress',
      onboardingMilestones: {
        ...allMilestones,
        verificationSubmitted: false,
        approved: false,
        serviceAreaConfigured: false,
        serviceConfigured: false,
        availabilityConfigured: false,
        bookingPagePublished: false,
        firstBookingReceived: false,
      },
      bookingPagePublished: false,
      firstBookingAt: null,
      bookings: 0,
      completions: 0,
      cancellations: 0,
      noShows: 0,
      completionRate: null,
      cancellationRate: null,
      noShowRate: null,
      repeatClientRate: null,
      attributedBookings: 0,
      retentionIntent: 'unknown',
      retentionUpdatedAt: null,
      riskFlags: ['not_activated', 'no_booking_yet'],
    },
    {
      providerId: '9',
      providerName: 'Jo Park',
      approvalStatus: 'approved',
      activationStatus: 'published',
      onboardingMilestones: { ...allMilestones, firstBookingReceived: false },
      bookingPagePublished: true,
      firstBookingAt: null,
      bookings: 2,
      completions: 1,
      cancellations: 1,
      noShows: 0,
      completionRate: 0.5,
      cancellationRate: 0.5,
      noShowRate: 0,
      repeatClientRate: null,
      attributedBookings: 2,
      retentionIntent: 'no',
      retentionUpdatedAt: '2026-08-30T00:00:00.000Z',
      riskFlags: ['high_cancellation_rate', 'retention_risk'],
    },
  ],
  sourceAttribution: [
    { source: 'instagram', bookings: 4, percentage: 0.5 },
    { source: 'qr-card', bookings: 2, percentage: 0.25 },
    { source: 'unknown', bookings: 2, percentage: 0.25 },
  ],
};

const emptyData: PilotMetricsResponse = {
  pilot: {
    startDate: '2026-09-01',
    endDate: '2026-10-06',
    isProjected: true,
    configWarning: 'PILOT_START_DATE is invalid; using a projected window.',
    providerTarget: 5,
    generatedAt: '2026-08-28T12:00:00.000Z',
  },
  summary: {
    approvedProviders: 0,
    activatedProviders: 0,
    activationRate: null,
    providersWithPublishedBookingPage: 0,
    providersWithAttributedBookings: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    completionRate: null,
    cancellationRate: null,
    noShowRate: null,
    supportEscalations: 0,
    retentionYes: 0,
    retentionNo: 0,
    retentionUnknown: 0,
  },
  providers: [],
  sourceAttribution: [],
};

function mockSuccess(data: PilotMetricsResponse, refetch = vi.fn()) {
  mockMetrics.mockReturnValue({ data, isLoading: false, error: null, refetch } as never);
  return refetch;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPilot />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  retentionMutateCalls = [];
  retentionBehavior = 'none';
  // Per-instance mock: each row's mutate fires that row's own callbacks.
  mockRetention.mockImplementation(((options: RetentionOptions) => ({
    isPending: false,
    mutate: (vars: { providerId: number; data: { retentionIntent: string } }) => {
      retentionMutateCalls.push(vars);
      if (retentionBehavior === 'success') {
        options?.mutation?.onSuccess?.();
        options?.mutation?.onSettled?.();
      } else if (retentionBehavior === 'error') {
        options?.mutation?.onError?.(new Error('HTTP 500'));
        options?.mutation?.onSettled?.();
      }
    },
  }) as never));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPilot route and authorization states', () => {
  it('shows a loading state and renders no metric data while the request resolves', () => {
    mockMetrics.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderPage();
    expect(screen.getByTestId('pilot-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-summary-cards')).toBeNull();
    expect(screen.queryByTestId('provider-health-table')).toBeNull();
    expect(screen.queryByTestId('pilot-csv-export-btn')).toBeNull();
  });

  it('asks unauthenticated visitors to sign in (401) without any metric data', () => {
    mockMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 401 },
      refetch: vi.fn(),
    } as never);
    renderPage();
    expect(screen.getByTestId('pilot-auth-required')).toBeInTheDocument();
    expect(screen.getByTestId('pilot-login-link')).toHaveAttribute('href', '/login');
    expect(screen.queryByTestId('pilot-summary-cards')).toBeNull();
    expect(screen.queryByTestId('pilot-csv-export-btn')).toBeNull();
  });

  it('shows the platform-administrator restriction for provider/client accounts (403)', () => {
    mockMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 403 },
      refetch: vi.fn(),
    } as never);
    renderPage();
    expect(screen.getByTestId('pilot-access-denied')).toBeInTheDocument();
    expect(screen.getByText(/restricted to platform administrators/i)).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-summary-cards')).toBeNull();
    expect(screen.queryByTestId('provider-health-table')).toBeNull();
  });

  it('shows a retryable error state for other failures', () => {
    const refetch = vi.fn();
    mockMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
      refetch,
    } as never);
    renderPage();
    expect(screen.getByTestId('pilot-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pilot-error-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('labels the page for the platform administrator', () => {
    mockSuccess(baseData);
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Pilot Operations' })).toBeInTheDocument();
    expect(screen.getByText(/Platform administrator/)).toBeInTheDocument();
    expect(screen.getByText(/never shown to providers or clients/i)).toBeInTheDocument();
  });
});

describe('AdminPilot pilot window context', () => {
  it('renders a configured pilot window without the projected notice', () => {
    mockSuccess(baseData);
    renderPage();
    expect(screen.getByTestId('pilot-window-dates')).toHaveTextContent('Aug 27, 2026');
    expect(screen.getByTestId('pilot-window-dates')).toHaveTextContent('Oct 1, 2026');
    expect(screen.getByText('5-provider target')).toBeInTheDocument();
    expect(screen.getByTestId('pilot-generated-at')).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-window-projected-note')).toBeNull();
  });

  it('flags a projected window with configuration guidance', () => {
    mockSuccess(emptyData);
    renderPage();
    expect(screen.getByTestId('pilot-window-projected-badge')).toBeInTheDocument();
    expect(screen.getByTestId('pilot-window-projected-note')).toHaveTextContent(
      'configure PILOT_START_DATE and PILOT_END_DATE',
    );
    expect(screen.getByTestId('pilot-config-warning')).toHaveTextContent('projected window');
  });
});

describe('AdminPilot summary cards', () => {
  it('renders values with quiet threshold aids as text, not color alone', () => {
    mockSuccess(baseData);
    renderPage();
    expect(within(screen.getByTestId('summary-card-approved')).getByText('2')).toBeInTheDocument();
    const activation = screen.getByTestId('summary-card-activation');
    expect(within(activation).getByText('100%')).toBeInTheDocument();
    expect(within(activation).getByText('At target')).toBeInTheDocument();
    const cancellation = screen.getByTestId('summary-card-cancellation');
    expect(within(cancellation).getByText('13%')).toBeInTheDocument();
    expect(within(cancellation).getByText('Within guardrail')).toBeInTheDocument();
    const noShow = screen.getByTestId('summary-card-no-show');
    expect(within(noShow).getByText('13%')).toBeInTheDocument();
    expect(within(noShow).getByText('Above guardrail')).toBeInTheDocument();
    const retention = screen.getByTestId('summary-card-retention');
    expect(within(retention).getByText('1 yes · 1 no · 1 unknown')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('summary-card-first-booking')).getByText('1'),
    ).toBeInTheDocument();
  });

  it('uses honest empty copy for undefined rates — never a misleading 0%', () => {
    mockSuccess(emptyData);
    renderPage();
    const completion = screen.getByTestId('summary-card-completion');
    expect(within(completion).getByText('No completed appointments yet')).toBeInTheDocument();
    expect(within(completion).queryByText('0%')).toBeNull();
    expect(
      within(screen.getByTestId('summary-card-activation')).getByText('No approved providers yet'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('summary-card-no-show')).getByText('No booking outcomes yet'),
    ).toBeInTheDocument();
  });
});

describe('AdminPilot activation overview', () => {
  it('shows the provider journey ladder with per-step counts', () => {
    mockSuccess(baseData);
    renderPage();
    expect(screen.getByTestId('milestone-accountCreated')).toHaveTextContent('3 of 3');
    expect(screen.getByTestId('milestone-approved')).toHaveTextContent('2 of 3');
    expect(screen.getByTestId('milestone-bookingPagePublished')).toHaveTextContent('2 of 3');
    expect(screen.getByTestId('milestone-firstBookingReceived')).toHaveTextContent('1 of 3');
  });

  it('shows the empty journey state when there are no providers', () => {
    mockSuccess(emptyData);
    renderPage();
    expect(screen.getByTestId('activation-overview-empty')).toBeInTheDocument();
  });
});

describe('AdminPilot provider health table', () => {
  it('renders statuses, outcomes, and friendly follow-up labels', () => {
    mockSuccess(baseData);
    renderPage();
    const sarah = screen.getByTestId('provider-row-4');
    expect(within(sarah).getByText('Sarah Chen')).toBeInTheDocument();
    expect(within(sarah).getByText('Active')).toBeInTheDocument();
    expect(within(sarah).getByText('Published')).toBeInTheDocument();
    expect(within(sarah).getByText('83%')).toBeInTheDocument();
    expect(within(sarah).getByText('Nothing flagged')).toBeInTheDocument();

    const maya = screen.getByTestId('provider-row-7');
    expect(within(maya).getByText('Setting up')).toBeInTheDocument();
    expect(within(maya).getByText('Not published')).toBeInTheDocument();
    expect(within(maya).getByText('None yet')).toBeInTheDocument();
    expect(within(maya).getByText('No outcomes yet')).toBeInTheDocument();
    expect(screen.getByTestId('risk-flag-7-not_activated')).toHaveTextContent('Setup incomplete');
    expect(screen.getByTestId('risk-flag-7-no_booking_yet')).toHaveTextContent('No booking yet');

    expect(screen.getByTestId('risk-flag-9-high_cancellation_rate')).toHaveTextContent(
      'Review cancellations',
    );
    expect(screen.getByTestId('risk-flag-9-retention_risk')).toHaveTextContent(
      'Check in with provider',
    );
  });

  it('shows the empty table state when no providers are in the pilot', () => {
    mockSuccess(emptyData);
    renderPage();
    expect(screen.getByTestId('provider-table-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-health-table')).toBeNull();
  });
});

describe('AdminPilot retention control', () => {
  it('updates retention intent through the Part 1 hook and confirms Saved', () => {
    retentionBehavior = 'success';
    mockSuccess(baseData);
    renderPage();
    const select = screen.getByTestId('retention-select-7') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'yes' } });
    expect(retentionMutateCalls).toEqual([{ providerId: 7, data: { retentionIntent: 'yes' } }]);
    expect(select.value).toBe('yes');
    expect(screen.getByTestId('retention-saved-7')).toHaveTextContent('Saved');
  });

  it('preserves the previous value and reports the failure when the update fails', () => {
    retentionBehavior = 'error';
    mockSuccess(baseData);
    renderPage();
    const select = screen.getByTestId('retention-select-7') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'no' } });
    expect(select.value).toBe('unknown');
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      expect.stringContaining('previous value is unchanged'),
    );
    expect(screen.queryByTestId('retention-saved-7')).toBeNull();
  });

  it('is labeled per provider and keyboard-focusable', () => {
    mockSuccess(baseData);
    renderPage();
    const select = screen.getByLabelText('Retention intent for Maya Osei');
    select.focus();
    expect(document.activeElement).toBe(select);
    expect(screen.getByLabelText('Retention intent for Sarah Chen')).toBeInTheDocument();
  });
});

describe('AdminPilot source attribution chart', () => {
  it('shows source labels, counts, and percentages as text', () => {
    mockSuccess(baseData);
    renderPage();
    const instagram = screen.getByTestId('pilot-source-bar-instagram');
    expect(within(instagram).getByText('Instagram')).toBeInTheDocument();
    expect(instagram).toHaveTextContent('4');
    expect(instagram).toHaveTextContent('(50%)');
    expect(within(screen.getByTestId('pilot-source-bar-qr-card')).getByText('QR card')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('pilot-source-bar-unknown')).getByText('Direct / unknown'),
    ).toBeInTheDocument();
  });

  it('shows the zero-data source state', () => {
    mockSuccess(emptyData);
    renderPage();
    expect(screen.getByTestId('pilot-source-chart-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('pilot-source-chart')).toBeNull();
  });
});

describe('AdminPilot review prompts', () => {
  it('shows factual prompts derived from current numbers only', () => {
    mockSuccess(baseData);
    renderPage();
    expect(screen.getByTestId('review-prompt-no-show')).toBeInTheDocument();
    expect(screen.getByTestId('review-prompt-escalations')).toBeInTheDocument();
    expect(screen.queryByTestId('review-prompt-cancellation')).toBeNull();
    expect(screen.queryByTestId('review-prompt-no-published')).toBeNull();
  });

  it('shows the all-quiet state when nothing needs review', () => {
    mockSuccess(emptyData);
    renderPage();
    expect(screen.getByTestId('review-prompts-empty')).toBeInTheDocument();
  });
});

describe('AdminPilot CSV export', () => {
  it('downloads a client-generated CSV with the dated filename', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:pilot-csv');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    let downloadName = '';
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    mockSuccess(baseData);
    renderPage();
    fireEvent.click(screen.getByTestId('pilot-csv-export-btn'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe('pilot-operations-metrics-2026-08-28.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pilot-csv');
  });
});

describe('AdminPilot accessibility', () => {
  it('has no axe accessibility violations on the loaded dashboard', async () => {
    mockSuccess(baseData);
    const { container } = renderPage();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe accessibility violations on the empty projected-window state', async () => {
    mockSuccess(emptyData);
    const { container } = renderPage();
    expect(await axeViolations(container)).toEqual([]);
  });
});
