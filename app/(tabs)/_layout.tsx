import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { AuraTab } from '@/components/AuraTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQuiz } from '@/context/QuizContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isQuizComplete, directNavigateToQuiz, setDirectNavigateToQuiz } = useQuiz();
  const pathname = usePathname();
  const router = useRouter();
  
  // Log the current path for debugging
  useEffect(() => {
    console.log('Current path:', pathname);
  }, [pathname]);
  
  // Handle direct navigation to quiz tab
  useEffect(() => {
    if (directNavigateToQuiz) {
      console.log('Direct navigation to quiz tab triggered');
      
      // Navigate directly to the quiz tab
      router.replace('/(tabs)/quiz');
      
      // Reset the flag after navigation
      setDirectNavigateToQuiz(false);
    }
  }, [directNavigateToQuiz, router, setDirectNavigateToQuiz]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Personality Quiz',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="questionmark.circle.fill" color={isQuizComplete ? `${color}80` : color} />,
          tabBarButton: (props) => {
            // Don't disable the tab if we're currently on it
            // This handles the case when navigating from "Retake Quiz"
            const isCurrentlyOnQuizTab = pathname.includes('/quiz');
            const shouldDisable = isQuizComplete && !isCurrentlyOnQuizTab && !directNavigateToQuiz;
            
            return shouldDisable ? (
              // When quiz is complete, disable this tab by making it non-interactive
              // but maintain proper layout and centering
              <HapticTab
                {...props}
                onPress={undefined}
                accessibilityState={{ disabled: true }}
              />
            ) : (
              <HapticTab {...props} />
            );
          },
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Your Animal Aura',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} />,
          tabBarButton: AuraTab,
        }}
      />
    </Tabs>
  );
}
