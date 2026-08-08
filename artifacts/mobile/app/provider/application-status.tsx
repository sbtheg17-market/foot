import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetProviderApplicationStatusQueryKey,
  useGetProviderApplicationStatus,
  useResetProviderApplication,
  useSubmitProviderApplication,
} from '@workspace/api-client-react';
import { useAuth } from '@/context/auth';
import { useColors } from '@/hooks/useColors';
import { SubmissionHistoryTimeline } from '@/components/submission-history-timeline';

/**
 * Provider application status screen — Phase 1 micro-checkpoint 4 (mobile).
 *
 * Mobile parity for the web MC3 experience. Reads the server-authoritative
 * status view from `GET /providers/application/status` and derives every
 * action's visibility strictly from server-provided fields
 * (`canReset`, `canResubmit`, `canEdit`). The client never duplicates
 * authorization logic. The provider-visible `rejectionReason` and public
 * `previousSubmissions` snapshot are surfaced only for the owner;
 * reviewer-private notes are never rendered because they are never present
 * in the response payload.
 */

const statusCopy: Record<
  string,
  { eyebrow: string; title: string; body: string }
> = {
  draft: {
    eyebrow: 'APPLICATION STATUS',
    title: 'Pick up where you left off',
    body: 'Finish the remaining onboarding steps to send your application in for review.',
  },
  under_review: {
    eyebrow: 'APPLICATION STATUS',
    title: 'Your application is with our review team',
    body: 'We are checking your profile and credentials so clients can book with confidence. We will update this space when there is a decision.',
  },
  approved: {
    eyebrow: 'APPLICATION STATUS',
    title: "You're approved",
    body: 'Your provider account is active. You can accept bookings and manage clients.',
  },
  rejected: {
    eyebrow: 'APPLICATION STATUS',
    title: 'A little more information is needed',
    body: 'Please review the reviewer feedback below, reset the application to draft, update the flagged details, and resubmit when ready.',
  },
  suspended: {
    eyebrow: 'APPLICATION STATUS',
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

function errorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | undefined)?.status;
}

