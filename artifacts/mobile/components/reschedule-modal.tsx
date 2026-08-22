import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetProviderSlots, useUpdateBookingStatus } from '@workspace/api-client-react';
import type { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useColors } from '@/hooks/useColors';

interface Service {
  id: number;
  title: string;
  priceCents: number;
  durationMinutes: number;
}

interface RescheduleModalProps {
  bookingId: number;
  providerId: number;
  providerName: string;
  service: Service;
  /** ISO datetime of the current appointment — never reusable as the new time. */
  currentScheduledAt: string;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onClose: () => void;
  /** Called after the server accepts the new time. */
  onSuccess: () => void;
}

/** Local YYYY-MM-DD for a Date. */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The next `count` calendar days (device-local), starting today. */
function upcomingDays(count: number): Array<{ dateStr: string; weekday: string; day: string; month: string }> {
  const days: Array<{ dateStr: string; weekday: string; day: string; month: string }> = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      dateStr: toDateStr(d),
      weekday: d.toLocaleDateString('en-CA', { weekday: 'short' }),
      day: String(d.getDate()),
      month: d.toLocaleDateString('en-CA', { month: 'short' }),
    });
  }
  return days;
}

/**
 * Mobile client reschedule flow — mirrors the verified web behavior: real
 * server-provided slots only (no free datetime entry), the current
 * appointment time is never reusable, and the server remains authoritative
 * for every safety rule (authorization, state, availability, overlap,
 * duplicates, service status). This modal only provides friendly paths and
 * in-place recovery.
 */
