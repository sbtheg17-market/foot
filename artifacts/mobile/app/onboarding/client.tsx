import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function ClientOnboardingScreen() {
  const colors = useColors();

  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.spinner, { borderColor: colors.primary, borderTopColor: 'transparent' }]} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>Taking you to your care space…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  spinner: { width: 32, height: 32, borderWidth: 4, borderRadius: 16 },
  text: { fontFamily: 'Inter_400Regular', fontSize: 14 },
});