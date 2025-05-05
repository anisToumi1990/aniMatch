import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface NotificationsContextType {
  unreadCount: number;
  refreshCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  unreadCount: 0,
  refreshCount: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = async () => {
    if (!user?.id) return;

    try {
      // Get all notifications for the user
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // Get all invites to check their status
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('id, status')
        .in('id', notificationsData?.map(n => n.invite_id).filter(Boolean) || []);

      if (invitesError) throw invitesError;

      // Count only pending notifications
      const pendingCount = notificationsData?.filter(notification => {
        if (!notification.invite_id) return true; // Count non-invite notifications
        
        const invite = invitesData?.find(invite => invite.id === notification.invite_id);
        return !invite || invite.status === 'pending';
      }).length || 0;

      setUnreadCount(pendingCount);
    } catch (err) {
      console.error('Error refreshing notification count:', err);
    }
  };

  // Initial count fetch
  useEffect(() => {
    refreshCount();
  }, [user?.id]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext); 