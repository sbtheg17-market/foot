import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

/**
 * Requests push-notification permission and registers the device's Expo
 * push token with the API server.  Only runs when the user is a provider
 * and only on native (iOS / Android) — expo-notifications is not available
 * on web.
 *
 * Also wires up a notification-tap handler that navigates to the Bookings
 * tab so providers can act on a new-booking alert immediately.
 */
export function usePushNotifications(
  token: string | null,
  isProvider: boolean
) {
  // ── Register push token on login ───────────────────────────────────────────
  useEffect(() => {
    if (!token || !isProvider || Platform.OS === 'web') return;

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

        await fetch(`${BASE}/api/notifications/register-token`, {
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
      } catch (err) {
        // Non-fatal — provider can still use the app without push
        console.warn('[push] registration failed:', err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, [token, isProvider]);

  // ── Handle notification tap → navigate to Bookings ─────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/bookings');
    });

    return () => sub.remove();
  }, []);
}
