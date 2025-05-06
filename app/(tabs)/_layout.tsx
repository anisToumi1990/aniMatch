import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { AuraTab } from '@/components/AuraTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useQuiz } from '@/context/QuizContext';
import { useNotifications } from '@/context/NotificationsContext';

export default function TabLayout() {
  const { isQuizComplete, directNavigateToQuiz, setDirectNavigateToQuiz } = useQuiz();
  const { unreadCount } = useNotifications();
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
        tabBarActiveTintColor: Colors.tint,
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
        animation: 'none',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
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
      <Tabs.Screen
        name="compatibility"
        options={{
          title: 'Compatibility',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => (
            <View>
              <IconSymbol size={28} name="bell.fill" color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: 'Invite',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="envelope.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
