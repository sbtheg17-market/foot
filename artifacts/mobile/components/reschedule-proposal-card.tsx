import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useListRescheduleRequests,
  useAcceptRescheduleRequest,
  useDeclineRescheduleRequest,
  useGetReschedulingHistory,
} from '@workspace/api-client-react';
import type { useColors } from '@/hooks/useColors';

interface Props {
  bookingId: number;
  /** Client sees accept/decline; the provider sees a read-only pending state. */
  isClient: boolean;
  timezone?: string;
  colors: ReturnType<typeof useColors>;
  /** Refetch the booking after a proposal is accepted/declined. */
  onChanged: () => void;
}

function formatInstant(iso: string, timezone?: string) {
  return new Date(iso).toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

/**
 * Consent-first rescheduling: shows the pending provider proposal (the
 * confirmed time stays authoritative until the client accepts) plus a compact
 * append-only history of accepted time changes.
 */
export default function RescheduleProposalCard({ bookingId, isClient, timezone, colors, onChanged }: Props) {
  const { data, isLoading, isError, refetch } = useListRescheduleRequests(bookingId, {
    query: { queryKey: ['reschedule-proposals', bookingId] },
  });
  const { data: historyData } = useGetReschedulingHistory(
    bookingId,
    { limit: 5 },
    { query: { queryKey: ['reschedule-history', bookingId] } },
  );

  const accept = useAcceptRescheduleRequest();
  const decline = useDeclineRescheduleRequest();
  const busy = accept.isPending || decline.isPending;

  const pending = data?.proposals.find((p) => p.status === 'pending');
  const history = historyData?.history ?? [];

  const afterMutation = () => {
    void refetch();
    onChanged();
  };

  const handleAccept = () => {
    if (!pending || busy) return;
    Alert.alert(
      'Accept new time?',
      `Your appointment will move to ${formatInstant(pending.proposedScheduledAt, timezone)}.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () =>
            accept.mutate(
              { requestId: pending.id },
              {
                onSuccess: () => {
                  Alert.alert('New time confirmed', 'Your appointment has been updated.');
                  afterMutation();
                },
                onError: (err: unknown) => {
                  const statusCode = (err as { status?: number }).status;
                  Alert.alert(
                    statusCode === 409 ? 'Proposal updated' : 'Could not accept',
                    statusCode === 409
                      ? 'This proposal was already resolved. Refreshing.'
                      : 'Something went wrong. Please try again.',
                  );
                  afterMutation();
                },
              },
            ),
        },
      ],
    );
  };

  const handleDecline = () => {
    if (!pending || busy) return;
    Alert.alert('Keep your current time?', 'The proposed change will be declined.', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Keep my time',
        onPress: () =>
          decline.mutate(
            { requestId: pending.id },
            {
              onSuccess: (res) => {
                Alert.alert(
                  res.originalTimeFeasible ? 'Proposal declined' : 'Original time at risk',
                  res.originalTimeFeasible
                    ? 'Your original appointment is unchanged.'
                    : res.supportMessage ??
                        'Your original time may no longer be available. Please contact support.',
                );
                afterMutation();
              },
              onError: (err: unknown) => {
                const statusCode = (err as { status?: number }).status;
                Alert.alert(
                  statusCode === 409 ? 'Proposal updated' : 'Could not decline',
                  statusCode === 409
                    ? 'This proposal was already resolved. Refreshing.'
                    : 'Something went wrong. Please try again.',
                );
                afterMutation();
              },
            },
          ),
      },
    ]);
  };

  if (isLoading) return null;
  if (isError) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="reschedule-proposal-error">
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>Could not load reschedule proposals.</Text>
        <TouchableOpacity onPress={() => void refetch()} accessibilityRole="button" accessibilityLabel="Retry loading proposals">
          <Text style={[styles.retry, { color: colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!pending && history.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      {pending && (
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}
          testID="reschedule-proposal-card"
          accessibilityLabel="Pending reschedule proposal"
        >
          <View style={styles.headerRow}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isClient ? 'Your provider proposed a new time' : 'Awaiting the client’s response'}
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.foreground }]} testID="proposal-proposed-time">
            Proposed: {formatInstant(pending.proposedScheduledAt, timezone)}
          </Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]} testID="proposal-original-time">
            Your current appointment ({formatInstant(pending.originalScheduledAt, timezone)}) stays until{' '}
            {isClient ? 'you respond' : 'the client responds'}.
          </Text>
          {pending.reason ? (
            <Text style={[styles.reason, { color: colors.mutedForeground }]} testID="proposal-reason">
              “{pending.reason}”
            </Text>
          ) : null}
          <Text style={[styles.deadline, { color: colors.foreground }]} testID="proposal-deadline">
            Respond by {formatInstant(pending.deadlineAt, timezone)} — no change happens automatically.
          </Text>
          {isClient && (
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Accept the proposed new time"
                testID="proposal-accept-button"
                style={[styles.acceptBtn, { backgroundColor: colors.primary, opacity: busy ? 0.55 : 1 }]}
              >
                {accept.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>Accept new time</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDecline}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Decline the proposal and keep the current time"
                testID="proposal-decline-button"
                style={[styles.declineBtn, { borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}
              >
                {decline.isPending ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : (
                  <Text style={[styles.declineText, { color: colors.foreground }]}>Keep my time</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {history.length > 0 && (
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="reschedule-history"
          accessibilityLabel="Rescheduling history"
        >
          <View style={styles.headerRow}>
            <Feather name="clock" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Time changes</Text>
          </View>
          {history.map((h) => (
            <Text key={h.id} style={[styles.muted, { color: colors.mutedForeground }]} testID={`history-entry-${h.id}`}>
              {h.requesterRole === 'provider' ? 'Provider' : h.requesterRole === 'client' ? 'Client' : 'Support'} moved{' '}
              {formatInstant(h.originalScheduledAt, timezone)} → {formatInstant(h.newScheduledAt, timezone)}
              {h.reason ? ` — “${h.reason}”` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 },
  body: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  muted: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  reason: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  deadline: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  declineBtn: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  declineText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  retry: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 6 },
});
