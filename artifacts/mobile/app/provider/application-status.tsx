import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useGetProviderApplication } from '@workspace/api-client-react';
import { useAuth } from '@/context/auth';
import { useColors } from '@/hooks/useColors';

const copy: Record<string, { title: string; body: string }> = {
  under_review: {
    title: 'Your application is with our review team',
    body: 'We are checking your profile and credentials so clients can book with confidence. We will update this space when there is a decision.',
  },
  rejected: {
    title: 'A little more information is needed',
    body: 'Your application needs an update before it can move forward. Review your profile and continue when you are ready.',
  },
  suspended: {
    title: 'Your provider application is paused',
    body: 'Provider access is currently paused. Please contact support if you need help understanding the next step.',
  },
};

export default function ProviderApplicationStatusScreen() {
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const query = useGetProviderApplication({
    query: { enabled: Boolean(user), retry: false, queryKey: ['provider-application'] },
  });
  const application = query.data?.application;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
    if (application?.status === 'draft') router.replace('/onboarding/provider');
    if (application?.status === 'approved') router.replace('/(tabs)/account');
  }, [application, authLoading, user]);

  if (authLoading || query.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const status = application?.status ?? 'under_review';
  const statusCopy = copy[status] ?? copy.under_review;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}>
        <Text style={styles.logoText}>O</Text>
      </View>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>APPLICATION STATUS</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{statusCopy.title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{statusCopy.body}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.foreground }]}>Current status</Text>
          <Text style={[styles.badge, { backgroundColor: colors.secondary, color: colors.foreground }]}>
            {status.replace('_', ' ')}
          </Text>
        </View>
        <Text style={[styles.cardText, { color: colors.mutedForeground }]}>
          You can still use your client account while provider review is in progress.
        </Text>
      </View>
      {status === 'rejected' && (
        <TouchableOpacity onPress={() => router.replace('/onboarding/provider')} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonText}>Update application</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.linkButton}>
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Continue as a client</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 78 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  logoText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 30 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, lineHeight: 34, textAlign: 'center', marginBottom: 14 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  card: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 26 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontFamily: 'Inter_600SemiBold', fontSize: 12, textTransform: 'capitalize' },
  cardText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 12 },
  button: { width: '100%', minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  linkButton: { paddingVertical: 18 },
  linkText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});