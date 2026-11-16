import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { ShareCardFrame } from './ShareCardFrame';

interface AuraShareCardProps {
  /** First name of the person, or null to show "My aura is". */
  firstName: string | null;
  animalName: string;
  /** Comma-separated traits from `animal_auras.traits`; the first 3 are shown. */
  traits: string;
}

/** Up to 3 trimmed, non-empty traits. */
function getTopTraits(traits: string): string[] {
  return traits
    .split(',')
    .map(trait => trait.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** "My aura" story card. */
export function AuraShareCard({ firstName, animalName, traits }: AuraShareCardProps) {
  const auraColor = getAuraColor(animalName);
  const heading = firstName ? `${firstName}'s aura is` : 'My aura is';

  return (
    <ShareCardFrame tintColor={auraColor} footerTitle="What's your aura?">
      <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
      <AuraAvatar animalName={animalName} size="xlarge" style={styles.avatar} />
      <Text style={[styles.animalName, { color: auraColor }]} numberOfLines={1}>{animalName}</Text>
      <View style={styles.traits}>
        {getTopTraits(traits).map(trait => (
          <View
            key={trait}
            style={[styles.chip, { borderColor: withAlpha(auraColor, 0.5), backgroundColor: withAlpha(auraColor, 0.12) }]}
          >
            <Text style={[styles.chipText, { color: auraColor }]}>{trait}</Text>
          </View>
        ))}
      </View>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  avatar: {
    marginBottom: 20,
  },
  animalName: {
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
});
