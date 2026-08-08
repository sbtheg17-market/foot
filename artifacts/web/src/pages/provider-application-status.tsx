import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetProviderApplicationStatusQueryKey,
  useGetMe,
  useGetProviderApplicationStatus,
  useResetProviderApplication,
  useSubmitProviderApplication,
} from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

/**
 * Provider application status screen — Phase 1 micro-checkpoint 3.
 *
 * Reads the server-authoritative status view from GET /providers/application/status
 * (published in MC2). All action visibility and next-step copy is derived from
 * server-provided fields (`nextAction`, `canReset`, `canResubmit`, `canEdit`);
 * the client never duplicates that authorization logic. The provider-visible
 * `rejectionReason` and public `previousSubmissions` summary are surfaced only
 * for the owner; reviewer-private notes are never rendered because they are
 * never present in the response payload.
 */

const statusHeadline: Record<string, { eyebrow: string; title: string; body: string }> = {
  draft: {
    eyebrow: 'Application status',
    title: 'Pick up where you left off',
    body: "Finish the remaining onboarding steps to send your application in for review.",
  },
  under_review: {
    eyebrow: 'Application status',
    title: 'Your application is with our review team',
    body: 'We are checking your profile and credentials so clients can book with confidence. We will update this space when there is a decision.',
  },
  approved: {
    eyebrow: 'Application status',
    title: "You're approved",
    body: 'Your provider account is active. You can accept bookings and manage clients.',
  },
  rejected: {
    eyebrow: 'Application status',
    title: 'A little more information is needed',
    body: 'Please review the reviewer notes below, reset the application to draft, update the flagged details, and resubmit when ready.',
  },
  suspended: {
    eyebrow: 'Application status',
    title: 'Your provider application is paused',
    body: 'Provider access is currently paused. Please contact support if you need help understanding the next step.',
  },
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default function ProviderApplicationStatus() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const meQuery = useGetMe();
  const meLoading = meQuery.isLoading;
  const meError = meQuery.error;
  const me = meQuery.data;

  const statusQuery = useGetProviderApplicationStatus({
    query: {
      enabled: Boolean(me?.user),
      retry: false,
      queryKey: getGetProviderApplicationStatusQueryKey(),
    },
  });
  const view = statusQuery.data?.status;

  const invalidateStatus = () =>
    queryClient.invalidateQueries({
      queryKey: getGetProviderApplicationStatusQueryKey(),
    });

  const resetMutation = useResetProviderApplication({
    mutation: { onSuccess: invalidateStatus },
  });
  const submitMutation = useSubmitProviderApplication({
    mutation: { onSuccess: invalidateStatus },
  });

  useEffect(() => {
    if (!meLoading && (meError || !me?.user)) {
      setLocation(ROUTES.login, { replace: true });
      return;
    }
    // Route out of this screen when the server-derived state says another
    // surface is the right destination. Drafts belong in the onboarding
    // funnel; approved providers belong in their portal.
    if (view?.status === 'draft') {
      setLocation(ROUTES.onboarding.provider, { replace: true });
    } else if (view?.status === 'approved') {
      setLocation(ROUTES.provider.root, { replace: true });
    }
  }, [view, me, meError, meLoading, setLocation]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (meLoading || statusQuery.isLoading) {
    return (
      <StatusShell>
        <div
          data-testid="application-status-loading"
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading application status"
        />
      </StatusShell>
    );
  }

  // ── Unauthorized (no session or /me failed) ─────────────────────────────
  if (meError || !me?.user) {
    return (
      <StatusShell>
        <p
          data-testid="application-status-unauthorized"
          className="text-sm text-muted-foreground"
        >
          Redirecting to sign in…
        </p>
      </StatusShell>
    );
  }

  // ── No application yet (owner is a provider member without a draft row) ─
  if (statusQuery.isError || !view) {
    const status = (statusQuery.error as { status?: number } | undefined)?.status;
    if (status === 404) {
      return (
        <StatusShell>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Application status
          </p>
          <h1
            data-testid="application-status-empty-title"
            className="mt-3 font-serif text-3xl font-bold text-foreground"
          >
            Start your provider application
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            You haven&apos;t started an application yet. Begin onboarding to send one in.
          </p>
          <Link
            href={ROUTES.onboarding.provider}
            data-testid="application-status-start-cta"
            className="mt-8 w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground"
          >
            Start onboarding
          </Link>
        </StatusShell>
      );
    }
    if (status === 403) {
      return (
        <StatusShell>
          <p
            data-testid="application-status-forbidden"
            className="text-sm text-muted-foreground"
          >
            You don&apos;t have access to a provider application on this account.
          </p>
          <Link
            href={ROUTES.client.discover}
            data-testid="application-status-continue-client-cta"
            className="mt-6 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Continue as a client
          </Link>
        </StatusShell>
      );
    }
    return (
      <StatusShell>
        <p
          data-testid="application-status-error"
          className="text-sm text-destructive"
        >
          We couldn&apos;t load your application status. Please try again in a moment.
        </p>
        <button
          data-testid="application-status-retry"
          type="button"
          onClick={() => statusQuery.refetch()}
          className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </StatusShell>
    );
  }

  // ── Loaded — view is present ────────────────────────────────────────────
  const copy = statusHeadline[view.status] ?? statusHeadline.under_review!;
  const isRejected = view.status === 'rejected';
  const historyCount = view.submissionCount ?? 0;
  const latest = view.latestSubmission;

  return (
    <StatusShell>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {copy.eyebrow}
      </p>
      <h1
        data-testid="application-status-title"
        className="mt-3 font-serif text-3xl font-bold text-foreground"
      >
        {copy.title}
      </h1>
      <p
        data-testid="application-status-body"
        className="mt-4 text-sm leading-6 text-muted-foreground"
      >
        {copy.body}
      </p>

      {/* Current status card */}
      <div className="mt-8 w-full rounded-2xl border border-border bg-card p-5 text-left">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Current status</span>
          <span
            data-testid="application-status-pill"
            className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground"
          >
            {view.status.replace('_', ' ')}
          </span>
        </div>
        {view.submittedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Submitted:</span>{' '}
            <span data-testid="application-status-submitted-at">
              {formatDateTime(view.submittedAt)}
            </span>
          </p>
        )}
        {view.reviewedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Reviewed:</span>{' '}
            <span data-testid="application-status-reviewed-at">
              {formatDateTime(view.reviewedAt)}
            </span>
          </p>
        )}
      </div>

      {/* Rejection reason (owner-visible; reviewerNotes never appears) */}
      {isRejected && view.rejectionReason && (
        <div
          data-testid="application-status-rejection-card"
          className="mt-6 w-full rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-left"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-destructive">
            Reviewer feedback
          </p>
          <p
            data-testid="application-status-rejection-reason"
            className="mt-2 text-sm leading-6 text-foreground"
          >
            {view.rejectionReason}
          </p>
        </div>
      )}

      {/* Submission history summary (public snapshot fields only) */}
      {historyCount > 0 && (
        <div
          data-testid="application-status-history-card"
          className="mt-6 w-full rounded-2xl border border-border bg-card p-5 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Prior submissions</span>
            <span
              data-testid="application-status-history-count"
              className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
            >
              {historyCount}
            </span>
          </div>
          {latest && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Latest outcome:</span>{' '}
                <span
                  data-testid="application-status-latest-outcome"
                  className="capitalize"
                >
                  {latest.outcome}
                </span>
              </p>
              {latest.submittedAt && (
                <p>
                  <span className="font-semibold text-foreground">Submitted:</span>{' '}
                  <span data-testid="application-status-latest-submitted-at">
                    {formatDateTime(latest.submittedAt)}
                  </span>
                </p>
              )}
              {latest.rejectionReason && (
                <p data-testid="application-status-latest-rejection-reason">
                  <span className="font-semibold text-foreground">Feedback:</span>{' '}
                  {latest.rejectionReason}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action row — every action is server-gated */}
      <div className="mt-8 flex w-full flex-col gap-3">
        {view.canReset && (
          <button
            data-testid="application-status-reset-cta"
            type="button"
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground disabled:opacity-60"
          >
            {resetMutation.isPending ? 'Resetting…' : 'Reset to draft'}
          </button>
        )}
        {view.canResubmit && (
          <button
            data-testid="application-status-resubmit-cta"
            type="button"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitMutation.isPending ? 'Sending…' : 'Submit for review'}
          </button>
        )}
        {view.canEdit && (
          <Link
            href={ROUTES.onboarding.provider}
            data-testid="application-status-edit-cta"
            className="w-full rounded-xl border border-border px-4 py-3 text-center font-semibold text-foreground"
          >
            Continue editing
          </Link>
        )}
        <Link
          href={ROUTES.client.discover}
          data-testid="application-status-continue-client-cta"
          className="mt-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Continue as a client
        </Link>
      </div>

      {(resetMutation.isError || submitMutation.isError) && (
        <p
          data-testid="application-status-mutation-error"
          className="mt-4 text-xs text-destructive"
        >
          Something went wrong. Please try again in a moment.
        </p>
      )}
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-testid="application-status-page"
      className="min-h-[100dvh] bg-background px-6 py-12"
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
          O
        </div>
        {children}
      </div>
    </main>
  );
}
