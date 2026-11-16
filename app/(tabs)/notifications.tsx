import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { ScreenBackground } from '@/components/ScreenBackground';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { formatRelativeTime } from '@/lib/relativeTime';
import {
  AppNotification,
  fetchNotifications,
  getDisplayText,
  getNotificationRoute,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/supabase/notifications';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICONS: Record<string, IoniconName> = {
  invite_received: 'mail-unread-outline',
  invite_accepted: 'checkmark-circle-outline',
  match_ready: 'sparkles-outline',
};

/** Inline feedback (no Alert.alert, so it works on web). */
interface InlineMessage {
  kind: 'error' | 'info';
  text: string;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const { refreshCount } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [message, setMessage] = useState<InlineMessage | null>(null);
  // Re-render every minute so "5m ago" stays current.
  const [now, setNow] = useState(() => new Date());
  const loadIdRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const loadId = ++loadIdRef.current;
    try {
      const rows = await fetchNotifications(userId);
      if (loadId !== loadIdRef.current) return;
      setNotifications(rows);
      setMessage(current => (current?.kind === 'error' ? null : current));
    } catch (error) {
      console.error('Error loading notifications:', error);
      if (loadId === loadIdRef.current) {
        setMessage({ kind: 'error', text: "We couldn't load your notifications. Pull to try again." });
      }
    } finally {
      if (loadId === loadIdRef.current) {
        setIsLoading(false);
        setNow(new Date());
      }
    }
    refreshCount();
  }, [userId, refreshCount]);

  // Refresh on focus and when the app comes back to the foreground (no realtime yet).
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') loadNotifications();
      });
      return () => subscription.remove();
    }, [loadNotifications]),
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(notification => !notification.read_at).length;

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  }

  async function handlePress(notification: AppNotification) {
    const route = getNotificationRoute(notification);
    if (!notification.read_at) {
      // Optimistic: show it as read right away.
      const readAt = new Date().toISOString();
      setNotifications(current =>
        current.map(item => (item.id === notification.id ? { ...item, read_at: readAt } : item)),
      );
      try {
        await markNotificationRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
        setNotifications(current =>
          current.map(item => (item.id === notification.id ? { ...item, read_at: null } : item)),
        );
        setMessage({ kind: 'error', text: "Couldn't mark that as read. Try again in a moment." });
        return;
      }
      refreshCount();
    }
    if (route) router.navigate(route);
  }

  async function handleMarkAllRead() {
    if (!userId || unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications(current => current.map(item => (item.read_at ? item : { ...item, read_at: readAt })));
    try {
      await markAllNotificationsRead(userId);
      setMessage({ kind: 'info', text: 'All caught up. Suspiciously calm in here.' });
      refreshCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setNotifications(previous);
      setMessage({ kind: 'error', text: "Couldn't mark everything as read. Try again in a moment." });
    } finally {
      setIsMarkingAll(false);
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/');
  }

  function renderItem({ item }: { item: AppNotification }) {
    const { title, body } = getDisplayText(item);
    const isUnread = !item.read_at;
    const animal = item.data?.actor_animal ?? null;
    const accentColor = animal ? getAuraColor(animal) : Colors.textSecondary;
    const icon = TYPE_ICONS[item.type ?? ''] ?? 'notifications-outline';

    return (
      <Pressable
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${title}. ${body}`}
        style={({ pressed }) => [
          styles.card,
          isUnread && { borderColor: withAlpha(accentColor, 0.45), backgroundColor: Colors.cardRaised },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.leading}>
          {animal ? (
            <AuraAvatar animalName={animal} size="small" />
          ) : (
            <View style={styles.iconCircle}>
              <Ionicons name={icon} size={20} color={Colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, !isUnread && styles.titleRead]} numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText type="muted" style={styles.time}>{formatRelativeTime(item.created_at, now)}</ThemedText>
          </View>
          <ThemedText type="secondary" style={styles.body}>{body}</ThemedText>
        </View>
        {isUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: animal ? accentColor : Colors.danger }]} />
        ) : null}
      </Pressable>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'Notifications',
            headerLeft: () => (
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </Pressable>
            ),
            headerRight: () => (
              <Pressable
                onPress={handleMarkAllRead}
                disabled={unreadCount === 0 || isMarkingAll}
                accessibilityRole="button"
                accessibilityState={{ disabled: unreadCount === 0 || isMarkingAll }}
                style={({ pressed }) => [styles.markAllButton, pressed && { opacity: 0.7 }]}
              >
                <ThemedText style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>
                  Mark all as read
                </ThemedText>
              </Pressable>
            ),
          }}
        />
        {message ? (
          <View
            style={[styles.message, message.kind === 'error' && styles.messageError]}
            accessibilityLiveRegion="polite"
          >
            <ThemedText style={[styles.messageText, message.kind === 'error' && styles.messageTextError]}>
              {message.text}
            </ThemedText>
            <Pressable onPress={() => setMessage(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss message">
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.textSecondary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, notifications.length === 0 && styles.listEmpty]}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.textSecondary} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="notifications-off-outline" size={26} color={Colors.textSecondary} />
                </View>
                <ThemedText type="subtitle" style={styles.emptyTitle}>Nothing yet</ThemedText>
                <ThemedText type="secondary" style={styles.emptyText}>
                  Invite someone and let the drama begin.
                </ThemedText>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    marginLeft: 4,
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButton: {
    marginRight: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  markAllTextDisabled: {
    color: Colors.textMuted,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    maxWidth: 600,
    alignSelf: 'stretch',
  },
  messageError: {
    borderColor: withAlpha(Colors.danger, 0.4),
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  messageTextError: {
    color: Colors.danger,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  leading: {
    marginRight: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  titleRead: {
    color: Colors.textSecondary,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 7,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 6,
  },
  emptyText: {
    textAlign: 'center',
  },
});
