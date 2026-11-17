import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { DailyPairTipsState, PairTipItem } from '@/hooks/useDailyPairTips';

interface MatchesRowProps {
  state: DailyPairTipsState;
  onRetry: () => void;
  onInvite: () => void;
  onSeeAll: () => void;
  onOpenMatch: (item: PairTipItem) => void;
}

/**
 * "Today with your matches": a horizontal row of round avatars (aura-colored
 * rings) ending with "+ Invite". Tapping an avatar shows that match's tip below.
 */
export function MatchesRow({ state, onRetry, onInvite, onSeeAll, onOpenMatch }: MatchesRowProps) {
  const items = state.status === 'ready' ? state.items : [];
  const [chosenId, setChosenId] = useState<string | null>(null);
  // The tapped match while it's still in the list, else the first one.
  const selectedId = items.some(item => item.otherUserId === chosenId) ? chosenId : items[0]?.otherUserId ?? null;
  const selected = items.find(item => item.otherUserId === selectedId) ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>💞 Today with your matches</ThemedText>
        {items.length > 0 ? (
          <Pressable onPress={onSeeAll} accessibilityRole="link" hitSlop={8} style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.7 }]}>
            <ThemedText style={styles.seeAllText}>See all ({items.length})</ThemedText>
            <Ionicons name="arrow-forward" size={13} color={Colors.text} />
          </Pressable>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.inline}><ActivityIndicator size="small" color={Colors.textSecondary} /></View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.inline} accessibilityLiveRegion="polite">
          <ThemedText style={styles.errorText}>Couldn&apos;t load your matches&apos; tips.</ThemedText>
          <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
            <Ionicons name="refresh" size={14} color={Colors.text} />
            <ThemedText style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {items.map(item => {
              const isSelected = item.otherUserId === selectedId;
              const auraColor = getAuraColor(item.animalName);
              return (
                <Pressable
                  key={item.otherUserId}
                  onPress={() => setChosenId(item.otherUserId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName}${item.animalName ? `, ${item.animalName}` : ''}. Show today's tip`}
                  aria-selected={isSelected}
                  style={({ pressed }) => [styles.person, pressed && { opacity: 0.8 }]}
                >
                  <View style={[styles.ring, { borderColor: isSelected ? auraColor : withAlpha(auraColor, 0.35) }]}>
                    {item.animalName ? (
                      <AuraAvatar animalName={item.animalName} size="small" />
                    ) : (
                      <View style={styles.fallback}><Ionicons name="person" size={20} color={Colors.textMuted} /></View>
                    )}
                  </View>
                  <ThemedText style={[styles.name, isSelected && { color: auraColor }]} numberOfLines={1}>
                    {item.firstName}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={onInvite}
              accessibilityRole="button"
              accessibilityLabel="Invite someone"
              style={({ pressed }) => [styles.person, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.ring, styles.inviteRing]}>
                <Ionicons name="add" size={26} color={Colors.text} />
              </View>
              <ThemedText style={styles.name}>Invite</ThemedText>
            </Pressable>
          </ScrollView>

          {selected ? (
            <Pressable
              onPress={() => onOpenMatch(selected)}
              accessibilityRole="button"
              accessibilityLabel={`${selected.displayName}. ${selected.tip ?? 'No tip today.'} Open your match.`}
              style={({ pressed }) => [
                styles.tipCard,
                { borderColor: withAlpha(getAuraColor(selected.animalName), 0.4) },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.tipHeader}>
                <ThemedText style={[styles.tipName, { color: getAuraColor(selected.animalName) }]} numberOfLines={1}>
                  {selected.displayName}
                  {selected.animalName ? <ThemedText type="muted" style={styles.tipAnimal}>{'  ·  '}{selected.animalName}</ThemedText> : null}
                </ThemedText>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
              <ThemedText type="secondary" style={styles.tipText}>{selected.tip ?? 'No tip today. Just be nice.'}</ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="secondary" style={styles.emptyText}>Invite someone to unlock daily pair tips 💞</ThemedText>
          )}
        </>
      ) : null}
    </View>
  );
}

const RING = 64;

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  row: {
    gap: 14,
    paddingBottom: 4,
    paddingRight: 4,
  },
  person: {
    width: RING + 6,
    alignItems: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  inviteRing: {
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    backgroundColor: Colors.card,
  },
  fallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  name: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    maxWidth: RING + 6,
  },
  tipCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tipName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  tipAnimal: {
    fontSize: 13,
    fontWeight: '400',
  },
  tipText: {
    fontSize: 15,
    lineHeight: 21,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
  },
  inline: {
    paddingVertical: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.danger,
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
});
