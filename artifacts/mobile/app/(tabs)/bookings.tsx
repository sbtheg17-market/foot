import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useListBookings, useUpdateBookingStatus } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';

type Tab = 'upcoming' | 'past' | 'cancelled';

const TAB_STATUSES: Record<Tab, string[]> = {
  upcoming: ['requested', 'confirmed', 'rescheduled'],
  past: ['completed', 'no_show'],
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
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  const { data, isLoading, refetch } = useListBookings(undefined, {
    query: {
      queryKey: ['bookings'],
      enabled: user?.role === 'client',
    },
  });

  const updateStatus = useUpdateBookingStatus();
  // Track which booking has a request in flight so we can disable its button.
  const [pendingId, setPendingId] = useState<number | null>(null);

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

  if (user.role !== 'client') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Feather name="briefcase" size={40} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>
          This is a client space
        </Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
          You’re signed in as a {user.role}. Switch to a client account to request and manage visits.
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
  const filtered = allBookings.filter(b => TAB_STATUSES[activeTab].includes(b.status));

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

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
  ];
  const upcomingCount = allBookings.filter(b => TAB_STATUSES.upcoming.includes(b.status)).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
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
              {tab.id === 'upcoming' && upcomingCount > 0 ? ` (${upcomingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
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
            const meta = STATUS_META[item.status] ?? STATUS_META.cancelled;
            const canCancel = ['requested', 'confirmed', 'rescheduled'].includes(item.status);
            const date = new Date(item.scheduledAt);
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
                  <Text style={[styles.bookingDetail, { color: colors.foreground }]}>
                    {date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' at '}
                    {date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.bookingRow}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.bookingDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.address}, {item.city}
                  </Text>
                </View>
                {item.status === 'completed' && (
                  <TouchableOpacity onPress={() => router.push(`/provider/${item.providerId}`)} style={styles.reviewLink}>
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
});