export default function ProviderApplicationStatusScreen() {
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useGetProviderApplicationStatus({
    query: {
      enabled: Boolean(user),
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
    if (!authLoading && !user) {
      router.replace('/auth/login');
      return;
    }
    // Route out of this screen when the server-derived state says another
    // surface is the right destination. Drafts belong in the onboarding
    // funnel; approved providers belong in the provider tabs.
    if (view?.status === 'draft') {
      router.replace('/onboarding/provider');
    } else if (view?.status === 'approved') {
      router.replace('/(tabs)/account');
    }
  }, [authLoading, user, view?.status]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (authLoading || statusQuery.isLoading) {
    return (
      <View
        testID="application-status-loading"
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Unauthorized (no session) ────────────────────────────────────────────
  if (!user) {
    return (
      <Shell colors={colors}>
        <Text
          testID="application-status-unauthorized"
          style={[styles.body, { color: colors.mutedForeground }]}
        >
          Redirecting to sign in…
        </Text>
      </Shell>
    );
  }

  // ── Error / empty branches (401 → redirect above; 404, 403, generic) ────
  if (statusQuery.isError || !view) {
    const status = errorStatus(statusQuery.error);

    if (status === 404) {
      return (
        <Shell colors={colors}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            APPLICATION STATUS
          </Text>
          <Text
            testID="application-status-empty-title"
            style={[styles.title, { color: colors.foreground }]}
          >
            Start your provider application
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            You haven&apos;t started an application yet. Begin onboarding to
            send one in.
          </Text>
          <TouchableOpacity
            testID="application-status-start-cta"
            onPress={() => router.replace('/onboarding/provider')}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.buttonText}>Start onboarding</Text>
          </TouchableOpacity>
        </Shell>
      );
    }

    if (status === 403) {
      return (
        <Shell colors={colors}>
          <Text
            testID="application-status-forbidden"
            style={[styles.body, { color: colors.mutedForeground }]}
          >
            You don&apos;t have access to a provider application on this
            account.
          </Text>
          <TouchableOpacity
            testID="application-status-continue-client-cta"
            onPress={() => router.replace('/(tabs)')}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Continue as a client
            </Text>
          </TouchableOpacity>
        </Shell>
      );
    }

    return (
      <Shell colors={colors}>
        <Text
          testID="application-status-error"
          style={[styles.body, { color: colors.destructive }]}
        >
          We couldn&apos;t load your application status. Please try again in a
          moment.
        </Text>
        <TouchableOpacity
          testID="application-status-retry"
          onPress={() => statusQuery.refetch()}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
            Try again
          </Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  // ── Loaded — view is present ─────────────────────────────────────────────
  const copy = statusCopy[view.status] ?? statusCopy.under_review!;
  const isRejected = view.status === 'rejected';

  return (
    <ScrollView
      testID="application-status-page"
      contentContainerStyle={[
        styles.scrollContent,
        { backgroundColor: colors.background },
      ]}
      style={{ backgroundColor: colors.background }}
    >
      <View style={[styles.logo, { backgroundColor: colors.primary }]}>
        <Text style={styles.logoText}>O</Text>
      </View>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        {copy.eyebrow}
      </Text>
      <Text
        testID="application-status-title"
        style={[styles.title, { color: colors.foreground }]}
      >
        {copy.title}
      </Text>
      <Text
        testID="application-status-body"
        style={[styles.body, { color: colors.mutedForeground }]}
      >
        {copy.body}
      </Text>

      {/* Current status card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.foreground }]}>
            Current status
          </Text>
          <Text
            testID="application-status-pill"
            style={[
              styles.badge,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
              },
            ]}
          >
            {view.status.replace('_', ' ')}
          </Text>
        </View>
        {view.submittedAt && (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            <Text style={[styles.metaLabel, { color: colors.foreground }]}>
              Submitted:{' '}
            </Text>
            <Text testID="application-status-submitted-at">
              {formatDateTime(view.submittedAt)}
            </Text>
          </Text>
        )}
        {view.reviewedAt && (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            <Text style={[styles.metaLabel, { color: colors.foreground }]}>
              Reviewed:{' '}
            </Text>
            <Text testID="application-status-reviewed-at">
              {formatDateTime(view.reviewedAt)}
            </Text>
          </Text>
        )}
      </View>

      {/* Rejection reason (owner-visible; reviewerNotes never appears) */}
      {isRejected && view.rejectionReason && (
        <View
          testID="application-status-rejection-card"
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.destructive,
            },
          ]}
        >
          <Text
            style={[styles.rejectionEyebrow, { color: colors.destructive }]}
          >
            REVIEWER FEEDBACK
          </Text>
          <Text
            testID="application-status-rejection-reason"
            style={[styles.rejectionBody, { color: colors.foreground }]}
          >
            {view.rejectionReason}
          </Text>
        </View>
      )}

      {/* Submission history timeline (MC7) — current status + prior closed
          rejected cycles, keyset-paginated. Public snapshot fields only. */}
      <SubmissionHistoryTimeline currentView={view} />

      {/* Action row — every action is server-gated */}
      <View style={styles.actionColumn}>
        {view.canReset && (
          <TouchableOpacity
            testID="application-status-reset-cta"
            disabled={resetMutation.isPending}
            onPress={() => resetMutation.mutate()}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: resetMutation.isPending ? 0.6 : 1,
              },
            ]}
          >
            <Text style={styles.buttonText}>
              {resetMutation.isPending ? 'Resetting…' : 'Reset to draft'}
            </Text>
          </TouchableOpacity>
        )}
        {view.canResubmit && (
          <TouchableOpacity
            testID="application-status-resubmit-cta"
            disabled={submitMutation.isPending}
            onPress={() => submitMutation.mutate()}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: submitMutation.isPending ? 0.6 : 1,
              },
            ]}
          >
            <Text style={styles.buttonText}>
              {submitMutation.isPending ? 'Sending…' : 'Submit for review'}
            </Text>
          </TouchableOpacity>
        )}
        {view.canEdit && (
          <TouchableOpacity
            testID="application-status-edit-cta"
            onPress={() => router.replace('/onboarding/provider')}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Continue editing
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="application-status-continue-client-cta"
          onPress={() => router.replace('/(tabs)')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
            Continue as a client
          </Text>
        </TouchableOpacity>
      </View>

      {(resetMutation.isError || submitMutation.isError) && (
        <Text
          testID="application-status-mutation-error"
          style={[styles.mutationError, { color: colors.destructive }]}
        >
          Something went wrong. Please try again in a moment.
        </Text>
      )}
    </ScrollView>
  );
}

function Shell({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}>
        <Text style={styles.logoText}>O</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 78,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 78,
    paddingBottom: 48,
    flexGrow: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 30 },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 26,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  metaLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  metaLabel: { fontFamily: 'Inter_600SemiBold' },
  capitalize: { textTransform: 'capitalize' },
  rejectionEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  rejectionBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  historyList: { marginTop: 4 },
  actionColumn: {
    width: '100%',
    marginTop: 26,
    gap: 12,
  },
  button: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  linkButton: { paddingVertical: 14, alignItems: 'center' },
  linkText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  mutationError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
  },
});
