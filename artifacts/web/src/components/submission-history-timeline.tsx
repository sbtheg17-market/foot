import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getProviderApplicationSubmissions,
  type GetProviderApplicationSubmissionsParams,
  type ProviderApplicationPreviousSubmission,
  type ProviderApplicationStatusView,
} from '@workspace/api-client-react';

/**
 * Phase 2 MC6 — web submission-history timeline.
 *
 * Consumes the published MC5 endpoint GET /providers/application/submissions.
 * The endpoint returns closed submission cycles newest-first with an opaque
 * keyset cursor (`pagination.nextCursor` / `pagination.hasMore`). This surface
 * accumulates pages (oldest cycles load "above" newer ones) and renders a
 * chronological, oldest-to-newest timeline whose final node is the current
 * open application cycle taken from the server `summary` (passed in as
 * `currentView`, identical to GET /providers/application/status).
 *
 * Honesty: the history holds only closed *rejected* cycles snapshotted at
 * reset. The current open cycle is the summary node — it is not a history row.
 * This is not a complete persisted lifecycle event log, and the caption says so.
 *
 * Privacy: only the six public fields returned by the endpoint are read. No
 * `reviewerNotes` / `reviewedBy` are referenced anywhere.
 */

const PAGE_SIZE = 5;

type Phase = 'loading' | 'ready' | 'error';

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

function errorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | undefined)?.status;
}

