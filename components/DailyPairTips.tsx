import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor } from '@/constants/Colors';
import { PairTipItem } from '@/hooks/useDailyPairTips';

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

const styles = StyleSheet.create({
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
