import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useListProviders } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type Provider = {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  city: string;
  rating: string;
  reviewCount: number;
  verificationStatus: string;
  acceptsNewClients: boolean;
  yearsExperience?: number | null;
  avatarUrl?: string | null;
};

function ProviderCard({ provider, colors }: { provider: Provider; colors: ReturnType<typeof useColors> }) {
  const initial = provider.firstName[0]?.toUpperCase() ?? '?';
  return (
    <TouchableOpacity
      onPress={() => router.push(`/provider/${provider.id}`)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        {provider.verificationStatus === 'approved' && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
            <Feather name="shield" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.providerName, { color: colors.foreground }]}>
          {provider.firstName} {provider.lastName}
        </Text>
        <Text style={[styles.providerTitle, { color: colors.primary }]} numberOfLines={1}>
          {provider.title}
        </Text>
        <View style={styles.meta}>
          <Feather name="star" size={12} color={colors.accent} />
          <Text style={[styles.metaText, { color: colors.foreground }]}>
            {' '}{Number(provider.rating).toFixed(2)}
          </Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {' '}({provider.reviewCount})
          </Text>
          <Text style={[styles.metaSep, { color: colors.border }]}> · </Text>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}> {provider.city}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 400);
  };

  const { data, isLoading } = useListProviders(
    { city: debouncedSearch || undefined, verified: verifiedOnly || undefined },
    { query: { queryKey: ['providers', debouncedSearch, verifiedOnly] } }
  );

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Header */}
      <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <Text style={styles.heroTitle}>Professional foot care,{'\n'}in your home.</Text>
        <Text style={styles.heroSub}>Find certified specialists near you.</Text>

        <View style={[styles.searchBox, { backgroundColor: colors.card }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Search by city..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <TouchableOpacity
          style={styles.filterRow}
          onPress={() => setVerifiedOnly(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, { borderColor: '#ffffff80', backgroundColor: verifiedOnly ? '#fff' : 'transparent' }]}>
            {verifiedOnly && <Feather name="check" size={10} color={colors.primary} />}
          </View>
          <Text style={styles.filterLabel}>Verified providers only</Text>
        </TouchableOpacity>
      </View>

      {/* Provider List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.providers ?? []}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Available Providers
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="search" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No providers found</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try a different city or remove filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => <ProviderCard provider={item as Provider} colors={colors} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.9)',
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardBody: { flex: 1 },
  providerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  providerTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaSep: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 240 },
});
