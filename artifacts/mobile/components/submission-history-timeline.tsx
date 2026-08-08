import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getProviderApplicationSubmissions,
  type GetProviderApplicationSubmissionsParams,
  type ProviderApplicationPreviousSubmission,
  type ProviderApplicationStatusView,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

/**
 * Phase 2 MC7 — mobile submission-history timeline (Expo/React Native).
 *
 * Mobile parity for the web MC6 surface. Consumes the published MC5 endpoint
 * GET /providers/application/submissions via the generated client. API order
 * is newest-first with an opaque keyset cursor (`pagination.nextCursor` /
 * `pagination.hasMore`); pages accumulate behind a "Load older cycles" action.
 * The list renders oldest-to-newest, with a final node for the current open
 * cycle taken from the server `summary` (passed in as `currentView`, identical
 * to GET /providers/application/status).
 *
 * Honesty: history holds only closed *rejected* cycles snapshotted at reset;
 * the current open cycle is the summary node, not a history row. This is not a
 * complete persisted lifecycle event log, and the caption says so.
 *
 * Privacy: only the six public fields are read. `reviewerNotes` / `reviewedBy`
 * are never referenced.
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
  const colors = useColors();

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

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.border },
  ];

  // ── Loading (initial) ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View testID="submission-timeline" style={cardStyle}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Submission timeline
        </Text>
        <View
          testID="submission-timeline-loading"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading submission history"
          style={styles.loadingRow}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  // ── Error (initial load failed) ──────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View testID="submission-timeline" style={cardStyle}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Submission timeline
        </Text>
        {accessDenied ? (
          <Text
            testID="submission-timeline-unauthorized"
            style={[styles.body, { color: colors.mutedForeground }]}
          >
            You don&apos;t have access to this application&apos;s history.
          </Text>
        ) : (
          <>
            <Text
              testID="submission-timeline-error"
              style={[styles.body, { color: colors.destructive }]}
            >
              We couldn&apos;t load your submission history. Please try again in
              a moment.
            </Text>
            <TouchableOpacity
              testID="submission-timeline-retry"
              accessibilityRole="button"
              onPress={() => void loadInitial()}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.foreground }]}
              >
                Try again
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────
  // API order is newest-first; render oldest-to-newest so the timeline reads
  // top (oldest) → bottom (newest current cycle).
  const chronological = [...cycles].reverse();
  const hasPrior = chronological.length > 0;

  return (
    <View testID="submission-timeline" style={cardStyle}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Submission timeline
        </Text>
        <Text
          testID="submission-timeline-count"
          style={[
            styles.badge,
            { backgroundColor: colors.secondary, color: colors.foreground },
          ]}
        >
          {currentView.submissionCount} prior
        </Text>
      </View>

      {!hasPrior && (
        <Text
          testID="submission-timeline-empty"
          style={[styles.body, { color: colors.mutedForeground }]}
        >
          No earlier submission cycles yet. Your current application status is
          shown below.
        </Text>
      )}

      <View style={styles.list}>
        {hasMore && (
          <View style={styles.loadMoreRow}>
            <TouchableOpacity
              testID="submission-timeline-load-more"
              accessibilityRole="button"
              disabled={loadingMore}
              onPress={() => void onLoadMore()}
              style={[
                styles.secondaryButton,
                { borderColor: colors.border, opacity: loadingMore ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.foreground }]}
              >
                {loadingMore ? 'Loading…' : 'Load older cycles'}
              </Text>
            </TouchableOpacity>
            {pageError && (
              <Text
                testID="submission-timeline-page-error"
                style={[styles.pageError, { color: colors.destructive }]}
              >
                Couldn&apos;t load older cycles. Please try again.
              </Text>
            )}
          </View>
        )}

        {chronological.map((cycle) => (
          <TimelineNode
            key={cycle.id}
            colors={colors}
            testID={`submission-timeline-node-${cycle.id}`}
            tone="rejected"
            label="Application rejected"
            pillLabel={cycle.outcome}
            primaryDateLabel="Submitted"
            primaryDate={cycle.submittedAt}
            secondaryDateLabel="Reviewed"
            secondaryDate={cycle.reviewedAt}
            reason={cycle.rejectionReason}
            reasonTestID={`submission-timeline-reason-${cycle.id}`}
          />
        ))}

        {/* Current open cycle — from the server summary, not a history row. */}
        <TimelineNode
          colors={colors}
          testID="submission-timeline-current-node"
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
          reasonTestID="submission-timeline-current-reason"
          isLast
        />
      </View>

      <Text
        testID="submission-timeline-honesty-note"
        style={[
          styles.honesty,
          { color: colors.mutedForeground, borderTopColor: colors.border },
        ]}
      >
        This timeline shows your current application status plus prior closed
        rejection cycles. It is not a complete record of every step your
        application went through.
      </Text>
    </View>
  );
}

function TimelineNode({
  colors,
  testID,
  tone,
  label,
  pillLabel,
  primaryDateLabel,
  primaryDate,
  secondaryDateLabel,
  secondaryDate,
  reason,
  reasonTestID,
  isLast = false,
}: {
  colors: ReturnType<typeof useColors>;
  testID: string;
  tone: 'rejected' | 'current';
  label: string;
  pillLabel: string;
  primaryDateLabel: string;
  primaryDate: string | null;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  reason: string | null;
  reasonTestID: string;
  isLast?: boolean;
}) {
  const dotColor = tone === 'current' ? colors.primary : colors.destructive;
  return (
    <View testID={testID} style={styles.node}>
      {/* Rail + dot */}
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && (
          <View style={[styles.railLine, { backgroundColor: colors.border }]} />
        )}
      </View>

      <View style={styles.nodeBody}>
        <View style={styles.nodeHeader}>
          <Text style={[styles.nodeLabel, { color: colors.foreground }]}>
            {label}
          </Text>
          <Text
            style={[
              styles.badge,
              tone === 'current'
                ? { backgroundColor: colors.secondary, color: colors.foreground }
                : { backgroundColor: '#FDECEC', color: colors.destructive },
            ]}
          >
            {pillLabel}
          </Text>
        </View>

        {primaryDate && (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            <Text style={[styles.metaLabel, { color: colors.foreground }]}>
              {primaryDateLabel}:{' '}
            </Text>
            {formatDateTime(primaryDate)}
          </Text>
        )}
        {secondaryDate && (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            <Text style={[styles.metaLabel, { color: colors.foreground }]}>
              {secondaryDateLabel}:{' '}
            </Text>
            {formatDateTime(secondaryDate)}
          </Text>
        )}

        {reason && (
          <View
            style={[styles.reasonBox, { borderColor: colors.destructive }]}
          >
            <Text style={[styles.reasonEyebrow, { color: colors.destructive }]}>
              REVIEWER FEEDBACK
            </Text>
            <Text
              testID={reasonTestID}
              style={[styles.reasonBody, { color: colors.foreground }]}
            >
              {reason}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 26,
  },
  heading: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  loadingRow: { marginTop: 16, alignItems: 'flex-start' },
  list: { marginTop: 18 },
  loadMoreRow: { marginBottom: 16, alignItems: 'flex-start' },
  node: { flexDirection: 'row', gap: 14, paddingBottom: 22 },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  railLine: { width: 1, flex: 1, marginTop: 4 },
  nodeBody: { flex: 1 },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  nodeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  metaLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  metaLabel: { fontFamily: 'Inter_600SemiBold' },
  reasonBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  reasonEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  reasonBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pageError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
  honesty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});
