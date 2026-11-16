import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/Colors';

interface LockedAuraAvatarProps {
  style?: StyleProp<ViewStyle>;
}

const CORE = 120;
const RING_GAP = 12;
const INNER_RING = CORE + RING_GAP * 2;
const OUTER_RING = CORE + RING_GAP * 4;

/** Same shape as a large AuraAvatar, in neutral grey with a lock: an aura not discovered yet. */
export function LockedAuraAvatar({ style }: LockedAuraAvatarProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="image" accessibilityLabel="Locked aura">
      <View style={[styles.ring, styles.outerRing]} />
      <View style={[styles.ring, styles.innerRing]} />
      <View style={styles.core}>
        <Ionicons name="lock-closed" size={40} color={Colors.textSecondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: OUTER_RING,
    height: OUTER_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  outerRing: {
    width: OUTER_RING,
    height: OUTER_RING,
    borderRadius: OUTER_RING / 2,
    borderColor: withAlpha(Colors.textMuted, 0.2),
    backgroundColor: withAlpha(Colors.textMuted, 0.03),
  },
  innerRing: {
    width: INNER_RING,
    height: INNER_RING,
    borderRadius: INNER_RING / 2,
    borderColor: withAlpha(Colors.textMuted, 0.35),
    backgroundColor: withAlpha(Colors.textMuted, 0.06),
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
});
