/**
 * Provider activation readiness — canonical page (/provider/readiness).
 *
 * Consumes the owner-scoped GET /providers/me/readiness contract. Server
 * C1–C7 values and reason codes are authoritative; this page only renders
 * them with centralized plain-language labels and fix links.
 */
import React from 'react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { AlertCircle, LogIn, ShieldCheck, PartyPopper, ListChecks, Eye } from 'lucide-react';
import { useGetMyProviderReadiness } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import ReadinessChecklist from '@/components/readiness-checklist';
import { ROUTES } from '@/lib/routes';
import { httpStatusOf } from '@/hooks/use-notification-center';
import { completedCount, unresolvedCount, TOTAL_CRITERIA } from '@/lib/readiness';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-6" data-testid="readiness-page">
      {children}
    </div>
  );
}

const Header = (
  <header>
    <h1 className="text-3xl font-serif font-bold text-foreground">Readiness</h1>
    <p className="text-muted-foreground mt-1">
      Complete these steps to start accepting clients.
    </p>
  </header>
);

export default function PortalReadiness() {
  const [, setLocation] = useLocation();
  const query = useGetMyProviderReadiness();
  const errorStatus = httpStatusOf(query.error);

  // ── Loading ────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <Shell>
        {Header}
        <ul className="space-y-3" aria-hidden="true" data-testid="readiness-loading">
          {Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  // ── Error states ──────────────────────────────────────────────────
  if (query.isError) {
    if (errorStatus === 401) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="readiness-unauthorized">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LogIn /></EmptyMedia>
              <EmptyTitle>Please sign in</EmptyTitle>
              <EmptyDescription>
                Your session has expired. Sign in again to view your readiness.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setLocation(ROUTES.login)} data-testid="readiness-signin">
                Go to sign in
              </Button>
            </EmptyContent>
          </Empty>
        </Shell>
      );
    }
    if (errorStatus === 403) {
      return (
        <Shell>
          {Header}
          <Empty className="border" data-testid="readiness-forbidden">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ShieldCheck /></EmptyMedia>
              <EmptyTitle>Readiness is only available for provider accounts</EmptyTitle>
              <EmptyDescription>
                Switch to or create a provider account to complete your activation setup.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => setLocation(ROUTES.onboarding.provider)}
                data-testid="readiness-become-provider"
              >
                Become a provider
              </Button>
            </EmptyContent>
          </Empty>
        </Shell>
      );
    }
    return (
      <Shell>
        {Header}
        <Empty className="border" data-testid="readiness-error">
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
            <EmptyTitle>We couldn't load your readiness status</EmptyTitle>
            <EmptyDescription>Something went wrong. Please try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              data-testid="readiness-retry"
            >
              {query.isFetching ? 'Retrying…' : 'Try again'}
            </Button>
          </EmptyContent>
        </Empty>
      </Shell>
    );
  }

  const readiness = query.data?.readiness;

  // ── Empty (unexpectedly missing body) ──────────────────────────────────
  if (!readiness) {
    return (
      <Shell>
        {Header}
        <Empty className="border" data-testid="readiness-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ListChecks /></EmptyMedia>
            <EmptyTitle>No readiness data</EmptyTitle>
            <EmptyDescription>
              We couldn't find readiness information for your account yet.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              data-testid="readiness-empty-retry"
            >
              {query.isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </EmptyContent>
        </Empty>
      </Shell>
    );
  }

  const done = completedCount(readiness);
  const remaining = unresolvedCount(readiness);

  return (
    <Shell>
      {Header}

      {/* ── Ready banner ─────────────────────────────────────────────── */}
      {readiness.activated ? (
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4"
          data-testid="readiness-ready"
        >
          <div className="mt-0.5 bg-emerald-100 p-2 rounded-full text-emerald-700 shrink-0">
            <PartyPopper className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-lg text-emerald-900">Ready for clients</h2>
            <p className="text-sm text-emerald-800/80 mt-0.5">
              All {TOTAL_CRITERIA} requirements are complete. Clients can discover and book you.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="bg-card border border-border rounded-2xl p-5"
          data-testid="readiness-progress"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-semibold text-foreground">Setup progress</h2>
            <span className="text-sm font-bold text-foreground" data-testid="readiness-progress-count">
              {done} of {TOTAL_CRITERIA} complete
            </span>
          </div>
          <Progress
            value={(done / TOTAL_CRITERIA) * 100}
            aria-label={`Setup progress: ${done} of ${TOTAL_CRITERIA} complete`}
          />
          <p className="text-sm text-muted-foreground mt-2" data-testid="readiness-remaining">
            {remaining} step{remaining === 1 ? '' : 's'} left before clients can book you.
          </p>
        </div>
      )}

      <ReadinessChecklist readiness={readiness} />

      <Link
        href={ROUTES.provider.listingPreview}
        data-testid="readiness-listing-preview-link"
        className="flex items-center justify-center gap-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-colors"
      >
        <Eye className="w-4 h-4 text-primary" />
        Preview your listing
      </Link>
    </Shell>
  );
}
