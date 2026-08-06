import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';
import { useCreateProviderApplication } from '@workspace/api-client-react';

function MenuItem({ icon, label, onPress, colors, danger }: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      activeOpacity={0.6}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.destructive + '15' : colors.secondary }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      {!danger && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const createApplication = useCreateProviderApplication();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
  };

  const handleBecomeProvider = () => {
    createApplication.mutate(undefined, {
      onSuccess: () => router.push('/onboarding/provider'),
      onError: () => {},
    });
  };

  if (!user) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>O</Text>
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>OnCall Foot</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Professional care, at your door.
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/auth/register')}
          style={[styles.secondaryBtn, { borderColor: colors.primary }]}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Create account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={[styles.profileHeader, { paddingTop: topPad + 16, backgroundColor: colors.primary }]}>
        <View style={styles.initialsCircle}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
        <View style={[styles.roleBadge]}>
          <Text style={styles.roleText}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {user.role === 'client' && (
          <MenuItem icon="calendar" label="My Bookings" onPress={() => router.push('/bookings')} colors={colors} />
        )}
        {user.role === 'client' && (
          <MenuItem
            icon="briefcase"
            label={createApplication.isPending ? 'Starting provider onboarding…' : 'Become a provider'}
            onPress={handleBecomeProvider}
            colors={colors}
          />
        )}
        {user.role === 'provider' && (
          <MenuItem icon="briefcase" label="Provider Portal" onPress={() => {}} colors={colors} />
        )}
        <MenuItem icon="file-text" label="Invoices" onPress={() => {}} colors={colors} />
      </View>

      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
        <MenuItem icon="log-out" label="Sign out" onPress={handleLogout} colors={colors} danger />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>OnCall Foot v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 12,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logoText: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#fff' },
  appName: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24 },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  initialsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  initialsText: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  profileName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 2 },
  profileEmail: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginBottom: 10 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  version: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 24 },
});
