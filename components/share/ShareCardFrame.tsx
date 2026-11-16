import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, withAlpha } from '@/constants/Colors';
import { getDisplayAppUrl } from '@/constants/AppLinks';

/** Layout size of a share card in points. Exported at 3x: 1080 x 1920 (9:16). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;
export const SHARE_CARD_EXPORT_WIDTH = 1080;

interface ShareCardFrameProps {
  /** Aura color the dark background is tinted with. */
  tintColor: string;
  /** Second tint for the bottom of the card (defaults to tintColor). */
  secondaryTintColor?: string;
  /** Call to action above the app link, e.g. "What's your aura?" */
  footerTitle: string;
  children: React.ReactNode;
}

/**
 * The 9:16 "Aura glow" story frame shared by every share card: dark background
 * softly tinted with the aura color, wordmark on top, call to action and app
 * link at the bottom. Uses plain Text so it renders the same when captured.
 */
export function ShareCardFrame({ tintColor, secondaryTintColor, footerTitle, children }: ShareCardFrameProps) {
  const bottomTint = secondaryTintColor ?? tintColor;

  return (
    <View style={styles.card} collapsable={false}>
      <LinearGradient
        colors={[
          withAlpha(tintColor, 0.3),
          withAlpha(tintColor, 0.14),
          withAlpha(tintColor, 0.08),
          withAlpha(bottomTint, 0.1),
          withAlpha(bottomTint, 0.2),
        ]}
        locations={[0, 0.3, 0.55, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Text style={styles.wordmark}>ANIMATCH</Text>
      <View style={styles.content}>{children}</View>
      <View style={styles.footer}>
        <View style={[styles.footerLine, { backgroundColor: withAlpha(tintColor, 0.5) }]} />
        <Text style={styles.footerTitle}>{footerTitle}</Text>
        <Text style={styles.footerLink}>{getDisplayAppUrl()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 40,
  },
  wordmark: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 5,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
    marginBottom: 16,
  },
  footerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  footerLink: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
});
