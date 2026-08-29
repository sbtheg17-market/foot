/**
 * Provider Approval Status & Activation Hub (/provider/application-status) — web tests.
 *
 * Covers: loading/404/403/error states, plain-language status hero per
 * application state, truthful progress + milestone checklist (no fake
 * progress, locked steps pre-approval), server-derived next best action and
 * its deep links to existing routes, verification status + resubmission
 * recovery, booking-readiness cards, publish/share section states, support
 * links, rejected-application recovery actions, no false approval/publish
 * claims, and axe accessibility scans.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProviderApplicationStatus from '../pages/provider-application-status';
import {
  useGetMe,
  useGetMyProviderActivationStatus,
  useGetProviderApplicationStatus,
  useResetProviderApplication,
  useSubmitProviderApplication,
} from '@workspace/api-client-react';
import type { ProviderActivationStatus } from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetMe: vi.fn(),
  useGetMyProviderActivationStatus: vi.fn(),
  useGetProviderApplicationStatus: vi.fn(),
  useResetProviderApplication: vi.fn(),
  useSubmitProviderApplication: vi.fn(),
  getGetProviderApplicationStatusQueryKey: () => ['application-status'],
  getGetMyProviderActivationStatusQueryKey: () => ['activation-status'],
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/components/booking-page-card', () => ({
  default: () => <div data-testid="mock-booking-page-card" />,
}));
vi.mock('@/components/submission-history-timeline', () => ({
  SubmissionHistoryTimeline: () => <div data-testid="mock-timeline" />,
}));
vi.mock('@/components/support-contact-link', () => ({
  default: ({ testId }: { testId?: string }) => (
    <a data-testid={testId} href="#support">
      Contact support
    </a>
  ),
}));
vi.mock('wouter', () => ({
  Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ['/provider/application-status', vi.fn()],
}));

const mockMe = vi.mocked(useGetMe);
const mockActivation = vi.mocked(useGetMyProviderActivationStatus);
const mockStatus = vi.mocked(useGetProviderApplicationStatus);
const mockReset = vi.mocked(useResetProviderApplication);
const mockSubmit = vi.mocked(useSubmitProviderApplication);

const resetMutate = vi.fn();
const submitMutate = vi.fn();

function activationFixture(
  overrides: Partial<ProviderActivationStatus> = {},
  milestoneOverrides: Partial<ProviderActivationStatus['milestones']> = {},
): ProviderActivationStatus {
  const milestones = {
    accountCreated: true,
    profileCompleted: false,
    verificationSubmitted: false,
    approved: false,
    serviceAreaConfigured: false,
    activeServiceConfigured: false,
    availabilityConfigured: false,
    bookingPagePublished: false,
    firstBookingReceived: false,
    ...milestoneOverrides,
  };
  return {
    applicationStatus: 'draft',
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    canEdit: true,
    canReset: false,
    canResubmit: false,
    verification: { status: 'not_started', submittedAt: null, canResubmit: false },
    milestones,
    milestonesCompleted: Object.values(milestones).filter(Boolean).length,
    milestonesTotal: 9,
    bookingPage: {
      slug: null,
      published: false,
      publishedAt: null,
      path: null,
      eligible: false,
      verificationStatus: 'pending',
      serviceAreaConfigured: false,
    },
    nextAction: 'continue_onboarding',
    ...overrides,
  } as ProviderActivationStatus;
}

function arrange(activation: ProviderActivationStatus | null, opts: { loading?: boolean; errorStatus?: number } = {}) {
  mockMe.mockReturnValue({
    data: { user: { id: 1, firstName: 'Avery', lastName: 'Provider', role: 'provider' } },
    isLoading: false,
    error: null,
  } as never);
  mockActivation.mockReturnValue({
    data: activation ? { activation } : undefined,
    isLoading: opts.loading ?? false,
    isError: Boolean(opts.errorStatus),
    error: opts.errorStatus ? { status: opts.errorStatus } : null,
    refetch: vi.fn(),
  } as never);
  mockStatus.mockReturnValue({
    data: activation
      ? {
          status: {
            applicationId: 1,
            status: activation.applicationStatus,
            currentStep: 'submitted',
            submittedAt: null,
            reviewedAt: null,
            rejectionReason: activation.rejectionReason,
            submissionCount: 0,
            latestSubmission: null,
            nextAction: 'wait_for_review',
            canEdit: activation.canEdit,
            canReset: activation.canReset,
            canResubmit: activation.canResubmit,
          },
        }
      : undefined,
    isLoading: false,
    isError: false,
    error: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReset.mockReturnValue({ mutate: resetMutate, isPending: false, isError: false } as never);
  mockSubmit.mockReturnValue({ mutate: submitMutate, isPending: false, isError: false } as never);
});

describe('activation hub states', () => {
  it('shows a loading state', () => {
    arrange(null, { loading: true });
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-hub-loading')).toBeInTheDocument();
  });

  it('offers onboarding when no application exists (404)', () => {
    arrange(null, { errorStatus: 404 });
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-hub-empty-title')).toBeInTheDocument();
    expect(screen.getByTestId('activation-hub-start-cta')).toHaveAttribute('href', '/onboarding/provider');
  });

  it('keeps non-provider accounts out (403) without leaking data', () => {
    arrange(null, { errorStatus: 403 });
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-hub-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument();
  });

  it('shows a retryable error state', () => {
    arrange(null, { errorStatus: 500 });
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-hub-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('activation-hub-retry'));
  });
});

describe('draft state', () => {
  it('greets the provider, shows truthful progress, and resumes onboarding', () => {
    arrange(activationFixture());
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-status-pill')).toHaveTextContent('Finish setting up');
    expect(screen.getByTestId('activation-progress-count')).toHaveTextContent('1 of 9 steps complete');
    expect(screen.getByTestId('activation-next-action-link')).toHaveAttribute('href', '/onboarding/provider');
    expect(screen.getByTestId('activation-hero')).toHaveTextContent('Avery');
    expect(screen.getByTestId('activation-verification-status')).toHaveTextContent('Not started');
  });

  it('locks approval-gated steps with honest copy instead of dead links', () => {
    arrange(activationFixture());
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-step-locked-serviceAreaConfigured')).toHaveTextContent(
      'Available after approval',
    );
    expect(screen.queryByTestId('activation-step-action-serviceAreaConfigured')).not.toBeInTheDocument();
  });
});

describe('under review state', () => {
  it('shows honest waiting copy without approval claims', () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'under_review',
          canEdit: false,
          nextAction: 'wait_for_review',
          verification: { status: 'under_review', submittedAt: '2026-08-27T12:00:00Z', canResubmit: false },
        },
        { profileCompleted: true, verificationSubmitted: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-status-pill')).toHaveTextContent('Under review');
    expect(screen.getByTestId('activation-next-action')).toHaveTextContent('No action needed right now');
    expect(screen.getByTestId('activation-next-after')).toHaveTextContent(
      "When there's a decision, this page will show your next step.",
    );
    expect(screen.queryByText(/you're approved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your booking page is live/i)).not.toBeInTheDocument();
  });
});

describe('approved application, verification still pending (pilot finding M-1)', () => {
  it('keeps a truthful wait state with no setup CTA and locked checklist links', async () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'approved',
          canEdit: false,
          nextAction: 'wait_for_review',
          verification: { status: 'under_review', submittedAt: '2026-08-27T12:00:00Z', canResubmit: false },
        },
        { profileCompleted: true, verificationSubmitted: true },
      ),
    );
    const { container } = render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-title')).toHaveTextContent(
      'verification is the last review step',
    );
    expect(screen.getByTestId('activation-next-action')).toHaveTextContent('No action needed right now');
    // The primary CTA must never point at an approval-gated destination here.
    expect(screen.queryByTestId('activation-next-action-link')).not.toBeInTheDocument();
    // Checklist deep links stay locked until the full approved-provider gate.
    expect(screen.queryByTestId('activation-step-action-serviceAreaConfigured')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-step-locked-serviceAreaConfigured')).toHaveTextContent(
      'Available after approval',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('routes an approved application with rejected verification to the accessible update path', () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'approved',
          canEdit: false,
          nextAction: 'review_update_needed',
          verification: { status: 'needs_update', submittedAt: '2026-08-27T12:00:00Z', canResubmit: true },
        },
        { profileCompleted: true, verificationSubmitted: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    // The CTA anchor target must exist in this state.
    expect(screen.getByTestId('activation-next-action-link')).toHaveAttribute(
      'href',
      '#activation-feedback',
    );
    expect(screen.getByTestId('activation-feedback')).toBeInTheDocument();
    expect(screen.getByTestId('activation-verification-update-note')).toBeInTheDocument();
    // Verification recovery stays available (accessible, non-gated route).
    expect(screen.getByTestId('activation-verification-resubmit')).toHaveAttribute(
      'href',
      '/provider/credentials',
    );
  });
});

describe('progress and next-step clarity', () => {
  it('keeps the one primary next action above the progress summary (mobile CTA priority)', () => {
    arrange(
      activationFixture(
        { applicationStatus: 'approved', canEdit: false, nextAction: 'add_service' },
        { profileCompleted: true, verificationSubmitted: true, approved: true, serviceAreaConfigured: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    const nextAction = screen.getByTestId('activation-next-action');
    const progress = screen.getByTestId('activation-progress');
    // Next action must precede the progress summary in DOM order.
    expect(
      nextAction.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Exactly one primary next-action CTA.
    expect(screen.getAllByTestId('activation-next-action-link')).toHaveLength(1);
  });

  it('explains why the next step matters and what follows it, without demand promises', () => {
    arrange(
      activationFixture(
        { applicationStatus: 'approved', canEdit: false, nextAction: 'add_service' },
        { profileCompleted: true, verificationSubmitted: true, approved: true, serviceAreaConfigured: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-next-action')).toHaveTextContent(
      'Clients book a specific service',
    );
    expect(screen.getByTestId('activation-next-after')).toHaveTextContent(
      'Your services become what clients choose from when your page is live.',
    );
    expect(screen.queryByText(/guarantee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clients are waiting/i)).not.toBeInTheDocument();
  });

  it('renders semantic, text-based progress from server counts only', () => {
    arrange(
      activationFixture(
        { applicationStatus: 'approved', canEdit: false, nextAction: 'add_service' },
        { profileCompleted: true, verificationSubmitted: true, approved: true, serviceAreaConfigured: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-progress-count')).toHaveTextContent('5 of 9 steps complete');
    expect(
      screen.getByRole('progressbar', { name: 'Setup progress: 5 of 9 steps complete' }),
    ).toBeInTheDocument();
  });
});

describe('approved journey', () => {
  it('points a newly approved provider at service areas with direct deep links', () => {
    arrange(
      activationFixture(
        { applicationStatus: 'approved', canEdit: false, nextAction: 'configure_service_area' },
        { profileCompleted: true, verificationSubmitted: true, approved: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-next-action-link')).toHaveAttribute('href', '/provider/service-area');
    expect(screen.getByTestId('activation-progress-count')).toHaveTextContent('4 of 9 steps complete');
    expect(screen.getByTestId('activation-step-action-serviceAreaConfigured')).toHaveAttribute(
      'href',
      '/provider/service-area',
    );
    expect(screen.getByTestId('activation-step-action-activeServiceConfigured')).toHaveAttribute(
      'href',
      '/provider/services',
    );
    expect(screen.getByTestId('activation-step-action-availabilityConfigured')).toHaveAttribute(
      'href',
      '/provider/availability',
    );
    const card = screen.getByTestId('activation-readiness-card-service-area');
    expect(card).toHaveTextContent('Needs attention');
    expect(screen.getByTestId('mock-booking-page-card')).toBeInTheDocument();
  });

  it('celebrates a live page truthfully and pivots to sharing', () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'approved',
          canEdit: false,
          nextAction: 'share_booking_page',
          verification: { status: 'approved', submittedAt: '2026-08-27T12:00:00Z', canResubmit: false },
          bookingPage: {
            slug: 'avery-provider',
            published: true,
            publishedAt: '2026-08-27T12:00:00Z',
            path: '/book/avery-provider',
            eligible: true,
            verificationStatus: 'approved',
            serviceAreaConfigured: true,
          },
        },
        {
          profileCompleted: true,
          verificationSubmitted: true,
          approved: true,
          serviceAreaConfigured: true,
          activeServiceConfigured: true,
          availabilityConfigured: true,
          bookingPagePublished: true,
        },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-title')).toHaveTextContent('Your booking page is live');
    expect(screen.getByTestId('activation-share-copy')).toHaveTextContent('Your booking page is live.');
    expect(screen.getByTestId('activation-next-action-link')).toHaveAttribute('href', '#activation-booking-page');
    expect(within(screen.getByTestId('activation-readiness-card-booking-page')).getByText('Live')).toBeInTheDocument();
  });

  it('sends a fully activated provider to the dashboard', () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'approved',
          canEdit: false,
          nextAction: 'all_set',
          milestonesCompleted: 9,
        },
        {
          profileCompleted: true,
          verificationSubmitted: true,
          approved: true,
          serviceAreaConfigured: true,
          activeServiceConfigured: true,
          availabilityConfigured: true,
          bookingPagePublished: true,
          firstBookingReceived: true,
        },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-title')).toHaveTextContent("You're up and running");
    expect(screen.getByTestId('activation-next-action-link')).toHaveAttribute('href', '/provider/dashboard');
  });
});

describe('recovery states', () => {
  it('shows rejected feedback with server-gated reset and verification recovery', () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'rejected',
          rejectionReason: 'Please confirm your license number.',
          canEdit: false,
          canReset: true,
          nextAction: 'review_update_needed',
          verification: { status: 'needs_update', submittedAt: '2026-08-27T12:00:00Z', canResubmit: true },
        },
        { profileCompleted: true, verificationSubmitted: true },
      ),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-status-pill')).toHaveTextContent('Update needed');
    expect(screen.getByTestId('activation-rejection-reason')).toHaveTextContent(
      'Please confirm your license number.',
    );
    expect(screen.getByTestId('activation-verification-status')).toHaveTextContent('Needs update');
    expect(screen.getByTestId('activation-verification-resubmit')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('activation-reset-cta'));
    expect(resetMutate).toHaveBeenCalled();
    expect(screen.queryByTestId('activation-resubmit-cta')).not.toBeInTheDocument();
  });

  it('routes suspended accounts to support', () => {
    arrange(
      activationFixture({
        applicationStatus: 'suspended',
        canEdit: false,
        nextAction: 'contact_support',
      }),
    );
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-status-pill')).toHaveTextContent('Account needs attention');
    expect(screen.getByTestId('activation-next-action-support')).toBeInTheDocument();
  });
});

describe('trust, value, and support', () => {
  it('renders the honest value section, help section, and privacy statement', () => {
    arrange(activationFixture());
    render(<ProviderApplicationStatus />);
    expect(screen.getByTestId('activation-value')).toHaveTextContent('Keep bookable times accurate');
    expect(screen.getByTestId('activation-help')).toHaveTextContent(
      'We use your verification information only to review your provider application.',
    );
    expect(screen.getByTestId('activation-help-support')).toBeInTheDocument();
    // No unimplemented-feature claims anywhere on the hub.
    expect(screen.queryByText(/reminder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/guarantee/i)).not.toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('has no axe violations on the loaded approved hub', async () => {
    arrange(
      activationFixture(
        { applicationStatus: 'approved', canEdit: false, nextAction: 'configure_service_area' },
        { profileCompleted: true, verificationSubmitted: true, approved: true },
      ),
    );
    const { container } = render(<ProviderApplicationStatus />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations on the rejected recovery state', async () => {
    arrange(
      activationFixture(
        {
          applicationStatus: 'rejected',
          rejectionReason: 'Please confirm your license number.',
          canReset: true,
          canEdit: false,
          nextAction: 'review_update_needed',
          verification: { status: 'needs_update', submittedAt: null, canResubmit: true },
        },
        { profileCompleted: true, verificationSubmitted: true },
      ),
    );
    const { container } = render(<ProviderApplicationStatus />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
