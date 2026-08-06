import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGetBooking, useGetProviderById, useListProviderServices } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const STATUS_META: Record<string, { label: string; bg: string; text: string; description: string }> = {
  requested: { label: 'Pending', bg: '#FEF3C7', text: '#92400E', description: 'Your request is with the provider for review.' },
  confirmed: { label: 'Confirmed', bg: '#D1FAE5', text: '#065F46', description: 'Your visit is scheduled.' },
  rescheduled: { label: 'Rescheduled', bg: '#DBEAFE', text: '#1E40AF', description: 'The appointment time was changed.' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#047857', description: 'This visit has been completed.' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', text: '#6B7280', description: 'This booking is no longer active.' },
  no_show: { label: 'No show', bg: '#FEE2E2', text: '#991B1B', description: 'The visit was marked as a no-show.' },
};

function formatDate(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }),
  };
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { data, isLoading, error } = useGetBooking(bookingId, {
    query: { enabled: Number.isFinite(bookingId) && bookingId > 0, queryKey: ['booking-detail', bookingId] },
  });
  const booking = data?.booking;
  const { data: providerData, isLoading: providerLoading } = useGetProviderById(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider', booking?.providerId] },
  });
  const { data: servicesData } = useListProviderServices(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider-services', booking?.providerId] },
  });

  if (isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (error || !booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Booking unavailable</Text>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>We couldn’t load this booking.</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.primaryButtonText}>Back to bookings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_META[booking.status] ?? {
    label: booking.status,
    bg: colors.secondary,
    text: colors.foreground,
    description: 'The booking status was updated.',
  };
  const scheduled = formatDate(booking.scheduledAt);
  const provider = providerData?.provider;
  const service = servicesData?.services.find((item) => item.id === booking.serviceId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Feather name="arrow-left" size={20} color="#fff" />
            <Text style={styles.backText}>Bookings</Text>
          </TouchableOpacity>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingNumber}>Booking #{booking.id}</Text>
              <Text style={styles.heroTitle}>Appointment details</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.heroDescription}>{status.description}</Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your visit</Text>
            <View style={styles.detailList}>
              <DetailRow icon="calendar" label={scheduled.date} value={scheduled.time} colors={colors} />
              <DetailRow
                icon="map-pin"
                label={booking.address}
                value={`${booking.city}${booking.postalCode ? ` · ${booking.postalCode}` : ''}`}
                colors={colors}
              />
              {service && (
                <DetailRow
                  icon="clock"
                  label={service.title}
                  value={`${service.durationMinutes} minutes · $${(service.priceCents / 100).toFixed(2)}`}
                  colors={colors}
                />
              )}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.providerHeader}>
              <Feather name="user" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your provider</Text>
            </View>
            {providerLoading ? (
              <View style={[styles.skeleton, { backgroundColor: colors.secondary }]} />
            ) : provider ? (
              <View style={styles.providerRow}>
                {provider.avatarUrl ? (
                  <Image source={{ uri: provider.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{provider.firstName[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerName, { color: colors.foreground }]}>{provider.firstName} {provider.lastName}</Text>
                  <Text style={[styles.providerTitle, { color: colors.primary }]}>{provider.title || 'Foot care professional'}</Text>
                  <Text style={[styles.providerCity, { color: colors.mutedForeground }]}>{provider.city}</Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>Provider information is temporarily unavailable.</Text>
            )}
          </View>

          {(booking.clientNotes || booking.cancellationReason) && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.providerHeader}>
                <Feather name="file-text" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {booking.cancellationReason ? 'Cancellation note' : 'Visit notes'}
                </Text>
              </View>
              {booking.cancellationReason ? (
                <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>{booking.cancellationReason}</Text>
              ) : (
                <>
                  {booking.clientNotes && <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>{booking.clientNotes}</Text>}
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.push(`/provider/${booking.providerId}`)}
            style={[styles.profileButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={[styles.profileButtonText, { color: colors.primary }]}>View provider profile</Text>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={19} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.mutedForeground }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 8 },
  errorText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  primaryButton: { marginTop: 12, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  hero: { paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  backText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 26 },
  bookingNumber: { color: '#fff', opacity: 0.7, fontSize: 13, fontFamily: 'Inter_400Regular' },
  heroTitle: { color: '#fff', fontSize: 27, fontFamily: 'Inter_700Bold', marginTop: 3 },
  heroDescription: { color: '#fff', opacity: 0.82, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 12 },
  statusBadge: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 12, marginTop: -10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  detailList: { gap: 17, marginTop: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  detailValue: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  providerName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  providerTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  providerCity: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  mutedText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  skeleton: { height: 22, width: 190, borderRadius: 8 },
  profileButton: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileButtonText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});