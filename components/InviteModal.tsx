import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { InviteForm, InviteLinkRoute } from './InviteForm';
import { Colors } from '@/constants/Colors';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after the popup closes when a notice link is pressed. */
  onLinkPress: (route: InviteLinkRoute) => void;
}

/** "Invite someone" popup wrapping the shared invite form. */
export function InviteModal({ visible, onClose, onLinkPress }: InviteModalProps) {
  function handleLinkPress(route: InviteLinkRoute) {
    onClose();
    onLinkPress(route);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback
        onPress={event => {
          // Same as the account popup: on web, Keyboard.dismiss() would blur the
          // email field as soon as it is pressed.
          if (Platform.OS !== 'web') {
            Keyboard.dismiss();
          }
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        accessible={false}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close invite popup"
            >
              <Ionicons name="close" size={26} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.iconHalo}>
              <Ionicons name="person-add" size={24} color={Colors.text} />
            </View>
            <ThemedText style={styles.title}>Invite someone</ThemedText>
            <ThemedText type="secondary" style={styles.subtitle}>
              Once they accept and both of you have taken the quiz, you&apos;ll see how your auras match.
            </ThemedText>
            {/* Only mounted while visible, so it opens empty every time. */}
            {visible ? <InviteForm autoFocus onLinkPress={handleLinkPress} /> : null}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 125,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    paddingTop: 32,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  iconHalo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
});
