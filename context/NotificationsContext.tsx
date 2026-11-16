import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { fetchPendingInviteCount, fetchUnreadCount } from '@/lib/supabase/notifications';

interface NotificationsContextType {
  /** Unread notifications (badge on the header bell). */
  unreadCount: number;
  /** Invites still waiting for an answer (badge on the Invites tab). */
  pendingInviteCount: number;
  /** Reloads both counts. */
  refreshCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  unreadCount: 0,
  pendingInviteCount: 0,
  refreshCount: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setPendingInviteCount(0);
      return;
    }
    const [unread, pending] = await Promise.allSettled([
      fetchUnreadCount(userId),
      fetchPendingInviteCount(userId),
    ]);
    if (unread.status === 'fulfilled') setUnreadCount(unread.value);
    else console.error('Error loading unread notification count:', unread.reason);
    if (pending.status === 'fulfilled') setPendingInviteCount(pending.value);
    else console.error('Error loading pending invite count:', pending.reason);
  }, [userId]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // No realtime yet: refresh when the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshCount();
    });
    return () => subscription.remove();
  }, [refreshCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, pendingInviteCount, refreshCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
