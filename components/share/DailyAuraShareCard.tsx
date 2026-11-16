import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { ShareCardFrame } from './ShareCardFrame';

interface DailyAuraShareCardProps {
  animalName: string;
  message: string;
  doText: string;
  dontText: string;
}

/** "Today's aura" story card. Like the other share cards, no emojis. */
export function DailyAuraShareCard({ animalName, message, doText, dontText }: DailyAuraShareCardProps) {
  const auraColor = getAuraColor(animalName);

  return (
    <ShareCardFrame tintColor={auraColor} footerTitle="What's your aura?">
      <Text style={styles.eyebrow}>
        TODAY <Text style={styles.dot}>·</Text> <Text style={{ color: auraColor }}>{animalName.toUpperCase()}</Text>
      </Text>
      <AuraAvatar animalName={animalName} size="large" style={styles.avatar} />
      <Text style={styles.message}>{message}</Text>
      <View style={styles.rows}>
        <View style={[styles.row, { borderColor: withAlpha(auraColor, 0.35) }]}>
          <Text style={[styles.label, { color: Colors.success }]}>DO</Text>
          <Text style={styles.rowText}>{doText}</Text>
        </View>
        <View style={[styles.row, { borderColor: withAlpha(auraColor, 0.35) }]}>
          <Text style={[styles.label, { color: Colors.danger }]}>DON&apos;T</Text>
          <Text style={styles.rowText}>{dontText}</Text>
        </View>
      </View>
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
  rows: {
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: withAlpha(Colors.card, 0.6),
  },
  label: {
    width: 52,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
  },
});
