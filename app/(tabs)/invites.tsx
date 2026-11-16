import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, Pressable, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { supabase } from '../../lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Stack, useFocusEffect } from 'expo-router';
import { ScreenBackground } from '@/components/ScreenBackground';
import { AuraButton } from '@/components/AuraButton';
import { Colors } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification, getDisplayText } from '@/lib/supabase/notifications';
import { formatRelativeTime } from '@/lib/relativeTime';

/** An invite notification; only rows with an invite_id are shown here. */
type Notification = AppNotification;

type RelationshipType = 'lover' | 'business_partner' | 'family';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { refreshCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<{ notificationId: number; inviteId: number } | null>(null);

  // Reload every time the tab gets focus (no realtime yet).
  useFocusEffect(useCallback(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;

      try {
        // Invite notifications for the user (other notification types live in the bell list)
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .not('invite_id', 'is', null)
          .order('created_at', { ascending: false });

        if (notificationsError) throw notificationsError;

        // Then, get all invites to check their status
        const { data: invitesData, error: invitesError } = await supabase
          .from('invites')
          .select('id, status')
          .in('id', notificationsData?.map(n => n.invite_id).filter(Boolean) || []);

        if (invitesError) throw invitesError;

        // Only invites that still need an answer
        const pendingNotifications = notificationsData?.filter(notification => {
          const invite = invitesData?.find(invite => invite.id === notification.invite_id);
          return !invite || invite.status === 'pending';
        }) || [];

        setNotifications(pendingNotifications);
        setError(null);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
    refreshCount();
  }, [user?.id, refreshCount]));

  const handleInvitationResponse = async (notificationId: number, inviteId: number, isAccepted: boolean, relationshipType?: RelationshipType) => {
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

  const handleAcceptPress = (notificationId: number, inviteId: number) => {
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
      <ScreenBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Invites',
            }}
          />
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.textSecondary} />
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (error) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Invites',
            }}
          />
          <View style={styles.centerContent}>
            <ThemedText type="subtitle" style={styles.errorText}>{error}</ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (notifications.length === 0) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Invites',
            }}
          />
          <View style={styles.centerContent}>
            <ThemedText type="subtitle" style={styles.noResultsTitle}>No pending invites</ThemedText>
            <ThemedText type="secondary" style={styles.noResultsText}>When someone wants to know how you two match, you&apos;ll answer here.</ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'Invites',
          }}
        />
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <ThemedView style={[styles.notificationItem]}>
              <View style={styles.notificationHeader}>
                <ThemedText type="subtitle" style={styles.notificationTitle}>{getDisplayText(item).title}</ThemedText>
                <ThemedText type="muted" style={styles.timestamp}>
                  {formatRelativeTime(item.created_at)}
                </ThemedText>
              </View>
              <ThemedText type="secondary" style={styles.notificationMessage}>{getDisplayText(item).body}</ThemedText>

              {/* Reading the notification from the bell doesn't answer the invite, so keep the buttons. */}
              {item.invite_id && (
                <View style={styles.actionButtons}>
                  <AuraButton
                    label="Reject"
                    variant="secondary"
                    onPress={() => handleInvitationResponse(item.id, item.invite_id!, false)}
                    style={styles.button}
                  />
                  <AuraButton
                    label="Accept"
                    onPress={() => handleAcceptPress(item.id, item.invite_id!)}
                    style={styles.button}
                  />
                </View>
              )}
            </ThemedView>
          )}
        />
          <Modal
          visible={showRelationshipModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowRelationshipModal(false);
            setSelectedInvite(null);
          }}
          >
          <TouchableWithoutFeedback
            onPress={event => {
              if (event.target === event.currentTarget) {
                setShowRelationshipModal(false);
                setSelectedInvite(null);
              }
            }}
            accessible={false}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowRelationshipModal(false);
                    setSelectedInvite(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close relationship type modal"
                >
                  <Ionicons name="close" size={26} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.modalTitle}>Select relationship type</ThemedText>
                <TouchableOpacity
                  style={styles.relationshipButton}
                  onPress={() => handleRelationshipSelect('lover')}
                >
                  <ThemedText style={styles.relationshipButtonText}>Lover</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.relationshipButton}
                  onPress={() => handleRelationshipSelect('business_partner')}
                >
                  <ThemedText style={styles.relationshipButtonText}>Business partner</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.relationshipButton}
                  onPress={() => handleRelationshipSelect('family')}
                >
                  <ThemedText style={styles.relationshipButtonText}>Family</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  noResultsTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsText: {
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  notificationItem: {
    padding: 20,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  notificationTitle: {
    fontSize: 17,
    lineHeight: 24,
    flexShrink: 1,
  },
  notificationMessage: {
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  button: {
    minWidth: 104,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    paddingTop: 28,
    width: '85%',
    maxWidth: 400,
    position: 'relative',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 28,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
    zIndex: 1,
  },
  relationshipButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    marginBottom: 10,
  },
  relationshipButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
});