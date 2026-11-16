import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ScreenBackground';
import { ThemedText } from '@/components/ThemedText';
import { InviteModal } from '@/components/InviteModal';
import { InviteLinkRoute } from '@/components/InviteForm';
import { NoMatchesInvite, PairTipRow } from '@/components/DailyPairTips';
import { Colors } from '@/constants/Colors';
import { PairTipItem, useDailyPairTips } from '@/hooks/useDailyPairTips';

/** Case-insensitive match on the person's name or their animal. */
function matchesQuery(item: PairTipItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.displayName} ${item.firstName} ${item.animalName ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

/** All matches with today's tip ("See all" from Home's daily aura card). */
export default function PairTipsScreen() {
  const router = useRouter();
  const { state, retry } = useDailyPairTips();
  const [query, setQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const items = useMemo(
    () => (state.status === 'ready' ? state.items.filter(item => matchesQuery(item, normalizedQuery)) : []),
    [state, normalizedQuery],
  );

  function handleOpenMatch(item: PairTipItem) {
    router.navigate({ pathname: '/compatibility', params: { resultId: String(item.resultId) } });
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/');
  }

  function handleInviteLink(route: InviteLinkRoute) {
    router.navigate(route);
  }

  const hasMatches = state.status === 'ready' && state.items.length > 0;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        {/* Own header (back + full title) instead of the tab header, which truncated
            the title and had no back button on this hidden tab. */}
        <Stack.Screen options={{ headerShown: false, title: 'Today with your matches' }} />
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle} accessibilityRole="header" numberOfLines={2}>
            Today with your matches
          </ThemedText>
        </View>
        <View style={styles.content}>
          {hasMatches ? (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={Colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or animal"
                placeholderTextColor={Colors.textMuted}
                keyboardAppearance="dark"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search matches by name or animal"
                style={styles.searchInput}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {state.status === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.textSecondary} />
            </View>
          ) : null}

          {state.status === 'error' ? (
            <View style={styles.center} accessibilityLiveRegion="polite">
              <ThemedText style={styles.errorText}>Couldn&apos;t load your matches&apos; tips.</ThemedText>
              <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
                <Ionicons name="refresh" size={14} color={Colors.text} />
                <ThemedText style={styles.retryText}>Try again</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {state.status === 'ready' && state.items.length === 0 ? (
            <View style={styles.emptyCard}>
              <NoMatchesInvite onInvite={() => setIsInviteOpen(true)} />
            </View>
          ) : null}

          {hasMatches ? (
            <FlatList
              data={items}
              keyExtractor={item => item.otherUserId}
              renderItem={({ item }) => <PairTipRow item={item} onPress={handleOpenMatch} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText type="secondary" style={styles.noResults}>
                  No match for &ldquo;{query.trim()}&rdquo;.
                </ThemedText>
              }
            />
          ) : null}
        </View>
        <InviteModal visible={isInviteOpen} onClose={() => setIsInviteOpen(false)} onLinkPress={handleInviteLink} />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    paddingRight: 12,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  list: {
    paddingBottom: 32,
  },
  separator: {
    height: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 24,
  },
});
