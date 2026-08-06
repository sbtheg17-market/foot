import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ProviderApplicationDetail,
  useCreateProviderApplication,
  useGetProviderApplication,
  useSubmitProviderApplication,
  useUpdateProviderApplication,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';

function apiError(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { error?: string } } };
  return response.response?.data?.error ?? fallback;
}

export default function ProviderOnboardingScreen() {
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const hasProviderRole = Boolean(user?.roles?.includes('provider') || user?.role === 'provider');
  const applicationQuery = useGetProviderApplication({
    query: { enabled: hasProviderRole, retry: false, queryKey: ['provider-application'] },
  });
  const createApplication = useCreateProviderApplication();
  const updateApplication = useUpdateProviderApplication();
  const submitApplication = useSubmitProviderApplication();
  const startedRef = useRef(false);
  const [application, setApplication] = useState<ProviderApplicationDetail | null>(null);
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (applicationQuery.data?.application) setApplication(applicationQuery.data.application);
  }, [applicationQuery.data]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
    if (user && !hasProviderRole && !startedRef.current) {
      startedRef.current = true;
      createApplication.mutate(undefined, {
        onSuccess: (result) => setApplication(result.application),
        onError: (err) => setError(apiError(err, 'We could not start provider onboarding.')),
      });
    }
  }, [authLoading, createApplication, hasProviderRole, user]);

  useEffect(() => {
    const profile = application?.profile;
    if (!profile) return;
    setTitle(profile.title);
    setBio(profile.bio ?? '');
    setCity(profile.city);
    setYearsExperience(profile.yearsExperience?.toString() ?? '');
    if (application.status === 'approved') router.replace('/(tabs)/account');
    if (application.status === 'under_review') router.replace('/provider/application-status');
  }, [application]);

  const busy = createApplication.isPending || updateApplication.isPending || submitApplication.isPending;
  const essentials = [title.trim(), bio.trim(), city.trim()].filter(Boolean).length;

  const save = (submit: boolean) => {
    setError('');
    setSaved(false);
    if (!title.trim() || !bio.trim() || !city.trim()) {
      setError('Add a title, short bio, and city before continuing.');
      return;
    }
    updateApplication.mutate(
      {
        data: {
          currentStep: submit ? 'submitted' : 'profile',
          title: title.trim(),
          bio: bio.trim(),
          city: city.trim(),
          yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
        },
      },
      {
        onSuccess: (result) => {
          setApplication(result.application);
          if (!submit) {
            setSaved(true);
            return;
          }
          submitApplication.mutate(undefined, {
            onSuccess: () => router.replace('/provider/application-status'),
            onError: (err) => setError(apiError(err, 'We could not submit your application.')),
          });
        },
        onError: (err) => setError(apiError(err, 'We could not save your progress.')),
      },
    );
  };

  if (authLoading || applicationQuery.isLoading || createApplication.isPending || !application) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Preparing your provider workspace…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PROVIDER ONBOARDING</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Start with your professional profile</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Share the essentials first. You can add services, availability, and credentials as you continue.
        </Text>

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: colors.foreground }]}>Profile step</Text>
            <Text style={[styles.progressCount, { color: colors.mutedForeground }]}>{essentials}/3 essentials</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { width: `${(essentials / 3) * 100}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
        {!!saved && <Text accessibilityRole="alert" style={[styles.saved, { color: colors.primary }]}>Your progress is saved.</Text>}

        <Field label="Professional title" value={title} onChangeText={setTitle} placeholder="Certified mobile foot-care specialist" colors={colors} />
        <Field label="Short bio" value={bio} onChangeText={setBio} placeholder="Tell clients what kind of care you provide." multiline colors={colors} />
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Primary city" value={city} onChangeText={setCity} placeholder="Austin" colors={colors} />
          </View>
          <View style={styles.column}>
            <Field label="Years of experience" value={yearsExperience} onChangeText={setYearsExperience} placeholder="Optional" keyboardType="number-pad" colors={colors} />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => save(false)}
            disabled={busy}
            style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: busy ? 0.6 : 1 }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{updateApplication.isPending ? 'Saving…' : 'Save for later'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => save(true)}
            disabled={busy}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit for review</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.returnButton}>
          <Text style={[styles.returnText, { color: colors.mutedForeground }]}>Return to client experience</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'number-pad';
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={multiline ? 2000 : 120}
        style={[
          styles.input,
          multiline && styles.textArea,
          { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.5, marginBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 35, marginBottom: 10 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  progressCount: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  saved: { fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 14 },
  field: { marginBottom: 16 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 15 },
  textArea: { minHeight: 118, textAlignVertical: 'top' },
  twoColumn: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  actions: { gap: 10, marginTop: 4 },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  secondaryButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  returnButton: { alignItems: 'center', paddingVertical: 18 },
  returnText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});