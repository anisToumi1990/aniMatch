import { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { withClientSideTabPress } from './tabBarPress';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { style, onPress, onPressIn, ref, ...rest } = props;
  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
      // Client-side navigation on web instead of following the tab's href (full reload).
      onPress={withClientSideTabPress(onPress)}
    />
  );
}
