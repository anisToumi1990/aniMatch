import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor } from '@/constants/Colors';
import { formatLongDate, weekdayName } from '@/lib/auraWeek';

interface AuraHeroProps {
  animalName: string;
  /** The selected day ("YYYY-MM-DD"). */
  localDate: string;
  isToday: boolean;
}

/** Home's top block: the aura avatar glowing over a radial wash of its color, the date and the animal. */
export function AuraHero({ animalName, localDate, isToday }: AuraHeroProps) {
  const auraColor = getAuraColor(animalName);
  // Unique per instance so two heroes never share a gradient id (web renders them in one document).
  const gradientId = `aura-hero-${useId().replace(/:/g, '')}`;

  return (
    <View style={styles.container}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="38%" rx="62%" ry="58%">
            <Stop offset="0" stopColor={auraColor} stopOpacity={0.38} />
            <Stop offset="0.55" stopColor={auraColor} stopOpacity={0.1} />
            <Stop offset="1" stopColor={auraColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>

      <View style={[styles.glow, { shadowColor: auraColor }]}>
        <AuraAvatar animalName={animalName} size="large" />
      </View>

      <ThemedText type="secondary" style={styles.date}>{formatLongDate(localDate)}</ThemedText>
      <ThemedText style={styles.title}>
        {isToday ? 'Today' : weekdayName(localDate)}
        <ThemedText style={styles.dot}>{'  ·  '}</ThemedText>
        <ThemedText style={[styles.title, { color: auraColor }]}>{animalName}</ThemedText>
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  glow: {
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 36,
    marginBottom: 18,
  },
  date: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '500',
    color: Colors.text,
  },
  dot: {
    fontSize: 24,
    lineHeight: 32,
    color: Colors.textMuted,
  },
});
