import React from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { getAuraImage } from '@/constants/AuraImages';

export type AuraAvatarSize = 'small' | 'medium' | 'large';

interface AuraAvatarProps {
  /** Animal name, e.g. "Fox" (case-insensitive). Picks the image and aura color. */
  animalName: string;
  /** small: lists, medium: carousel, large: results / popup. */
  size?: AuraAvatarSize;
  style?: StyleProp<ViewStyle>;
}

interface SizeSpec {
  /** Diameter of the dark circle holding the image. */
  core: number;
  /** Space between the core and each ring. */
  ringGap: number;
  /** Width of the colored border around the core. */
  borderWidth: number;
}

const SIZES: Record<AuraAvatarSize, SizeSpec> = {
  small: { core: 44, ringGap: 4, borderWidth: 1 },
  medium: { core: 68, ringGap: 7, borderWidth: 1.5 },
  large: { core: 120, ringGap: 12, borderWidth: 2 },
};

/**
 * An animal image in a dark circle with a thin border in its aura color,
 * surrounded by two soft concentric rings of that color (the "aura").
 */
export function AuraAvatar({ animalName, size = 'medium', style }: AuraAvatarProps) {
  const { core, ringGap, borderWidth } = SIZES[size];
  const auraColor = getAuraColor(animalName);
  const imageSource = getAuraImage(animalName);

  const innerRing = core + ringGap * 2;
  const outerRing = core + ringGap * 4;

  return (
    <View
      style={[styles.container, { width: outerRing, height: outerRing }, style]}
      accessibilityRole="image"
      accessibilityLabel={`${animalName} aura`}
    >
      <View
        style={[
          styles.ring,
          {
            width: outerRing,
            height: outerRing,
            borderRadius: outerRing / 2,
            borderColor: withAlpha(auraColor, 0.12),
            backgroundColor: withAlpha(auraColor, 0.04),
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: innerRing,
            height: innerRing,
            borderRadius: innerRing / 2,
            borderColor: withAlpha(auraColor, 0.24),
            backgroundColor: withAlpha(auraColor, 0.07),
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: core,
            height: core,
            borderRadius: core / 2,
            padding: Math.round(core * 0.14),
            borderWidth,
            borderColor: auraColor,
            shadowColor: auraColor,
            shadowRadius: ringGap * 1.5,
          },
        ]}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="contain" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    elevation: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
