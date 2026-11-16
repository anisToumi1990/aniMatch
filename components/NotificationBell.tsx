import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/context/NotificationsContext';

interface NotificationBellProps {
  style?: StyleProp<ViewStyle>;
}

/** Header bell that opens the notifications list. Shows the unread count (hidden at 0). */
export function NotificationBell({ style }: NotificationBellProps) {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Pressable
      onPress={() => router.navigate('/notifications')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      style={({ pressed }) => [styles.button, style, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="notifications-outline" size={19} color={Colors.text} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
