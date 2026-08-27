/**
 * Provider Approval Status & Activation Hub — /provider/application-status.
 *
 * The single provider-facing answer to "what is happening, what have I
 * completed, what's stopping bookings, and what should I do next". Composes
 * the owner-scoped GET /providers/me/activation-status summary (readable in
 * every application state) with the existing status view (submission history,
 * server-gated reset/resubmit) and the existing BookingPageCard
 * publish/share/preview/QR tools. All state, capability flags, and milestone
 * truth come from the server; this page renders them and never invents
 * progress, approval claims, or demand.
 *
 * Reviewer-private notes, raw document references, platform pilot metrics,
 * retention intent, and risk flags are never present in the consumed payloads.
 */
import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetProviderApplicationStatusQueryKey,
  getGetMyProviderActivationStatusQueryKey,
  useGetMe,
  useGetMyProviderActivationStatus,
  useGetProviderApplicationStatus,
  useResetProviderApplication,
  useSubmitProviderApplication,
} from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';
import { SubmissionHistoryTimeline } from '@/components/submission-history-timeline';
import BookingPageCard from '@/components/booking-page-card';
import ActivationHero from '@/components/activation-hub/activation-hero';
import ActivationChecklist from '@/components/activation-hub/activation-checklist';
import VerificationCard from '@/components/activation-hub/verification-card';
import BookingReadinessCards from '@/components/activation-hub/booking-readiness-cards';
import { HelpSection, ValueSection } from '@/components/activation-hub/hub-info-sections';

export default function ProviderApplicationStatus() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const meQuery = useGetMe();
  const me = meQuery.data;

  const activationQuery = useGetMyProviderActivationStatus({
    query: {
      enabled: Boolean(me?.user),
      retry: false,
      queryKey: getGetMyProviderActivationStatusQueryKey(),
    },
  });
  const activation = activationQuery.data?.activation;

  // Existing status view: submission history + server-gated recovery actions.
  const statusQuery = useGetProviderApplicationStatus({
    query: {
      enabled: Boolean(me?.user),
      retry: false,
      queryKey: getGetProviderApplicationStatusQueryKey(),
    },
  });
  const view = statusQuery.data?.status;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetProviderApplicationStatusQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMyProviderActivationStatusQueryKey() });
  };
  const resetMutation = useResetProviderApplication({ mutation: { onSuccess: invalidate } });
  const submitMutation = useSubmitProviderApplication({ mutation: { onSuccess: invalidate } });

  useEffect(() => {
    if (!meQuery.isLoading && (meQuery.error || !me?.user)) {
      setLocation(ROUTES.login, { replace: true });
    }
  }, [me, meQuery.error, meQuery.isLoading, setLocation]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (meQuery.isLoading || activationQuery.isLoading) {
    return (
      <HubShell>
        <div
          data-testid="activation-hub-loading"
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading your application status"
        />
      </HubShell>
    );
  }

  // ── Unauthorized (no session or /me failed) ─────────────────────────────
  if (meQuery.error || !me?.user) {
    return (
      <HubShell>
        <p data-testid="activation-hub-unauthorized" className="text-sm text-muted-foreground">
          Redirecting to sign in…
        </p>
      </HubShell>
    );
  }

  // ── Error / empty states ─────────────────────────────────────────────────
  if (activationQuery.isError || !activation) {
    const status = (activationQuery.error as { status?: number } | undefined)?.status;
    if (status === 404) {
      return (
        <HubShell>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Application status
          </p>
          <h1 data-testid="activation-hub-empty-title" className="mt-3 font-serif text-3xl font-bold text-foreground">
            Start your provider application
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            You haven&apos;t started an application yet. Begin onboarding to send one in.
          </p>
          <Link
            href={ROUTES.onboarding.provider}
            data-testid="activation-hub-start-cta"
            className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            Start onboarding
          </Link>
        </HubShell>
      );
    }
    if (status === 403) {
      return (
        <HubShell>
          <p data-testid="activation-hub-forbidden" className="text-sm text-muted-foreground">
            You don&apos;t have access to a provider application on this account.
          </p>
          <Link
            href={ROUTES.client.discover}
            data-testid="activation-hub-continue-client-cta"
            className="mt-6 inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Continue as a client
          </Link>
        </HubShell>
      );
    }
    return (
      <HubShell>
        <p data-testid="activation-hub-error" className="text-sm text-destructive" role="alert">
          We couldn&apos;t load your application status. Please try again in a moment.
        </p>
        <button
          data-testid="activation-hub-retry"
          type="button"
          onClick={() => activationQuery.refetch()}
          className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </HubShell>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────────────────
  const isRejected = activation.applicationStatus === 'rejected';

  return (
    <HubShell>
      <ActivationHero firstName={me.user.firstName} activation={activation} />

      {/* Rejected-application recovery (provider-visible reason only) */}
      {isRejected && (
        <section
          id="activation-feedback"
          aria-labelledby="activation-feedback-heading"
          data-testid="activation-feedback"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5"
        >
          <h2 id="activation-feedback-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-destructive">
            Reviewer feedback
          </h2>
          <p data-testid="activation-rejection-reason" className="mt-2 text-sm leading-6 text-foreground">
            {activation.rejectionReason ??
              "We need a small update before we can complete your review. Contact support and we'll help you continue."}
          </p>
        </section>
      )}

      {/* Server-gated recovery actions (same mutations as before) */}
      {(activation.canReset || activation.canResubmit) && (
        <div className="flex flex-col gap-3 sm:flex-row" data-testid="activation-actions">
          {activation.canReset && (
            <button
              data-testid="activation-reset-cta"
              type="button"
              disabled={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {resetMutation.isPending ? 'Resetting…' : 'Reset to draft'}
            </button>
          )}
          {activation.canResubmit && (
            <button
              data-testid="activation-resubmit-cta"
              type="button"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitMutation.isPending ? 'Sending…' : 'Submit for review'}
            </button>
          )}
        </div>
      )}
      {(resetMutation.isError || submitMutation.isError) && (
        <p data-testid="activation-mutation-error" role="alert" className="text-xs text-destructive">
          Something went wrong. Please try again in a moment.
        </p>
      )}

      <ActivationChecklist activation={activation} />
      <VerificationCard activation={activation} />
      <BookingReadinessCards activation={activation} />

      {/* Booking page: publish, preview, copy, native share, QR (existing card) */}
      <section
        id="activation-booking-page"
        aria-labelledby="activation-booking-page-heading"
        data-testid="activation-booking-page"
      >
        <h2 id="activation-booking-page-heading" className="font-serif text-xl font-bold text-foreground">
          Share and grow
        </h2>
        <p className="mt-1.5 mb-3 text-sm text-muted-foreground" data-testid="activation-share-copy">
          {activation.milestones.bookingPagePublished
            ? 'Your booking page is live. Share one link with clients so they can see your services, confirm their area, and book available times.'
            : "Once your page is ready, you'll have one professional booking link to share by text, social profile, QR code, email, or your website."}
        </p>
        <BookingPageCard />
      </section>

      <ValueSection />

      {/* Submission history (existing timeline; provider-visible snapshots only) */}
      {view && <SubmissionHistoryTimeline currentView={view} />}

      <HelpSection />

      <div className="text-center">
        <Link
          href={ROUTES.client.discover}
          data-testid="activation-continue-client-cta"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Continue as a client
        </Link>
      </div>
    </HubShell>
  );
}

function HubShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-testid="activation-hub-page"
      className="min-h-[100dvh] bg-background px-4 py-10 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
          O
        </div>
        {children}
      </div>
    </main>
  );
}
