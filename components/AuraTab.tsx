import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useQuiz } from '@/context/QuizContext';
import { Alert } from 'react-native';

export function AuraTab(props: BottomTabBarButtonProps) {
  const { animalAura, isQuizComplete } = useQuiz();
  const hasResult = isQuizComplete && animalAura;

  return (
    <PlatformPressable
      {...props}
      disabled={!hasResult}
      style={[props.style, { opacity: hasResult ? 1 : 0.5 }]}
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
        props.onPressIn?.(ev);
      }}
    />
  );
} 