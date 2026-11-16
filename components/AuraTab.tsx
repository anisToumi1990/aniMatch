import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { withClientSideTabPress } from './tabBarPress';
import { useQuiz } from '@/context/QuizContext';
import { Alert } from 'react-native';

export function AuraTab(props: BottomTabBarButtonProps) {
  const { animalAura, isQuizComplete } = useQuiz();
  const hasResult = isQuizComplete && animalAura;

  // Omit ref from props to avoid linter error
  const { style, onPress, onPressIn, ref, href, ...rest } = props;

  return (
    <Pressable
      {...rest}
      // Without a result the tab is disabled; drop its link (web only) so the browser can't follow it.
      {...(hasResult && href ? { href } : {})}
      style={[style, { opacity: hasResult ? 1 : 0.5 }]}
      disabled={!hasResult}
      onPressIn={(ev) => {
        if (!hasResult) {
          // Show alert instead of navigating
          Alert.alert(
            'No Animal Aura Yet',
            'Complete the Personality Quiz first to discover your Animal Aura!',
            [{ text: 'OK' }]
          );
          return;
        }
        
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
      // Client-side navigation on web instead of following the tab's href (full reload).
      onPress={withClientSideTabPress(onPress)}
      accessibilityState={{ disabled: !hasResult }}
    />
  );
} 