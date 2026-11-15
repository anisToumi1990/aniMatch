import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ScreenBackgroundProps {
  children: React.ReactNode;
}

/** Plain dark screen background used by every screen. */
export function ScreenBackground({ children }: ScreenBackgroundProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
