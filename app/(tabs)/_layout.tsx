import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useQuiz } from '@/context/QuizContext';
import { useNotifications } from '@/context/NotificationsContext';
import { NotificationBell } from '@/components/NotificationBell';
import { toIconColor } from '@/components/ui/iconColor';

/**
 * Screens reachable by navigation but without a tab-bar button. In SDK 58's
 * JS tabs, `href: null` also makes the route unreachable (it falls back to /),
 * so only the button is hidden.
 */
const hiddenTabOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

export default function TabLayout() {
  const { isQuizComplete, directNavigateToQuiz, setDirectNavigateToQuiz } = useQuiz();
  const { pendingInviteCount, refreshCount } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  
  // Refresh the badge counts whenever another tab gets focus (no realtime yet).
  useEffect(() => {
    refreshCount();
  }, [pathname, refreshCount]);
  
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
      // Back from the notifications list returns to the tab it was opened from.
      backBehavior="history"
      screenOptions={{
        // Default header action on every tab; screens that set their own headerRight include the bell themselves.
        headerRight: () => <NotificationBell style={styles.headerBell} />,
        tabBarActiveTintColor: Colors.tabIconSelected,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarLabelStyle: { fontWeight: '500' },
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            borderTopColor: Colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          default: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
          },
        }),
        animation: 'none',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // The Home screen sets its header title to "AniMatch", which would otherwise become the tab label.
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="questionmark.circle.fill" color={color} />,
          tabBarButton: (props) => {
            // With a result, the Quiz tab opens the "Retake" confirmation instead of
            // the quiz. Not while already on the quiz (e.g. right after "Retake the quiz").
            const isCurrentlyOnQuizTab = pathname.includes('/quiz');
            const shouldConfirmRetake = isQuizComplete && !isCurrentlyOnQuizTab && !directNavigateToQuiz;

            return shouldConfirmRetake ? (
              <HapticTab
                {...props}
                href="/retake"
                onPress={() => router.navigate('/retake')}
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
          title: 'Animal aura',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} />,
          // Always opens: without a result, the screen shows the locked aura.
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
        name="invites"
        options={{
          title: 'Invites',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="person-add" size={26} color={toIconColor(color)} />
              {pendingInviteCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingInviteCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      {/* Opened from the header bell; not shown in the tab bar. */}
      <Tabs.Screen
        name="notifications"
        options={{
          ...hiddenTabOptions,
          title: 'Notifications',
        }}
      />
      {/* Opened by the Quiz tab when the user already has a result; not shown in the tab bar. */}
      <Tabs.Screen
        name="retake"
        options={{
          ...hiddenTabOptions,
          title: 'Retake the quiz',
        }}
      />
      {/* Opened from "See all" in Home's daily aura card; not shown in the tab bar. */}
      <Tabs.Screen
        name="pair-tips"
        options={{
          ...hiddenTabOptions,
          title: 'Today with your matches',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBell: {
    marginRight: 16,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
