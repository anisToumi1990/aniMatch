import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraButton } from '@/components/AuraButton';
import { Colors, withAlpha } from '@/constants/Colors';
import { SelectedDayState } from '@/hooks/useAuraWeek';

interface DayMessageProps {
  state: SelectedDayState;
  onRetry: () => void;
  onShare: () => void;
  isSharing: boolean;
  shareFeedback: { kind: 'info' | 'error'; text: string } | null;
}

/** The selected day's message, big and centered, then Do / Don't tiles and the share button. */
export function DayMessage({ state, onRetry, onShare, isSharing, shareFeedback }: DayMessageProps) {
  if (state.status === 'loading') {
    return (
      <View style={styles.placeholder} accessibilityLabel="Loading the aura message">
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.placeholder} accessibilityLiveRegion="polite">
        <ThemedText style={styles.errorText}>This aura got lost on the way. Check your connection.</ThemedText>
        <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
          <Ionicons name="refresh" size={14} color={Colors.text} />
          <ThemedText style={styles.retryText}>Try again</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (state.status === 'empty') {
    return (
      <View style={styles.placeholder}>
        <ThemedText type="secondary" style={styles.emptyText}>This day&apos;s message is still being written.</ThemedText>
      </View>
    );
  }

  const { message, doText, dontText } = state.message;
  return (
    <View style={styles.container}>
      <ThemedText style={styles.message}>{message}</ThemedText>
      <View style={styles.tiles}>
        <View style={[styles.tile, styles.doTile]}>
          <ThemedText style={[styles.tileLabel, { color: Colors.success }]}>DO</ThemedText>
          <ThemedText style={styles.tileText}>{doText}</ThemedText>
        </View>
        <View style={[styles.tile, styles.dontTile]}>
          <ThemedText style={[styles.tileLabel, { color: Colors.danger }]}>DON&apos;T</ThemedText>
          <ThemedText style={styles.tileText}>{dontText}</ThemedText>
        </View>
      </View>
      <AuraButton
        label="Share my aura"
        icon="share-outline"
        onPress={onShare}
        isLoading={isSharing}
        accessibilityLabel="Share my aura"
        style={styles.shareButton}
      />
      {shareFeedback ? (
        <ThemedText
          style={[styles.feedback, shareFeedback.kind === 'error' && { color: Colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {shareFeedback.text}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  placeholder: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  message: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '500',
    textAlign: 'center',
    color: Colors.text,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  doTile: {
    borderColor: withAlpha(Colors.success, 0.35),
  },
  dontTile: {
    borderColor: withAlpha(Colors.danger, 0.35),
  },
  tileLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  tileText: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  shareButton: {
    alignSelf: 'center',
    minWidth: 220,
  },
  feedback: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: Colors.success,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.danger,
  },
  emptyText: {
    textAlign: 'center',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
