import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraButton } from '@/components/AuraButton';
import { Colors, withAlpha } from '@/constants/Colors';
import { DailyAuraMessage } from '@/lib/supabase/dailyAura';
import { formatLongDate } from '@/lib/dateLabels';

export type DayMessageState =
  | { status: 'loading' }
  | { status: 'ready'; message: DailyAuraMessage }
  /** No message for this aura today. */
  | { status: 'empty' }
  | { status: 'error' };

interface DayMessageProps {
  state: DayMessageState;
  /** Today ("YYYY-MM-DD"), shown on top of the card. */
  localDate: string;
  auraColor: string;
  onRetry: () => void;
  onShare: () => void;
  isSharing: boolean;
  shareFeedback: { kind: 'info' | 'error'; text: string } | null;
}

/**
 * Today's card: the date, the witty message (big), then "Today's action" with
 * why it helps (smaller), and the share button under the card.
 */
export function DayMessage({ state, localDate, auraColor, onRetry, onShare, isSharing, shareFeedback }: DayMessageProps) {
  const dateLabel = <ThemedText style={styles.date}>{formatLongDate(localDate)}</ThemedText>;

  if (state.status === 'loading') {
    return (
      <View style={[styles.card, styles.placeholder]} accessibilityLabel="Loading today's message">
        {dateLabel}
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.card, styles.placeholder]} accessibilityLiveRegion="polite">
        {dateLabel}
        <ThemedText style={styles.errorText}>Today&apos;s message got lost on the way. Check your connection.</ThemedText>
        <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
          <Ionicons name="refresh" size={14} color={Colors.text} />
          <ThemedText style={styles.retryText}>Try again</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (state.status === 'empty') {
    return (
      <View style={[styles.card, styles.placeholder]}>
        {dateLabel}
        <ThemedText type="secondary" style={styles.emptyText}>Today&apos;s message is still being written.</ThemedText>
      </View>
    );
  }

  const { message, actionText, actionWhy } = state.message;
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderColor: withAlpha(auraColor, 0.3) }]}>
        {dateLabel}
        <ThemedText style={styles.message}>{message}</ThemedText>
        {actionText ? (
          <View style={[styles.action, { borderTopColor: withAlpha(auraColor, 0.25) }]}>
            <ThemedText style={[styles.actionLabel, { color: auraColor }]}>TODAY&apos;S ACTION</ThemedText>
            <ThemedText style={styles.actionText}>{actionText}</ThemedText>
            {actionWhy ? <ThemedText style={styles.actionWhy}>{actionWhy}</ThemedText> : null}
          </View>
        ) : null}
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
  card: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  placeholder: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  date: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  message: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '500',
    textAlign: 'center',
    color: Colors.text,
    paddingHorizontal: 4,
  },
  action: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: Colors.text,
  },
  actionWhy: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  shareButton: {
    alignSelf: 'center',
    minWidth: 220,
    marginTop: 18,
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
