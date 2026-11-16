import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor } from '@/constants/Colors';
import { DailyPairTipsState, PairTipItem } from '@/hooks/useDailyPairTips';

/** How many matches the Home card shows before "See all". */
export const HOME_PAIR_TIPS_LIMIT = 3;

interface PairTipRowProps {
  item: PairTipItem;
  onPress: (item: PairTipItem) => void;
}

/** A match: their avatar, name in their aura color and today's tip. */
export function PairTipRow({ item, onPress }: PairTipRowProps) {
  const auraColor = getAuraColor(item.animalName);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.displayName}${item.animalName ? `, ${item.animalName}` : ''}. ${item.tip ?? 'No tip today.'} Open your match.`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      {item.animalName ? (
        <AuraAvatar animalName={item.animalName} size="small" />
      ) : (
        <View style={styles.avatarFallback}>
          <Ionicons name="person" size={18} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.rowText}>
        <ThemedText style={[styles.name, { color: auraColor }]} numberOfLines={1}>
          {item.displayName}
          {item.animalName ? <ThemedText type="muted" style={styles.animal}>{'  ·  '}{item.animalName}</ThemedText> : null}
        </ThemedText>
        <ThemedText type="secondary" style={styles.tip}>
          {item.tip ?? 'No tip today. Just be nice.'}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

interface NoMatchesProps {
  onInvite: () => void;
}

/** Empty state with a button that opens the invite form. */
export function NoMatchesInvite({ onInvite }: NoMatchesProps) {
  return (
    <View style={styles.empty}>
      <ThemedText type="secondary" style={styles.emptyText}>
        Invite someone to unlock daily pair tips 💞
      </ThemedText>
      <AuraButton label="Invite someone" icon="person-add-outline" variant="secondary" onPress={onInvite} style={styles.emptyButton} />
    </View>
  );
}

interface DailyPairSectionProps {
  state: DailyPairTipsState;
  onRetry: () => void;
  onOpenMatch: (item: PairTipItem) => void;
  onSeeAll: () => void;
  onInvite: () => void;
}

/** "💞 Today with your matches": section #2 of the daily aura card on Home. */
export function DailyPairSection({ state, onRetry, onOpenMatch, onSeeAll, onInvite }: DailyPairSectionProps) {
  return (
    <View>
      <ThemedText style={styles.title}>💞 Today with your matches</ThemedText>

      {state.status === 'loading' ? (
        <View style={styles.loading} accessibilityLabel="Loading today's pair tips">
          <ActivityIndicator size="small" color={Colors.textSecondary} />
        </View>
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

      {state.status === 'ready' && state.items.length === 0 ? <NoMatchesInvite onInvite={onInvite} /> : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <View style={styles.list}>
          {state.items.slice(0, HOME_PAIR_TIPS_LIMIT).map(item => (
            <PairTipRow key={item.otherUserId} item={item} onPress={onOpenMatch} />
          ))}
          {state.items.length > HOME_PAIR_TIPS_LIMIT ? (
            <Pressable
              onPress={onSeeAll}
              accessibilityRole="link"
              style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.7 }]}
            >
              <ThemedText style={styles.seeAllText}>See all ({state.items.length})</ThemedText>
              <Ionicons name="arrow-forward" size={14} color={Colors.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 12,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Colors.cardRaised,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  animal: {
    fontSize: 13,
    fontWeight: '400',
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    marginLeft: 2,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  inline: {
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
  empty: {
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
  },
  emptyButton: {
    minHeight: 40,
    paddingVertical: 8,
  },
});
