import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors, withAlpha } from '@/constants/Colors';

interface HideMatchDialogProps {
  /** The other person's name, or null when closed. */
  name: string | null;
  isHiding: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The "⋯" menu of a match card: first the menu ("Hide match"), then the
 * confirmation. A Modal rather than Alert.alert, so it works on web.
 * Give it a `key` per match so it starts on the menu each time.
 */
export function HideMatchDialog({ name, isHiding, onConfirm, onClose }: HideMatchDialogProps) {
  const [step, setStep] = useState<'menu' | 'confirm'>('menu');
  const isVisible = name !== null;

  function handleClose() {
    if (!isHiding) onClose();
  }

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close">
        {/* Stops presses inside the sheet from closing it. */}
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          {step === 'menu' ? (
            <>
              <Pressable
                onPress={() => setStep('confirm')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="eye-off-outline" size={18} color={Colors.text} />
                <ThemedText style={styles.menuText}>Hide match</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
                <ThemedText type="secondary" style={styles.menuText}>Cancel</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.title}>Hide your match with {name}?</ThemedText>
              <ThemedText type="secondary" style={styles.body}>
                It disappears from your lists. {name} still sees it and won&apos;t be told.
              </ThemedText>
              <View style={styles.buttons}>
                <Pressable
                  onPress={handleClose}
                  disabled={isHiding}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
                >
                  <ThemedText style={styles.buttonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={onConfirm}
                  disabled={isHiding}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isHiding, disabled: isHiding }}
                  style={({ pressed }) => [styles.button, styles.buttonDanger, pressed && { opacity: 0.7 }]}
                >
                  {isHiding ? (
                    <ActivityIndicator size="small" color={Colors.danger} />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: Colors.danger }]}>Hide</ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 16,
  },
  title: {
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minWidth: 88,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDanger: {
    borderColor: withAlpha(Colors.danger, 0.5),
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