export default function RescheduleModal({
  bookingId,
  providerId,
  providerName,
  service,
  currentScheduledAt,
  colors,
  insets,
  onClose,
  onSuccess,
}: RescheduleModalProps) {
  const days = useMemo(() => upcomingDays(90), []);
  const [date, setDate] = useState(days[0]!.dateStr);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const {
    data: slotsRes,
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useGetProviderSlots(
    providerId,
    { serviceId: service.id, date },
    { query: { queryKey: ['reschedule-slots', providerId, service.id, date] } },
  );

  const timezone = slotsRes?.timezone;
  const slots = slotsRes?.slots ?? [];
  const currentMs = useMemo(() => Date.parse(currentScheduledAt), [currentScheduledAt]);

  const updateStatus = useUpdateBookingStatus();

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    });

  const currentLabel = useMemo(
    () =>
      new Date(currentScheduledAt).toLocaleString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        ...(timezone ? { timeZone: timezone } : {}),
      }),
    [currentScheduledAt, timezone],
  );

  const handleClose = () => {
    if (updateStatus.isPending) return; // never orphan an in-flight request
    onClose();
  };

  const handleSubmit = () => {
    // Duplicate-tap protection: the button is disabled while pending, and
    // this guard covers any re-entry path.
    if (updateStatus.isPending) return;
    if (!selectedSlot) {
      Alert.alert('Choose a time', 'Please select an available time slot first.');
      return;
    }
    // The old appointment time is never submittable as the new time.
    if (Date.parse(selectedSlot) === currentMs) {
      Alert.alert('That is your current time', 'Please pick a different slot.');
      setSelectedSlot(null);
      return;
    }

    updateStatus.mutate(
      {
        bookingId,
        data: { status: 'rescheduled', scheduledAt: selectedSlot },
      },
      {
        onSuccess: () => {
          Alert.alert(
            'New time requested',
            'Your provider will confirm the change. Your current appointment stays until they do.',
            [{ text: 'OK', onPress: onSuccess }],
          );
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number; data?: { error?: string } | null };
          const statusCode = apiError.status;
          const serverMessage = apiError.data?.error ?? '';

          // Slot was just taken, collides with one of your own bookings, or
          // availability changed — recover in place: clear the pick, refresh.
          if (
            serverMessage.includes('overlaps another appointment') ||
            serverMessage.includes("outside this provider's availability")
          ) {
            Alert.alert('Time unavailable', 'That time is no longer available. Please choose another slot.');
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          if (serverMessage.includes('already have an active request')) {
            Alert.alert(
              'Already booked',
              'You already have a booking for that exact time. Please pick a different slot.',
            );
            setSelectedSlot(null);
            return;
          }
          // Service was deactivated, or the booking state changed underneath
          // us — close and let the detail screen refresh to the safe state.
          if (serverMessage.includes('no longer offered')) {
            Alert.alert(
              'Service unavailable',
              'This service is no longer offered, so the booking cannot be rescheduled.',
              [{ text: 'OK', onPress: onClose }],
            );
            return;
          }
          if (statusCode === 409) {
            Alert.alert(
              'Booking updated',
              'This booking can no longer be rescheduled. Refreshing.',
              [{ text: 'OK', onPress: onClose }],
            );
            return;
          }
          if (statusCode === 403) {
            Alert.alert('No access', 'You do not have access to this booking.', [
              { text: 'OK', onPress: onClose },
            ]);
            return;
          }
          if (statusCode === 400 && serverMessage) {
            Alert.alert('Cannot use that time', serverMessage);
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          Alert.alert('Could not reschedule', 'Something went wrong. Please try again.');
        },
      },
    );
  };

  return (
    <Modal animationType="slide" presentationStyle="formSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Reschedule appointment</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {providerName} · {service.title}
            </Text>
            <Text
              style={[styles.currentTime, { color: colors.mutedForeground }]}
              testID="reschedule-current-time"
            >
              Currently {currentLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            disabled={updateStatus.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close reschedule dialog"
            testID="reschedule-modal-close"
            style={{ opacity: updateStatus.isPending ? 0.4 : 1 }}
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Date strip */}
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose a new date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
            testID="reschedule-date-strip"
          >
            {days.map((d) => {
              const selected = d.dateStr === date;
              return (
                <TouchableOpacity
                  key={d.dateStr}
                  onPress={() => {
                    setDate(d.dateStr);
                    setSelectedSlot(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${d.weekday} ${d.month} ${d.day}`}
                  testID={`reschedule-day-${d.dateStr}`}
                  style={[
                    styles.dayChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.dayWeekday, { color: selected ? '#fff' : colors.mutedForeground }]}>
                    {d.weekday}
                  </Text>
                  <Text style={[styles.dayNum, { color: selected ? '#fff' : colors.foreground }]}>{d.day}</Text>
                  <Text style={[styles.dayMonth, { color: selected ? '#fff' : colors.mutedForeground }]}>
                    {d.month}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {timezone && (
            <View style={styles.timezoneRow} testID="reschedule-timezone-label">
              <Feather name="globe" size={13} color={colors.mutedForeground} />
              <Text style={[styles.timezoneText, { color: colors.mutedForeground }]}>
                Times shown in {timezone.replace(/_/g, ' ')}
              </Text>
            </View>
          )}

          {/* Slot grid — real server-provided slots only */}
          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 18 }]}>Available times</Text>
          {loadingSlots ? (
            <View style={styles.slotsLoading} testID="reschedule-slots-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : slots.length === 0 ? (
            <Text
              style={[styles.noSlots, { color: colors.mutedForeground }]}
              testID="reschedule-no-slots"
            >
              No available times on this date. Try another day.
            </Text>
          ) : (
            <View style={styles.slotGrid} testID="reschedule-slot-grid">
              {slots.map((slot) => {
                const isCurrent = Date.parse(slot.start) === currentMs;
                const disabled = !slot.available || isCurrent;
                const selected = selectedSlot === slot.start;
                return (
                  <TouchableOpacity
                    key={slot.start}
                    onPress={() => setSelectedSlot(slot.start)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={
                      isCurrent
                        ? `${slotLabel(slot.start)} — current appointment time, unavailable`
                        : `${slotLabel(slot.start)}${slot.available ? '' : ' — unavailable'}`
                    }
                    testID={`reschedule-slot-${slot.start}`}
                    style={[
                      styles.slotChip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary
                          : disabled
                            ? colors.secondary
                            : colors.card,
                        opacity: disabled ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        {
                          color: selected ? '#fff' : disabled ? colors.mutedForeground : colors.foreground,
                          textDecorationLine: !slot.available && !isCurrent ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {slotLabel(slot.start)}
                    </Text>
                    {isCurrent && (
                      <Text style={[styles.slotCurrentTag, { color: colors.mutedForeground }]}>current</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View
            style={[
              styles.summaryBox,
              { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' },
            ]}
          >
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{service.title}</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                ${(service.priceCents / 100).toFixed(2)}
              </Text>
            </View>
            <Text style={[styles.summaryDuration, { color: colors.mutedForeground }]}>
              {service.durationMinutes} minutes · your address stays the same
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={updateStatus.isPending || !selectedSlot}
            accessibilityRole="button"
            accessibilityState={{ disabled: updateStatus.isPending || !selectedSlot }}
            accessibilityLabel="Confirm new time"
            testID="reschedule-submit-button"
            activeOpacity={0.8}
            style={[
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: updateStatus.isPending || !selectedSlot ? 0.55 : 1,
              },
            ]}
          >
            {updateStatus.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Confirm new time</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
            Your provider will confirm the new time. Your current appointment stays until they do.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  currentTime: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8, paddingHorizontal: 20 },
  dayStrip: { paddingHorizontal: 20, gap: 8 },
  dayChip: {
    minWidth: 58,
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  dayWeekday: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  dayNum: { fontSize: 17, fontFamily: 'Inter_700Bold', marginVertical: 1 },
  dayMonth: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  timezoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 20, marginTop: 10 },
  timezoneText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  slotsLoading: { paddingVertical: 26, alignItems: 'center' },
  noSlots: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, paddingVertical: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  slotChip: {
    minWidth: '30%',
    flexGrow: 1,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  slotText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  slotCurrentTag: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  summaryBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginHorizontal: 20, marginTop: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  summaryDuration: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  submitBtn: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  footerNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 10 },
});
