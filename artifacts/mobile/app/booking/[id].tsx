import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  getGetBookingReviewQueryKey,
  getListProviderReviewsQueryKey,
  useCreateReview,
  useGetBooking,
  useGetBookingReview,
  useGetProviderAvailability,
  useGetProviderById,
  useListProviderServices,
  useUpdateBookingStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';
import { useClientBookingStatusFeedback } from '@/hooks/use-client-booking-status-feedback';
import RescheduleModal from '@/components/reschedule-modal';
import RescheduleProposalCard from '@/components/reschedule-proposal-card';

const STATUS_META: Record<string, { label: string; bg: string; text: string; description: string }> = {
  requested: { label: 'Pending', bg: '#FEF3C7', text: '#92400E', description: 'Your request is with the provider for review.' },
  confirmed: { label: 'Confirmed', bg: '#D1FAE5', text: '#065F46', description: 'Your visit is scheduled.' },
  rescheduled: { label: 'Rescheduled', bg: '#DBEAFE', text: '#1E40AF', description: 'A new appointment time is waiting for confirmation.' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#047857', description: 'This visit has been completed.' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', text: '#6B7280', description: 'This booking is no longer active.' },
  no_show: { label: 'No show', bg: '#FEE2E2', text: '#991B1B', description: 'The visit was marked as a no-show.' },
};

// Formats the appointment instant in the authoritative marketplace timezone
// when it is known (same server source as the slot engine). When the timezone
// is unavailable the previous device-timezone rendering is preserved and the
// caller shows an explicit caption instead of failing silently. DST is
// handled by Intl's timezone-aware formatting — never by manual offsets.
function formatDate(value: string, timeZone?: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    }),
    time: date.toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      // Surface the abbreviation (e.g. "EDT"/"EST") so the zone is explicit.
      ...(timeZone ? { timeZone, timeZoneName: 'short' as const } : {}),
    }),
  };
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useGetBooking(bookingId, {
    query: {
      enabled: Number.isFinite(bookingId) && bookingId > 0,
      queryKey: ['booking-detail', bookingId],
      refetchOnMount: 'always',
      refetchOnReconnect: true,
    },
  });
  const booking = data?.booking;
  const [isCancelling, setIsCancelling] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const updateStatus = useUpdateBookingStatus();
  const statusFeedback = useClientBookingStatusFeedback(booking ? [booking] : undefined);
  const queryClient = useQueryClient();
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const createReview = useCreateReview();
  const { data: providerData, isLoading: providerLoading } = useGetProviderById(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider', booking?.providerId] },
  });
  const { data: servicesData } = useListProviderServices(booking?.providerId ?? 0, {
    query: { enabled: !!booking?.providerId, queryKey: ['booking-provider-services', booking?.providerId] },
  });
  // Authoritative marketplace timezone — the same public endpoint and server
  // engine (getMarketplaceTimezone) that powers slot generation, so the
  // detail view always matches the times shown when booking or rescheduling.
  const { data: availabilityData, isError: timezoneUnavailable } = useGetProviderAvailability(
    booking?.providerId ?? 0,
    {
      query: { enabled: !!booking?.providerId, queryKey: ['booking-provider-availability', booking?.providerId] },
    },
  );
  const { data: reviewData } = useGetBookingReview(bookingId, {
    query: {
      enabled: booking?.status === 'completed',
      queryKey: ['client-booking-review', bookingId],
      retry: false,
    },
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refetch();
      }
    });

    return () => subscription.remove();
  }, [refetch]);

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
  const marketplaceTimezone = availabilityData?.timezone;
  const scheduled = formatDate(booking.scheduledAt, marketplaceTimezone);
  const provider = providerData?.provider;
  const service = servicesData?.services.find((item) => item.id === booking.serviceId);
  const isProvider = user?.role === 'provider';
  const canCancel = !isProvider && ['requested', 'confirmed', 'rescheduled'].includes(booking.status);
  const isReviewEligible = !isProvider && booking.status === 'completed';
  // Reschedule: the server's state machine lets a client reschedule only a
  // CONFIRMED booking. The action needs the active service (for real slots),
  // so it stays hidden until the service is known — and the server remains
  // the final authority on every submission.
  const isRescheduleEligible = booking.status === 'confirmed';
  const canReschedule = isRescheduleEligible && !!service;
  const rescheduleServiceGone = isRescheduleEligible && !!servicesData && !service;
  const canConfirmReschedule = isProvider && booking.status === 'rescheduled';
  const pendingRescheduleMessage = !isProvider && booking.status === 'rescheduled'
    ? 'Your provider has been notified. This visit stays pending until the new time is confirmed.'
    : null;

  const handleReviewSubmit = () => {
    const trimmedComment = reviewComment.trim();
    if (!reviewRating) {
      setReviewError('Choose a rating from 1 to 5 stars.');
      return;
    }
    if (trimmedComment.length > 1000) {
      setReviewError('Keep your comment to 1,000 characters or fewer.');
      return;
    }

    setReviewError('');
    createReview.mutate(
      {
        data: {
          bookingId: booking.id,
          rating: reviewRating,
          ...(trimmedComment ? { comment: trimmedComment } : {}),
        },
      },
      {
        onSuccess: () => {
          Alert.alert('Review saved', 'Thanks for helping other clients choose with confidence.');
          void queryClient.invalidateQueries({ queryKey: getGetBookingReviewQueryKey(booking.id) });
          void queryClient.invalidateQueries({ queryKey: getListProviderReviewsQueryKey(booking.providerId) });
          void queryClient.invalidateQueries({ queryKey: ['provider', booking.providerId] });
        },
        onError: (error) => {
          const status = (error as { status?: number }).status;
          setReviewError(
            status === 409
              ? 'A review for this visit already exists. Refreshing.'
              : status === 400
                ? 'Check your rating and comment, then try again.'
                : 'We could not save your review. Please try again.',
          );
          void queryClient.invalidateQueries({ queryKey: getGetBookingReviewQueryKey(booking.id) });
        },
      },
    );
  };

  const handleCancel = () => {
    if (isCancelling) return;
    if (!canCancel) {
      Alert.alert('Booking updated', 'This booking can no longer be cancelled. Refreshing.');
      void refetch();
      return;
    }

    Alert.alert('Cancel booking?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => {
          setIsCancelling(true);
          updateStatus.mutate(
            {
              bookingId: booking.id,
              data: { status: 'cancelled', cancellationReason: 'Cancelled by client' },
            },
            {
              onSuccess: () => {
                Alert.alert('Booking cancelled', 'The provider has been notified.');
                statusFeedback.suppressNextStatusChange(booking.id, 'cancelled');
                void refetch();
                setIsCancelling(false);
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
                setIsCancelling(false);
              },
            },
          );
        },
      },
    ]);
  };

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
          {pendingRescheduleMessage && (
            <Text style={styles.heroDescription}>{pendingRescheduleMessage}</Text>
          )}
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your visit</Text>
            <View style={styles.detailList}>
              <View>
                <DetailRow icon="calendar" label={scheduled.date} value={scheduled.time} colors={colors} />
                {marketplaceTimezone ? (
                  <Text
                    style={[styles.timezoneCaption, { color: colors.mutedForeground }]}
                    testID="booking-timezone-label"
                    accessibilityLabel={`Times shown in the ${marketplaceTimezone.replace(/_/g, ' ')} timezone`}
                  >
                    Times shown in {marketplaceTimezone.replace(/_/g, ' ')}
                  </Text>
                ) : timezoneUnavailable ? (
                  <Text
                    style={[styles.timezoneCaption, { color: colors.mutedForeground }]}
                    testID="booking-timezone-fallback"
                    accessibilityLabel="Times shown in your device’s timezone"
                  >
                    Shown in your device’s timezone
                  </Text>
                ) : null}
              </View>
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

          {isProvider && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.providerHeader}>
                <Feather name="users" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your client</Text>
              </View>
              <Text style={[styles.providerName, { color: colors.foreground }]}>
                {booking.clientFirstName
                  ? `${booking.clientFirstName} ${booking.clientLastName ?? ''}`.trim()
                  : `Client #${booking.clientId}`}
              </Text>
              {booking.clientPhone && (
                <Text style={[styles.providerCity, { color: colors.mutedForeground }]}>{booking.clientPhone}</Text>
              )}
            </View>
          )}

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

          {isReviewEligible && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {reviewData?.review ? (
                <>
                  <View style={styles.providerHeader}>
                    <Feather name="star" size={20} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your review</Text>
                  </View>
                  <View style={styles.starRow}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Feather
                        key={index}
                        name="star"
                        size={19}
                        color={index < reviewData.review.rating ? '#C47A57' : colors.mutedForeground}
                      />
                    ))}
                  </View>
                  {reviewData.review.comment && (
                    <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>
                      {reviewData.review.comment}
                    </Text>
                  )}
                  <Text style={[styles.reviewThanks, { color: colors.primary }]}>
                    Thanks for sharing your experience.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How was your visit?</Text>
                  <Text style={[styles.mutedText, { color: colors.mutedForeground, marginTop: 5 }]}>
                    Your experience helps other clients find the right care.
                  </Text>
                  <View style={styles.starRow} accessibilityRole="radiogroup">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() => setReviewRating(value)}
                          style={styles.starButton}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: reviewRating === value }}
                          accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                        >
                          <Feather
                            name="star"
                            size={25}
                            color={value <= reviewRating ? '#C47A57' : colors.mutedForeground}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="Share a helpful note about your visit (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    maxLength={1000}
                    style={[styles.reviewInput, { borderColor: colors.border, color: colors.foreground }]}
                  />
                  <View style={styles.reviewMeta}>
                    <Text style={[styles.reviewError, { color: reviewError ? colors.destructive ?? '#B42318' : colors.mutedForeground }]}>
                      {reviewError || 'Keep it kind and specific.'}
                    </Text>
                    <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
                      {reviewComment.length}/1000
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleReviewSubmit}
                    disabled={createReview.isPending}
                    style={[styles.reviewSubmit, { backgroundColor: colors.primary, opacity: createReview.isPending ? 0.55 : 1 }]}
                  >
                    {createReview.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.reviewSubmitText}>Submit review</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Consent-first proposals: pending provider proposal + accepted-change history */}
          {['confirmed', 'rescheduled', 'completed', 'cancelled'].includes(booking.status) && (
            <RescheduleProposalCard
              bookingId={booking.id}
              isClient={!isProvider}
              {...(marketplaceTimezone ? { timezone: marketplaceTimezone } : {})}
              colors={colors}
              onChanged={() => void refetch()}
            />
          )}

          {!isProvider && (
            <TouchableOpacity
              onPress={() => router.push(`/provider/${booking.providerId}`)}
              style={[styles.profileButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Text style={[styles.profileButtonText, { color: colors.primary }]}>View provider profile</Text>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          {canReschedule && (
            <TouchableOpacity
              onPress={() => setShowReschedule(true)}
              accessibilityRole="button"
              accessibilityLabel={`${isProvider ? 'Propose a new time for' : 'Reschedule your'} ${service!.title} appointment`}
              testID="reschedule-button"
              style={[styles.rescheduleButton, { backgroundColor: colors.primary }]}
            >
              <Feather name="calendar" size={17} color="#fff" />
              <Text style={styles.rescheduleButtonText}>{isProvider ? 'Propose a new time' : 'Reschedule appointment'}</Text>
            </TouchableOpacity>
          )}
          {canConfirmReschedule && (
            <View style={styles.providerDetailActions}>
              <TouchableOpacity
                onPress={() => {
                  if (updateStatus.isPending) return;
                  updateStatus.mutate(
                    { bookingId: booking.id, data: { status: 'confirmed' } },
                    {
                      onSuccess: () => {
                        Alert.alert('New time confirmed', 'The client has been notified.');
                        void refetch();
                      },
                      onError: () => {
                        Alert.alert('Booking already updated', 'Refreshing to show the current booking.');
                        void refetch();
                      },
                    },
                  );
                }}
                disabled={updateStatus.isPending}
                accessibilityRole="button"
                accessibilityLabel="Confirm new time"
                testID="provider-confirm-reschedule"
                style={[styles.rescheduleButton, { backgroundColor: colors.primary, opacity: updateStatus.isPending ? 0.5 : 1 }]}
              >
                {updateStatus.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.rescheduleButtonText}>Confirm new time</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (updateStatus.isPending) return;
                  Alert.alert('Decline reschedule?', 'This will cancel the booking and notify the client.', [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Decline',
                      style: 'destructive',
                      onPress: () => {
                        updateStatus.mutate(
                          { bookingId: booking.id, data: { status: 'cancelled', cancellationReason: 'Reschedule declined by provider' } },
                          {
                            onSuccess: () => {
                              Alert.alert('Reschedule declined', 'The client has been notified.');
                              void refetch();
                            },
                            onError: () => {
                              Alert.alert('Booking already updated', 'Refreshing to show the current booking.');
                              void refetch();
                            },
                          },
                        );
                      },
                    },
                  ]);
                }}
                disabled={updateStatus.isPending}
                accessibilityRole="button"
                accessibilityLabel="Decline reschedule"
                testID="provider-decline-reschedule"
                style={[styles.cancelButton, { borderColor: colors.destructive ?? '#B42318', opacity: updateStatus.isPending ? 0.5 : 1 }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.destructive ?? '#B42318' }]}>Decline reschedule</Text>
              </TouchableOpacity>
            </View>
          )}
          {rescheduleServiceGone && (
            <Text
              style={[styles.mutedText, { color: colors.mutedForeground, paddingHorizontal: 4 }]}
              testID="reschedule-service-unavailable"
            >
              Rescheduling isn’t available because this service is no longer offered. You can
              cancel below and book another service instead.
            </Text>
          )}
          {canCancel && (
            <TouchableOpacity
              onPress={handleCancel}
              disabled={isCancelling}
              style={[styles.cancelButton, { borderColor: colors.destructive ?? '#B42318', backgroundColor: colors.destructive ? colors.destructive + '12' : '#B4231812', opacity: isCancelling ? 0.5 : 1 }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.destructive ?? '#B42318' }]}>
                {isCancelling ? 'Cancelling…' : 'Cancel booking'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Reschedule — real server-provided slots only; the old appointment
          datetime is never reused, and every safety rule is re-validated by
          the shared rescheduling endpoint. */}
      {showReschedule && canReschedule && service && (
        <RescheduleModal
          bookingId={booking.id}
          providerId={booking.providerId}
          perspective={isProvider ? 'provider' : 'client'}
          providerName={
            isProvider
              ? (booking.clientFirstName ? `${booking.clientFirstName} ${booking.clientLastName ?? ''}`.trim() : `Client #${booking.clientId}`)
              : (provider ? `${provider.firstName} ${provider.lastName}` : 'Your provider')
          }
          service={service}
          currentScheduledAt={booking.scheduledAt}
          colors={colors}
          insets={insets}
          onClose={() => setShowReschedule(false)}
          onSuccess={() => {
            if (!isProvider) statusFeedback.suppressNextStatusChange(booking.id, 'rescheduled');
            setShowReschedule(false);
            void refetch();
          }}
        />
      )}
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
  timezoneCaption: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, marginLeft: 31 },
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
  rescheduleButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rescheduleButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  providerDetailActions: { gap: 8 },
  cancelButton: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  starButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  reviewInput: { minHeight: 92, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 14, fontSize: 14, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' },
  reviewMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  reviewError: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular' },
  reviewCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  reviewSubmit: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  reviewSubmitText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewThanks: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 10 },
});