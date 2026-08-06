import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/auth';
import { register as apiRegister } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { login } = useAuth();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRegister({ firstName, lastName, email: email.trim().toLowerCase(), password, role });
      await login(result.token, result.user as any);
      qc.invalidateQueries();
      if (result.user.role === 'client') {
        router.back();
      } else {
        router.replace('/(tabs)/account');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Could not create account. Please try again.';
      Alert.alert('Registration failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.closeBtn, { top: topPad + 8 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPad + 60, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>O</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join OnCall Foot today</Text>

        {/* Role toggle */}
        <View style={[styles.roleToggle, { backgroundColor: colors.secondary }]}>
          {(['client', 'provider'] as const).map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleOption, role === r && { backgroundColor: colors.card }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleLabel, { color: role === r ? colors.foreground : colors.mutedForeground, fontFamily: role === r ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {r === 'client' ? 'Client' : 'Provider'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InputRow label="First name" value={firstName} onChange={setFirstName} placeholder="Jane" colors={colors} />
          <InputRow label="Last name" value={lastName} onChange={setLastName} placeholder="Smith" colors={colors} />
          <InputRow label="Email" value={email} onChange={setEmail} placeholder="jane@example.com" colors={colors} keyboard="email-address" autoCapitalize="none" />
          <InputRow label="Password" value={password} onChange={setPassword} placeholder="8+ characters" colors={colors} secure last />
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Create account</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function InputRow({ label, value, onChange, placeholder, colors, keyboard, autoCapitalize, secure, last }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
  keyboard?: any;
  autoCapitalize?: any;
  secure?: boolean;
  last?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.inputWrap, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.inputRight}>
        <TextInput
          style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          autoCapitalize={autoCapitalize ?? 'words'}
          secureTextEntry={secure && !show}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name={show ? 'eye-off' : 'eye'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { position: 'absolute', right: 20, zIndex: 10 },
  content: { paddingHorizontal: 24, alignItems: 'center' },
  logo: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logoText: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 24, textAlign: 'center' },
  roleToggle: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 20, width: '100%' },
  roleOption: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  roleLabel: { fontSize: 14 },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  inputLabel: { width: 90, fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputRight: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15 },
  submitBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  submitBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