export function SubmissionHistoryTimeline({
  currentView,
}: {
  currentView: ProviderApplicationStatusView;
}) {
  // Accumulated cycles in API order (newest-first) across loaded pages.
  const [cycles, setCycles] = useState<ProviderApplicationPreviousSubmission[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const requestedInitial = useRef(false);

  const loadPage = useCallback(async (cursor: string | null) => {
    const params: GetProviderApplicationSubmissionsParams = {
      limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    };
    const res = await getProviderApplicationSubmissions(params);
    setCycles((prev) =>
      cursor ? [...prev, ...res.submissions] : res.submissions,
    );
    setHasMore(res.pagination.hasMore);
    setNextCursor(res.pagination.nextCursor);
  }, []);

  const loadInitial = useCallback(async () => {
    setPhase('loading');
    setAccessDenied(false);
    try {
      await loadPage(null);
      setPhase('ready');
    } catch (err) {
      const status = errorStatus(err);
      if (status === 401 || status === 403) setAccessDenied(true);
      setPhase('error');
    }
  }, [loadPage]);

  useEffect(() => {
    if (requestedInitial.current) return;
    requestedInitial.current = true;
    void loadInitial();
  }, [loadInitial]);

  const onLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPageError(false);
    try {
      await loadPage(nextCursor);
    } catch {
      setPageError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loadPage]);

  // ── Loading (initial) ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <section
        data-testid="submission-timeline"
        aria-label="Submission history"
        className="mt-6 w-full rounded-2xl border border-border bg-card p-5 text-left"
      >
        <TimelineHeading />
        <div
          data-testid="submission-timeline-loading"
          role="status"
          aria-label="Loading submission history"
          className="mt-4 space-y-3"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      </section>
    );
  }

  // ── Error (initial load failed) ──────────────────────────────────────────
  if (phase === 'error') {
    return (
      <section
        data-testid="submission-timeline"
        aria-label="Submission history"
        className="mt-6 w-full rounded-2xl border border-border bg-card p-5 text-left"
      >
        <TimelineHeading />
        {accessDenied ? (
          <p
            data-testid="submission-timeline-unauthorized"
            className="mt-4 text-sm text-muted-foreground"
          >
            You don&apos;t have access to this application&apos;s history.
          </p>
        ) : (
          <>
            <p
              data-testid="submission-timeline-error"
              className="mt-4 text-sm text-destructive"
            >
              We couldn&apos;t load your submission history. Please try again in a moment.
            </p>
            <button
              type="button"
              data-testid="submission-timeline-retry"
              onClick={() => void loadInitial()}
              className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Try again
            </button>
          </>
        )}
      </section>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────
  // API order is newest-first; render oldest-to-newest so the timeline reads
  // top (oldest) → bottom (newest current cycle).
  const chronological = [...cycles].reverse();
  const hasPrior = chronological.length > 0;

  return (
    <section
      data-testid="submission-timeline"
      aria-label="Submission history"
      className="mt-6 w-full rounded-2xl border border-border bg-card p-5 text-left"
    >
      <div className="flex items-center justify-between">
        <TimelineHeading />
        <span
          data-testid="submission-timeline-count"
          className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
        >
          {currentView.submissionCount} prior
        </span>
      </div>

      {!hasPrior && (
        <p
          data-testid="submission-timeline-empty"
          className="mt-4 text-sm leading-6 text-muted-foreground"
        >
          No earlier submission cycles yet. Your current application status is shown below.
        </p>
      )}

      <ol className="mt-5 space-y-0" data-testid="submission-timeline-list">
        {hasMore && (
          <li className="pb-4">
            <button
              type="button"
              data-testid="submission-timeline-load-more"
              disabled={loadingMore}
              onClick={() => void onLoadMore()}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load older cycles'}
            </button>
            {pageError && (
              <p
                data-testid="submission-timeline-page-error"
                className="mt-2 text-xs text-destructive"
              >
                Couldn&apos;t load older cycles. Please try again.
              </p>
            )}
          </li>
        )}

        {chronological.map((cycle) => (
          <TimelineNode
            key={cycle.id}
            testid={`submission-timeline-node-${cycle.id}`}
            tone="rejected"
            label="Application rejected"
            pillLabel={cycle.outcome}
            primaryDateLabel="Submitted"
            primaryDate={cycle.submittedAt}
            secondaryDateLabel="Reviewed"
            secondaryDate={cycle.reviewedAt}
            reason={cycle.rejectionReason}
            reasonTestid={`submission-timeline-reason-${cycle.id}`}
          />
        ))}

        {/* Current open cycle — from the server summary, not a history row. */}
        <TimelineNode
          testid="submission-timeline-current-node"
          tone="current"
          label="Current application"
          pillLabel={currentView.status.replace('_', ' ')}
          primaryDateLabel="Submitted"
          primaryDate={currentView.submittedAt}
          secondaryDateLabel="Reviewed"
          secondaryDate={currentView.reviewedAt}
          reason={
            currentView.status === 'rejected' ? currentView.rejectionReason : null
          }
          reasonTestid="submission-timeline-current-reason"
          isLast
        />
      </ol>

      <p
        data-testid="submission-timeline-honesty-note"
        className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground"
      >
        This timeline shows your current application status plus prior closed
        rejection cycles. It is not a complete record of every step your
        application went through.
      </p>
    </section>
  );
}

function TimelineHeading() {
  return (
    <span className="font-semibold text-foreground">Submission timeline</span>
  );
}

function TimelineNode({
  testid,
  tone,
  label,
  pillLabel,
  primaryDateLabel,
  primaryDate,
  secondaryDateLabel,
  secondaryDate,
  reason,
  reasonTestid,
  isLast = false,
}: {
  testid: string;
  tone: 'rejected' | 'current';
  label: string;
  pillLabel: string;
  primaryDateLabel: string;
  primaryDate: string | null;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  reason: string | null;
  reasonTestid: string;
  isLast?: boolean;
}) {
  const dotClass =
    tone === 'current'
      ? 'bg-primary ring-4 ring-primary/15'
      : 'bg-destructive ring-4 ring-destructive/15';
  return (
    <li data-testid={testid} className="relative flex gap-4 pb-6 last:pb-0">
      {/* Rail + dot */}
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClass}`} />
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              tone === 'current'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {pillLabel}
          </span>
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {primaryDate && (
            <p>
              <span className="font-semibold text-foreground">{primaryDateLabel}:</span>{' '}
              {formatDateTime(primaryDate)}
            </p>
          )}
          {secondaryDate && (
            <p>
              <span className="font-semibold text-foreground">{secondaryDateLabel}:</span>{' '}
              {formatDateTime(secondaryDate)}
            </p>
          )}
        </div>

        {reason && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-destructive">
              Reviewer feedback
            </p>
            <p data-testid={reasonTestid} className="mt-1 text-sm leading-6 text-foreground">
              {reason}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
