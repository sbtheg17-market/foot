import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  useGetProviderById,
  useListProviderServices,
  useListProviderReviews,
  useCreateBooking,
  useGetProviderSlots,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';

export default function ProviderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = Number(id);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();

  const { data: providerRes, isLoading } = useGetProviderById(providerId, {
    query: { enabled: !!providerId, queryKey: ['provider', providerId] },
  });
  const { data: servicesRes } = useListProviderServices(providerId, {
    query: { enabled: !!providerId, queryKey: ['services', providerId] },
  });
  const { data: reviewsRes } = useListProviderReviews(providerId, undefined, {
    query: { enabled: !!providerId, queryKey: ['reviews', providerId] },
  });

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!providerRes) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Provider not found</Text>
      </View>
    );
  }

  const provider = providerRes.provider;
  const services = servicesRes?.services ?? [];
  const reviews = reviewsRes?.reviews ?? [];
  const selectedService = services.find(s => s.id === selectedServiceId);
  const canBook = user?.role === 'client';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12, backgroundColor: colors.card + 'CC' }]}
        onPress={() => router.back()}
      >
        <Feather name="chevron-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary + '22', height: 160 }]}>
          {provider.avatarUrl ? (
            <Image
              source={{ uri: provider.avatarUrl }}
              accessibilityLabel={`${provider.firstName} ${provider.lastName}`}
              style={styles.heroAvatarImage}
            />
          ) : (
            <View style={[styles.heroAvatar, { backgroundColor: colors.primary + '33' }]}>
              <Text style={[styles.heroInitial, { color: colors.primary }]}>
                {provider.firstName[0]?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {provider.firstName} {provider.lastName}
              </Text>
              <Text style={[styles.title, { color: colors.primary }]}>{provider.title || 'Foot care professional'}</Text>
            </View>
            {provider.verificationStatus === 'approved' && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + '22' }]}>
                <Feather name="shield" size={12} color={colors.primary} />
                <Text style={[styles.verifiedText, { color: colors.primary }]}>Credentials verified</Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Feather name="star" size={14} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {' '}{Number(provider.rating).toFixed(2)}
              </Text>
              <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
                {' '}({provider.reviewCount})
              </Text>
            </View>
            <View style={[styles.statSep, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}> {provider.city}</Text>
            </View>
            {provider.yearsExperience != null && (
              <>
                <View style={[styles.statSep, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Feather name="clock" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}> {provider.yearsExperience} yrs</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.trustRow}>
            <Feather
              name={provider.acceptsNewClients ? 'check-circle' : 'clock'}
              size={14}
              color={provider.acceptsNewClients ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.trustText, { color: provider.acceptsNewClients ? colors.primary : colors.mutedForeground }]}>
              {provider.acceptsNewClients ? 'Accepting new clients' : 'Currently fully booked'}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {provider.bio && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{provider.bio}</Text>
          </View>
        )}

        {provider.serviceAreaNotes && (
          <View style={[styles.areaCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="map-pin" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.areaTitle, { color: colors.foreground }]}>Service area</Text>
              <Text style={[styles.areaText, { color: colors.mutedForeground }]}>{provider.serviceAreaNotes}</Text>
            </View>
          </View>
        )}

        {/* Services */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Services</Text>
          {services.map(service => (
            <TouchableOpacity
              key={service.id}
              onPress={() => setSelectedServiceId(service.id === selectedServiceId ? null : service.id)}
              style={[
                styles.serviceCard,
                {
                  backgroundColor: colors.card,
                  borderColor: selectedServiceId === service.id ? colors.primary : colors.border,
                  borderWidth: selectedServiceId === service.id ? 2 : 1,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.serviceTop}>
                <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{service.title}</Text>
                <Text style={[styles.servicePrice, { color: colors.primary }]}>
                  ${(service.priceCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.serviceMeta}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.serviceDuration, { color: colors.mutedForeground }]}>
                  {' '}{service.durationMinutes} mins
                </Text>
              </View>
              {service.description && (
                <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {service.description}
                </Text>
              )}
              {service.eligibilityNotes && (
                <Text style={[styles.serviceEligibility, { color: colors.foreground }]} numberOfLines={2}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Good to know: </Text>
                  {service.eligibilityNotes}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reviews</Text>
            {reviews.slice(0, 5).map(review => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.secondary }]}>
                <View style={styles.reviewTop}>
                  <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>{review.clientFirstName}</Text>
                  <View style={styles.stars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Feather key={i} name="star" size={11} color={i < review.rating ? colors.accent : colors.border} />
                    ))}
                  </View>
                </View>
                {review.comment && (
                  <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky booking bar */}
      <View style={[styles.bookingBar, { backgroundColor: colors.card + 'F2', borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          disabled={!selectedServiceId || !provider.acceptsNewClients}
          onPress={() => {
            if (!user) {
              router.push('/auth/login');
              return;
            }
            if (!canBook) {
              Alert.alert(
                'Client account required',
                'Provider and admin accounts can browse profiles, but only clients can request appointments.',
              );
              return;
            }
            setShowBooking(true);
          }}
          style={[styles.bookBtn, { backgroundColor: colors.primary, opacity: (!selectedServiceId || !provider.acceptsNewClients) ? 0.4 : 1 }]}
          activeOpacity={0.8}
        >
          <Text style={styles.bookBtnText}>
            {!provider.acceptsNewClients
              ? 'Not accepting new clients'
              : selectedServiceId
                ? user && !canBook
                  ? 'Client account required to book'
                  : 'Book Appointment'
              : 'Select a service to book'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      {showBooking && selectedService && (
        <BookingModal
          providerId={provider.id}
          providerName={`${provider.firstName} ${provider.lastName}`}
          service={selectedService}
          colors={colors}
          insets={insets}
          onClose={() => setShowBooking(false)}
          onSuccess={() => {
            setShowBooking(false);
            router.push('/bookings');
          }}
        />
      )}
    </View>
  );
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

function BookingModal({
  providerId, providerName, service, colors, insets, onClose, onSuccess,
}: {
  providerId: number;
  providerName: string;
  service: { id: number; title: string; priceCents: number; durationMinutes: number };
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  // Server-provided slots only — mirrors the verified web booking modal and
  // the mobile reschedule modal. The previous free-text date/time entry
  // parsed "YYYY-MM-DDTHH:MM" in the DEVICE timezone, so a traveller (or any
  // device outside the marketplace zone) submitted the wrong instant. Slot
  // ISO strings come from the same server engine that enforces availability,
  // so the submitted instant is marketplace-correct by construction.
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
    { query: { queryKey: ['booking-slots', providerId, service.id, date] } },
  );
  const timezone = slotsRes?.timezone;
  const slots = slotsRes?.slots ?? [];

  const createBooking = useCreateBooking();

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    });

  const handleSubmit = () => {
    // Duplicate-tap protection: the button is disabled while pending, and
    // this guard covers any re-entry path.
    if (createBooking.isPending) return;
    if (!selectedSlot) {
      Alert.alert('Choose a time', 'Please select an available time slot first.');
      return;
    }
    if (!address || !city) {
      Alert.alert('Missing fields', 'Please fill in address and city.');
      return;
    }
    createBooking.mutate(
      { data: { providerId, serviceId: service.id, scheduledAt: selectedSlot, address, city, postalCode: postalCode || undefined, clientNotes: notes || undefined } },
      {
        onSuccess: () => {
          Alert.alert('Booking requested!', 'The provider will confirm within 24 hours.', [{ text: 'OK', onPress: onSuccess }]);
        },
        onError: (err: unknown) => {
          const apiError = err as {
            status?: number;
            data?: { error?: string; reason?: string; bookingId?: number } | null;
          };
          const reason = apiError.data?.reason;
          // The slot was just taken, or is no longer within availability —
          // recover in place: clear the pick and refresh the grid (web parity).
          if (reason === 'provider_unavailable' || reason === 'outside_availability') {
            Alert.alert('Time unavailable', 'That time is no longer available. Please choose another slot.');
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          // Booking-race notice (Session 079): the friendly duplicate-booking
          // 409 contract (HTTP 409 + numeric bookingId) means this exact slot is
          // already held by an active booking. Show the approved notice and keep
          // the form open so the client can choose another time. Detection is
          // strict — any other error keeps its existing behavior.
          if (apiError.status === 409 && typeof apiError.data?.bookingId === 'number') {
            Alert.alert(
              'Time unavailable',
              'That time was just taken by another booking. Please choose another available time.',
            );
            setSelectedSlot(null);
            return;
          }
          Alert.alert('Error', 'Could not create booking. Please try again.');
        },
      }
    );
  };

  return (
    <Modal animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Book Appointment</Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                {providerName} · {service.title} · ${(service.priceCents / 100).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
            {/* Date strip — same pattern as the reschedule modal */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground, paddingHorizontal: 20 }]}>Choose a date *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayStrip}
                testID="booking-date-strip"
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
                      testID={`booking-day-${d.dateStr}`}
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
                <View style={styles.timezoneRow} testID="booking-timezone-label">
                  <Feather name="globe" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.timezoneText, { color: colors.mutedForeground }]}>
                    Times shown in {timezone.replace(/_/g, ' ')}
                  </Text>
                </View>
              )}
            </View>

            {/* Slot grid — real server-provided slots only */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground, paddingHorizontal: 20 }]}>Available times *</Text>
              {loadingSlots ? (
                <View style={styles.slotsLoading} testID="booking-slots-loading">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : slots.length === 0 ? (
                <Text style={[styles.noSlots, { color: colors.mutedForeground }]} testID="booking-no-slots">
                  No available times on this date. Try another day.
                </Text>
              ) : (
                <View style={styles.slotGrid} testID="booking-slot-grid">
                  {slots.map((slot) => {
                    const disabled = !slot.available;
                    const selected = selectedSlot === slot.start;
                    return (
                      <TouchableOpacity
                        key={slot.start}
                        onPress={() => setSelectedSlot(slot.start)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={`${slotLabel(slot.start)}${slot.available ? '' : ' — unavailable'}`}
                        testID={`booking-slot-${slot.start}`}
                        style={[
                          styles.slotChip,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : disabled ? colors.secondary : colors.card,
                            opacity: disabled ? 0.55 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            {
                              color: selected ? '#fff' : disabled ? colors.mutedForeground : colors.foreground,
                              textDecorationLine: disabled ? 'line-through' : 'none',
                            },
                          ]}
                        >
                          {slotLabel(slot.start)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ paddingHorizontal: 20, gap: 16 }}>
              <Field label="Street address *" value={address} onChange={setAddress} placeholder="123 Main St" colors={colors} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="City *" value={city} onChange={setCity} placeholder="Toronto" colors={colors} />
                </View>
                <View style={{ width: 100 }}>
                  <Field label="Postal code" value={postalCode} onChange={setPostalCode} placeholder="M5V 2T6" colors={colors} />
                </View>
              </View>
              <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Any care requirements..." colors={colors} multiline />

              <View style={[styles.summaryBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{service.title}</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>${(service.priceCents / 100).toFixed(2)}</Text>
                </View>
                <Text style={[styles.summaryDuration, { color: colors.mutedForeground }]}>
                  {service.durationMinutes} minutes · at your home
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createBooking.isPending || !selectedSlot}
              accessibilityRole="button"
              accessibilityState={{ disabled: createBooking.isPending || !selectedSlot }}
              accessibilityLabel="Request appointment"
              testID="booking-submit-button"
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: createBooking.isPending || !selectedSlot ? 0.55 : 1 }]}
              activeOpacity={0.8}
            >
              {createBooking.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Request Appointment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, colors, multiline, keyboardType }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
  keyboardType?: any;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.fieldInput,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
          multiline && { height: 80, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20 },
  heroAvatar: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroAvatarImage: { width: 80, height: 80, borderRadius: 24 },
  heroInitial: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  profileCard: {
    margin: 16,
    marginTop: -20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  title: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  verifiedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statSep: { width: StyleSheet.hairlineWidth, height: 14 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  trustText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  areaCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 10 },
  areaTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  areaText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  serviceCard: { borderRadius: 14, padding: 14, marginBottom: 8 },
  serviceTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  serviceTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  servicePrice: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  serviceDuration: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  serviceDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  serviceEligibility: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 8 },
  reviewCard: { borderRadius: 12, padding: 12, marginBottom: 8 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewAuthor: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  stars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  bookingBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bookBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  // Modal
  modalContainer: { flex: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', gap: 10 },
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
  summaryBox: { borderWidth: 1, borderRadius: 14, padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  summaryDuration: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  modalFooter: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
