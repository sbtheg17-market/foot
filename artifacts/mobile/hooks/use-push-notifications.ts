import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

/**
 * Requests push-notification permission and registers the device's Expo
 * push token with the API server. Runs for authenticated clients and
 * providers on native (iOS / Android) — expo-notifications is not available
 * on web.
 *
 * Also wires up a notification-tap handler that navigates to the Bookings
 * tab so providers can act on a new-booking alert immediately.
 */
export function usePushNotifications(
  token: string | null,
  canReceivePush: boolean
) {
  // ── Register push token on login ───────────────────────────────────────────
  useEffect(() => {
    if (!token || !canReceivePush || Platform.OS === 'web') return;

    let cancelled = false;

    async function register() {
      try {
        // Request permission (shows system dialog on first run)
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        // Resolve project ID for Expo push service
        const projectId: string | undefined =
          (Constants as unknown as { easConfig?: { projectId?: string } })
            .easConfig?.projectId ??
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
            ?.eas?.projectId;

        const pushTokenObj = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : {}
        );
        if (cancelled) return;

        const registration = await fetch(`${BASE}/api/notifications/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            token: pushTokenObj.data,
            platform: Platform.OS,
          }),
        });
        if (!registration.ok && registration.status !== 401 && registration.status !== 403) {
          console.warn('[push] token registration rejected', { status: registration.status });
        } else if (registration.ok) {
          await AsyncStorage.setItem('oncallfoot_push_token', pushTokenObj.data);
        }
      } catch (err) {
        // Non-fatal — provider can still use the app without push
        console.warn('[push] registration failed:', err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, [token, canReceivePush]);

  // ── Handle notification tap → navigate to Bookings ─────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as {
        bookingId?: unknown;
        screen?: unknown;
      };
      const bookingId = typeof data.bookingId === 'number' || typeof data.bookingId === 'string'
        ? Number(data.bookingId)
        : NaN;

      // Booking detail performs the authenticated ownership/role check server-side.
      if (data.screen === 'booking' && Number.isInteger(bookingId) && bookingId > 0) {
        router.push(`/booking/${bookingId}`);
      } else {
        router.push('/(tabs)/bookings');
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    });

    return () => sub.remove();
  }, []);
}
