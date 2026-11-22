import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { ShareCardFrame } from './ShareCardFrame';

interface DailyAuraShareCardProps {
  animalName: string;
  /** Today's date, e.g. "Monday, 16 November". */
  dateLabel: string;
  message: string;
  /** "Today's action" and why it helps; the block is left out when there's no action. */
  actionText: string | null;
  actionWhy: string | null;
}

/** "Today's aura" story card: message, then today's action and why. Like the other share cards, no emojis. */
export function DailyAuraShareCard({ animalName, dateLabel, message, actionText, actionWhy }: DailyAuraShareCardProps) {
  const auraColor = getAuraColor(animalName);

  return (
    <ShareCardFrame tintColor={auraColor} footerTitle="What's your aura?">
      <Text style={styles.eyebrow}>
        TODAY <Text style={styles.dot}>·</Text> <Text style={{ color: auraColor }}>{animalName.toUpperCase()}</Text>
      </Text>
      <Text style={styles.date}>{dateLabel}</Text>
      <AuraAvatar animalName={animalName} size="large" style={styles.avatar} />
      <Text style={styles.message}>{message}</Text>
      {actionText ? (
        <View style={[styles.action, { borderColor: withAlpha(auraColor, 0.35) }]}>
          <Text style={[styles.label, { color: auraColor }]}>TODAY&apos;S ACTION</Text>
          <Text style={styles.actionText}>{actionText}</Text>
          {actionWhy ? <Text style={styles.actionWhy}>{actionWhy}</Text> : null}
        </View>
      ) : null}
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 3,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  dot: {
    color: Colors.textMuted,
  },
  avatar: {
    marginBottom: 16,
  },
  message: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  action: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: withAlpha(Colors.card, 0.6),
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: Colors.text,
  },
  actionWhy: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
