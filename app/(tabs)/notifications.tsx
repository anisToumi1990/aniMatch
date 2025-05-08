import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { supabase } from '../../lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Stack } from 'expo-router';
import { BackgroundPattern } from '../../components/BackgroundPattern';

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

type RelationshipType = 'lover' | 'business_partner' | 'family';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { refreshCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<{ notificationId: string; inviteId: string } | null>(null);

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

  const handleInvitationResponse = async (notificationId: string, inviteId: string, isAccepted: boolean, relationshipType?: RelationshipType) => {
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

      // Update invite status and relationship type if accepted
      const { error: inviteError } = await supabase
        .from('invites')
        .update({
          status: isAccepted ? 'accepted' : 'rejected',
          accepted_at: isAccepted ? new Date().toISOString() : null,
          relationship_type: isAccepted ? relationshipType : null
        })
        .eq('id', inviteId);

      if (inviteError) throw inviteError;

        // Call the function to create compatibility results
      const { error: functionError } = await supabase.rpc('create_compatibility_results', {
        invite_id: inviteId
      });

      if (functionError) throw functionError;
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

  const handleAcceptPress = (notificationId: string, inviteId: string) => {
    setSelectedInvite({ notificationId, inviteId });
    setShowRelationshipModal(true);
  };

  const handleRelationshipSelect = (relationshipType: RelationshipType) => {
    if (selectedInvite) {
      handleInvitationResponse(selectedInvite.notificationId, selectedInvite.inviteId, true, relationshipType);
      setShowRelationshipModal(false);
      setSelectedInvite(null);
    }
  };

  if (isLoading) {
    return (
      <BackgroundPattern>
        <SafeAreaView style={[styles.container, { paddingTop: 60 }]} edges={['left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Notifications',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
            }}
          />
          <View style={styles.centerContent}>
            <ActivityIndicator size="large"/>
          </View>
        </SafeAreaView>
      </BackgroundPattern>
    );
  }

  if (error) {
    return (
      <BackgroundPattern>
        <SafeAreaView style={[styles.container, { paddingTop: 60 }]} edges={['left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Notifications',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
            }}
          />
          <View style={styles.centerContent}>
            <ThemedText type="subtitle" style={styles.errorText}>{error}</ThemedText>
          </View>
        </SafeAreaView>
      </BackgroundPattern>
    );
  }

  if (notifications.length === 0) {
    return (
      <BackgroundPattern>
        <SafeAreaView style={[styles.container, { paddingTop: 60 }]} edges={['left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Notifications',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
            }}
          />
          <View style={styles.centerContent}>
            <ThemedText type="subtitle" style={styles.noResultsText}>No pending notifications</ThemedText>
            <ThemedText style={styles.noResultsText}>You'll see new notifications here when you receive them.</ThemedText>
          </View>
        </SafeAreaView>
      </BackgroundPattern>
    );
  }

  return (
    <BackgroundPattern>
      <SafeAreaView style={[styles.container, { paddingTop: 60 }]} edges={['left', 'right']}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTransparent: true,
            headerTintColor: '#2E7D32',
          }}
        />
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <ThemedView style={[styles.notificationItem]}>
              <View style={styles.notificationHeader}>
                <ThemedText type="subtitle" style={styles.notificationTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.timestamp}>
                  {new Date(item.created_at).toLocaleDateString()}
                </ThemedText>
              </View>
              <ThemedText style={styles.notificationMessage}>{item.message}</ThemedText>
              
              {item.invite_id && !item.is_read && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.acceptButton]}
                    onPress={() => handleAcceptPress(item.id, item.invite_id!)}
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
        />
      </SafeAreaView>
    </BackgroundPattern>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  scrollContent: {
    padding: 20,
  },
  noResultsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  notificationItem: {
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 16,
    lineHeight: 22,
    color: '#374151',
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  acceptButton: {
    backgroundColor: '#2196f3',
  },
  refuseButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});