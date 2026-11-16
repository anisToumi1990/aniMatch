import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCardFrame';

interface ShareCardHostProps {
  children: React.ReactNode;
}

/**
 * Renders a share card off screen so it can be captured as an image without
 * being visible. The ref points at the card itself.
 */
export const ShareCardHost = React.forwardRef<View, ShareCardHostProps>(function ShareCardHost({ children }, ref) {
  return (
    <View
      style={styles.host}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View ref={ref} collapsable={false}>
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: -10000,
    pointerEvents: 'none',
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  },
});
