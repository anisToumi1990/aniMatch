import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, withAlpha } from '@/constants/Colors';

export default function BlurTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
      {/* Tint the blur toward the app background so the bar reads as #0E0F13. */}
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </View>
  );
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}

const styles = StyleSheet.create({
  tint: {
    backgroundColor: withAlpha(Colors.background, 0.88),
  },
});
