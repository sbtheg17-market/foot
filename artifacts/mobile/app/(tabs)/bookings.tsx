import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  useGetClientCareHistory,
  useGetProviderAvailability,
  useListBookings,
  useUpdateBookingStatus,
} from '@workspace/api-client-react';
import type { Booking, ClientCareHistoryEntry } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';
import { useClientBookingStatusFeedback } from '@/hooks/use-client-booking-status-feedback';

type ClientTab = 'upcoming' | 'past' | 'cancelled';
type ProviderTab = 'requested' | 'rescheduled' | 'confirmed' | 'completed' | 'cancelled';

const CLIENT_TAB_STATUSES: Record<ClientTab, string[]> = {
  upcoming: ['requested', 'confirmed', 'rescheduled'],
  past: ['completed', 'no_show'],
  cancelled: ['cancelled'],
};

const PROVIDER_TAB_STATUSES: Record<ProviderTab, string[]> = {
  requested: ['requested'],
  rescheduled: ['rescheduled'],
  confirmed: ['confirmed'],
  completed: ['completed', 'no_show'],
  cancelled: ['cancelled'],
};

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  requested:   { label: 'Pending',     bg: '#FEF3C7', text: '#92400E' },
  confirmed:   { label: 'Confirmed',   bg: '#D1FAE5', text: '#065F46' },
  rescheduled: { label: 'Rescheduled', bg: '#DBEAFE', text: '#1E40AF' },
  completed:   { label: 'Completed',   bg: '#ECFDF5', text: '#047857' },
  cancelled:   { label: 'Cancelled',   bg: '#F3F4F6', text: '#6B7280' },
  no_show:     { label: 'No Show',     bg: '#FEE2E2', text: '#991B1B' },
};

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ClientTab | ProviderTab>('upcoming');

  useEffect(() => {
    setActiveTab(user?.role === 'provider' ? 'requested' : 'upcoming');
  }, [user?.role]);

  const { data, isLoading, refetch } = useListBookings(undefined, {
    query: {
      queryKey: ['bookings'],
      enabled: user?.role === 'client' || user?.role === 'provider',
      refetchOnMount: 'always',
      refetchOnReconnect: true,
    },
  });
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useGetClientCareHistory(
    { limit: 50, offset: 0 },
    {
      query: {
        queryKey: ['client-care-history'],
        enabled: user?.role === 'client' && activeTab === 'past',
        refetchOnMount: 'always',
        refetchOnReconnect: true,
      },
    },
  );

  const updateStatus = useUpdateBookingStatus();
  const statusFeedback = useClientBookingStatusFeedback(user?.role === 'client' ? data?.bookings : undefined);
  // Authoritative marketplace timezone — same public endpoint and server
  // engine (getMarketplaceTimezone) as slot generation and booking detail.
  // The value is global on the server, so any booking's provider resolves
  // the identical timezone; one cached request covers the whole list.
  const timezoneProviderId = data?.bookings?.[0]?.providerId ?? historyData?.history?.[0]?.providerId;
  const { data: availabilityData, isError: timezoneUnavailable } = useGetProviderAvailability(
    timezoneProviderId ?? 0,
    {
      query: { enabled: !!timezoneProviderId, queryKey: ['booking-provider-availability', timezoneProviderId] },
    },
  );
  const marketplaceTimezone = availabilityData?.timezone;
  const timezoneResolving = !!timezoneProviderId && !marketplaceTimezone && !timezoneUnavailable;
  // Track which booking has a request in flight so we can disable its button.
  const [pendingId, setPendingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user?.role !== 'client' && user?.role !== 'provider') return;
      void refetch();
      if (activeTab === 'past') void refetchHistory();
    }, [activeTab, refetch, refetchHistory, user?.role]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && (user?.role === 'client' || user?.role === 'provider')) {
        void refetch();
        if (activeTab === 'past') void refetchHistory();
      }
    });

    return () => subscription.remove();
  }, [activeTab, refetch, refetchHistory, user?.role]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + 80 }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>Sign in to view bookings</Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          You need an account to book appointments.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          style={[styles.signInBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (user.role !== 'client' && user.role !== 'provider') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Feather name="briefcase" size={40} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>
          This is not an available booking space
        </Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          You’re signed in as an {user.role} account. Switch to a client or provider account to manage visits.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/account')}
          style={[styles.signInBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.signInBtnText}>Go to account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allBookings = data?.bookings ?? [];
  const isProvider = user.role === 'provider';
  const tabStatuses = isProvider
    ? PROVIDER_TAB_STATUSES[activeTab as ProviderTab] ?? PROVIDER_TAB_STATUSES.requested
    : CLIENT_TAB_STATUSES[activeTab as ClientTab] ?? CLIENT_TAB_STATUSES.upcoming;
  const filtered = allBookings.filter(b => tabStatuses.includes(b.status));
  const history = historyData?.history ?? [];
  const visibleItems: Array<Booking | ClientCareHistoryEntry> =
    !isProvider && activeTab === 'past' ? history : filtered;
  const isActiveTabLoading = !isProvider && activeTab === 'past' ? isHistoryLoading : isLoading;

  const handleCancel = (id: number) => {
    if (pendingId !== null) return; // guard against tap while another request is in flight
    const booking = allBookings.find(item => item.id === id);
    if (!booking || !['requested', 'confirmed', 'rescheduled'].includes(booking.status)) {
      Alert.alert('Booking updated', 'This booking can no longer be cancelled. Refreshing the list.');
      void refetch();
      return;
    }
    Alert.alert('Cancel booking?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => {
          setPendingId(id);
          updateStatus.mutate(
            {
              bookingId: id,
              data: { status: 'cancelled', cancellationReason: 'Cancelled by user' },
            },
            {
              onSuccess: () => {
                Alert.alert('Booking cancelled', 'The provider has been notified.');
                statusFeedback.suppressNextStatusChange(id, 'cancelled');
                void refetch();
                setPendingId(null);
              },
              onError: (err) => {
                const status = (err as { status?: number }).status;
                if (status === 409) {
                  Alert.alert('Booking already updated', 'This booking changed before cancellation completed. Refreshing.');
                } else if (status === 400 || status === 403) {
                  Alert.alert('Cannot cancel booking', 'This booking can no longer be cancelled.');
                } else {
                  Alert.alert('Could not cancel', 'Something went wrong. Please try again.');
                }
                void refetch();
                setPendingId(null);
              },
            }
          );
        },
      },
    ]);
  };

  const handleProviderStatusChange = (
    id: number,
    status: 'confirmed' | 'cancelled',
    cancellationReason?: string,
  ) => {
    if (pendingId !== null) return;
    setPendingId(id);
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
      },
      {
        onSuccess: () => {
          Alert.alert(
            status === 'confirmed' ? 'New time confirmed' : 'Reschedule declined',
            status === 'confirmed'
              ? 'The client has been notified.'
              : 'The booking was cancelled and the client has been notified.',
          );
          void refetch();
          setPendingId(null);
        },
        onError: (err) => {
          Alert.alert(
            (err as { status?: number }).status === 409
              ? 'Booking already updated'
              : 'Could not update booking',
            'This booking changed before your action completed. Refreshing.',
          );
          void refetch();
          setPendingId(null);
        },
      },
    );
  };

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const tabs: Array<{ id: ClientTab | ProviderTab; label: string }> = isProvider
    ? [
        { id: 'requested', label: 'Requests' },
        { id: 'rescheduled', label: 'Reschedules' },
        { id: 'confirmed', label: 'Upcoming' },
        { id: 'completed', label: 'Past' },
        { id: 'cancelled', label: 'Cancelled' },
      ]
    : [
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'past', label: 'Past' },
        { id: 'cancelled', label: 'Cancelled' },
      ];
  const upcomingCount = allBookings.filter(b => CLIENT_TAB_STATUSES.upcoming.includes(b.status)).length;
  const providerRescheduleCount = allBookings.filter(b => b.status === 'rescheduled').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isProvider ? 'Provider bookings' : 'My Bookings'}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.secondary, marginHorizontal: 16 }]}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && { backgroundColor: colors.card }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.foreground : colors.mutedForeground, fontFamily: activeTab === tab.id ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
              {tab.label}
              {!isProvider && tab.id === 'upcoming' && upcomingCount > 0 ? ` (${upcomingCount})` : ''}
              {isProvider && tab.id === 'rescheduled' && providerRescheduleCount > 0 ? ` (${providerRescheduleCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isActiveTabLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activeTab === 'past' && isHistoryError ? (
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>History unavailable</Text>
          <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
            We couldn’t load your care history.
          </Text>
          <TouchableOpacity
            onPress={() => void refetchHistory()}
            style={[styles.findBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.findBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<Booking | ClientCareHistoryEntry>
          data={visibleItems}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => {
            void refetch();
            if (activeTab === 'past') void refetchHistory();
          }}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="calendar" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No {activeTab} bookings</Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity onPress={() => router.push('/')} style={[styles.findBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.findBtnText}>Find a provider</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            if (isProvider) {
              return (
                <ProviderBookingCard
                  booking={item as Booking}
                  activeTab={activeTab as ProviderTab}
                  timezone={marketplaceTimezone}
                  pending={pendingId === item.id}
                  onStatusChange={handleProviderStatusChange}
                />
              );
            }
            const meta = STATUS_META[item.status] ?? STATUS_META.cancelled;
            const canCancel = ['requested', 'confirmed', 'rescheduled'].includes(item.status);
            const date = new Date(item.scheduledAt);
            // Marketplace-timezone rendering (DST-aware via Intl). While the
            // timezone is resolving a neutral placeholder is shown; on a
            // definitive failure the device-time fallback is labelled.
            const timeText = timezoneResolving
              ? '—'
              : `${date.toLocaleDateString('en-CA', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  ...(marketplaceTimezone ? { timeZone: marketplaceTimezone } : {}),
                })} at ${date.toLocaleTimeString('en-CA', {
                  hour: '2-digit',
                  minute: '2-digit',
                  ...(marketplaceTimezone
                    ? { timeZone: marketplaceTimezone, timeZoneName: 'short' as const }
                    : {}),
                })}${!marketplaceTimezone && timezoneUnavailable ? ' (device time)' : ''}`;
            const historyEntry = 'provider' in item ? item : null;
            return (
              <View style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.bookingTop}>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
                  </View>
                  {canCancel && (
                    <TouchableOpacity
                      onPress={() => handleCancel(item.id)}
                      disabled={pendingId === item.id}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ opacity: pendingId === item.id ? 0.4 : 1 }}
                    >
                      {pendingId === item.id
                        ? <ActivityIndicator size="small" color={colors.mutedForeground} />
                        : <Feather name="x" size={16} color={colors.mutedForeground} />
                      }
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.bookingRow}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text
                    style={[styles.bookingDetail, { color: colors.foreground }]}
                    testID={`booking-${item.id}-time`}
                    accessibilityLabel={
                      timezoneResolving
                        ? 'Loading appointment time'
                        : marketplaceTimezone
                          ? `${timeText}, shown in the ${marketplaceTimezone.replace(/_/g, ' ')} timezone`
                          : timeText
                    }
                  >
                    {timeText}
                  </Text>
                </View>
                {historyEntry && (
                  <>
                    <View style={styles.bookingRow}>
                      <Feather name="user" size={14} color={colors.primary} />
                      <Text style={[styles.bookingDetail, { color: colors.foreground }]} numberOfLines={1}>
                        {historyEntry.provider.firstName} {historyEntry.provider.lastName}
                      </Text>
                    </View>
                    <View style={styles.bookingRow}>
                      <Feather name="heart" size={14} color={colors.primary} />
                      <Text style={[styles.bookingDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {historyEntry.service.title}
                      </Text>
                    </View>
                  </>
                )}
                <View style={styles.bookingRow}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.bookingDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.address}, {item.city}
                  </Text>
                </View>
                {item.status === 'completed' && (
                  <TouchableOpacity onPress={() => router.push(`/booking/${item.id}`)} style={styles.reviewLink}>
                    <Text style={[styles.reviewLinkText, { color: colors.primary }]}>Leave a review →</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => router.push(`/booking/${item.id}`)}
                  style={[styles.detailsLink, { borderTopColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.detailsLinkText, { color: colors.primary }]}>View booking details</Text>
                  <Feather name="chevron-right" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function ProviderBookingCard({
  booking,
  activeTab,
  timezone,
  pending,
  onStatusChange,
}: {
  booking: Booking;
  activeTab: ProviderTab;
  timezone?: string;
  pending: boolean;
  onStatusChange: (id: number, status: 'confirmed' | 'cancelled', reason?: string) => void;
}) {
  const colors = useColors();
  const meta = STATUS_META[booking.status] ?? STATUS_META.cancelled;
  const date = new Date(booking.scheduledAt);
  const timeText = `${date.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  })} at ${date.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone, timeZoneName: 'short' as const } : {}),
  })}${timezone ? '' : ' (device time)'}`;
  const clientName = booking.clientFirstName
    ? `${booking.clientFirstName} ${booking.clientLastName ?? ''}`.trim()
    : `Client #${booking.clientId}`;

  return (
    <View style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.bookingTop}>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
        </View>
        {activeTab === 'rescheduled' && (
          <Feather name="bell" size={16} color={colors.primary} />
        )}
      </View>
      <View style={styles.bookingRow}>
        <Feather name="calendar" size={14} color={colors.primary} />
        <Text
          style={[styles.bookingDetail, { color: colors.foreground }]}
          testID={`provider-booking-${booking.id}-time`}
          accessibilityLabel={`${timeText}${timezone ? `, shown in the ${timezone.replace(/_/g, ' ')} timezone` : ''}`}
        >
          {timeText}
        </Text>
      </View>
      <View style={styles.bookingRow}>
        <Feather name="user" size={14} color={colors.primary} />
        <Text style={[styles.bookingDetail, { color: colors.foreground }]} numberOfLines={1}>
          {clientName}
        </Text>
      </View>
      {booking.clientPhone && (
        <View style={styles.bookingRow}>
          <Feather name="phone" size={14} color={colors.mutedForeground} />
          <Text style={[styles.bookingDetail, { color: colors.mutedForeground }]}>{booking.clientPhone}</Text>
        </View>
      )}
      <View style={styles.bookingRow}>
        <Feather name="map-pin" size={14} color={colors.primary} />
        <Text style={[styles.bookingDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {booking.address}, {booking.city}
        </Text>
      </View>

      {activeTab === 'rescheduled' && (
        <View style={styles.providerActions}>
          <TouchableOpacity
            onPress={() => onStatusChange(booking.id, 'confirmed')}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="Confirm new time"
            testID={`provider-booking-${booking.id}-confirm-reschedule`}
            style={[styles.providerConfirmButton, { backgroundColor: colors.primary, opacity: pending ? 0.5 : 1 }]}
          >
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.providerConfirmText}>Confirm new time</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onStatusChange(booking.id, 'cancelled', 'Reschedule declined by provider')}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="Decline reschedule"
            testID={`provider-booking-${booking.id}-decline-reschedule`}
            style={[styles.providerDeclineButton, { borderColor: colors.border, opacity: pending ? 0.5 : 1 }]}
          >
            <Text style={[styles.providerDeclineText, { color: colors.foreground }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        onPress={() => router.push(`/booking/${booking.id}`)}
        style={[styles.detailsLink, { borderTopColor: colors.border }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View booking details for ${clientName}`}
      >
        <Text style={[styles.detailsLinkText, { color: colors.primary }]}>View booking details</Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  guestTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 16 },
  guestSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 260 },
  signInBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  signInBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  findBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  findBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  bookingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bookingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookingDetail: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  reviewLink: { paddingTop: 4 },
  reviewLinkText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  detailsLink: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsLinkText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  providerActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  providerConfirmButton: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  providerConfirmText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  providerDeclineButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  providerDeclineText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
