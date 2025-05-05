import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { supabase } from '../../lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  invite_id: string | null;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { refreshCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;

      try {
        // First, get all notifications for the user
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (notificationsError) throw notificationsError;

        // Then, get all invites to check their status
        const { data: invitesData, error: invitesError } = await supabase
          .from('invites')
          .select('id, status')
          .in('id', notificationsData?.map(n => n.invite_id).filter(Boolean) || []);

        if (invitesError) throw invitesError;

        // Filter out notifications where the invite is already accepted or refused
        const pendingNotifications = notificationsData?.filter(notification => {
          if (!notification.invite_id) return true; // Keep non-invite notifications
          
          const invite = invitesData?.find(invite => invite.id === notification.invite_id);
          return !invite || invite.status === 'pending';
        }) || [];

        setNotifications(pendingNotifications);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, [user?.id]);

  const handleInvitationResponse = async (notificationId: string, inviteId: string, isAccepted: boolean) => {
    try {
      // Update notification as read
      const { error: notificationError } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (notificationError) throw notificationError;

      // Update invite status
      const { error: inviteError } = await supabase
        .from('invites')
        .update({
          status: isAccepted ? 'accepted' : 'rejected',
          accepted_at: isAccepted ? new Date().toISOString() : null
        })
        .eq('id', inviteId);

      if (inviteError) throw inviteError;

      // Remove the notification from the list
      setNotifications(prevNotifications =>
        prevNotifications.filter(notification => notification.id !== notificationId)
      );

      // Refresh the notification count
      await refreshCount();
    } catch (err) {
      console.error('Error handling invitation response:', err);
      setError('Failed to process your response');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedText type="subtitle" style={styles.errorText}>{error}</ThemedText>
      </SafeAreaView>
    );
  }

  if (notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.emptyContainer}>
          <ThemedText type="subtitle">No pending notifications</ThemedText>
          <ThemedText>You'll see new notifications here when you receive them.</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ThemedView style={[styles.notificationItem, !item.is_read && styles.unreadNotification]}>
            <ThemedText type="subtitle">{item.title}</ThemedText>
            <ThemedText>{item.message}</ThemedText>
            <ThemedText style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </ThemedText>
            
            {item.invite_id && !item.is_read && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={() => handleInvitationResponse(item.id, item.invite_id!, true)}
                >
                  <ThemedText style={styles.buttonText}>Accept</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.refuseButton]}
                  onPress={() => handleInvitationResponse(item.id, item.invite_id!, false)}
                >
                  <ThemedText style={styles.buttonText}>Reject</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </ThemedView>
        )}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 16,
  },
  notificationItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  unreadNotification: {
    backgroundColor: '#e3f2fd',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#dc3545',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  refuseButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
}); 