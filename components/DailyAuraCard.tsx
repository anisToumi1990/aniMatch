import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { getAuraEmoji } from '@/constants/AuraEmoji';
import { DailyAuraState } from '@/hooks/useDailyAura';

interface DailyAuraCardProps {
  state: DailyAuraState;
  onRetry: () => void;
  onTakeQuiz: () => void;
  /** Omit to hide the share button. */
  onShare?: () => void;
  isSharing?: boolean;
  /** Inline feedback after sharing (e.g. "saved as an image"). */
  shareFeedback?: { kind: 'info' | 'error'; text: string } | null;
  /**
   * Extra sections rendered inside the card, below today's message, each
   * separated by a divider. Reserved for the future "Today with {name}" pair tip.
   */
  children?: React.ReactNode;
}

/** Home's daily aura card, in the Aura glow style. */
export function DailyAuraCard({ state, onRetry, onTakeQuiz, onShare, isSharing = false, shareFeedback, children }: DailyAuraCardProps) {
  if (state.status === 'locked') {
    return (
      <View style={[styles.card, styles.lockedCard]}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} />
        </View>
        <ThemedText style={styles.lockedTitle}>Your daily aura is locked 🔒</ThemedText>
        <ThemedText type="secondary" style={styles.lockedText}>Take the quiz to unlock it.</ThemedText>
        <AuraButton label="Take the quiz" icon="arrow-forward" iconPosition="right" onPress={onTakeQuiz} style={styles.lockedButton} />
      </View>
    );
  }

  const aura = state.status === 'loading' ? null : state.aura;
  const auraColor = aura ? getAuraColor(aura.name) : Colors.textMuted;
  const extraSections = React.Children.toArray(children).filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        aura && {
          borderColor: withAlpha(auraColor, 0.4),
          backgroundColor: Colors.card,
          shadowColor: auraColor,
        },
      ]}
    >
      {/* Soft wash of the aura color at the top of the card. */}
      {aura ? <View style={[styles.wash, { backgroundColor: withAlpha(auraColor, 0.1) }]} /> : null}

      <View style={styles.header}>
        {aura ? <AuraAvatar animalName={aura.name} size="small" /> : <View style={styles.avatarPlaceholder} />}
        <ThemedText style={styles.eyebrow} numberOfLines={1}>
          Today
          {aura ? (
            <>
              <ThemedText style={styles.eyebrowDot}>{'  ·  '}</ThemedText>
              <ThemedText style={[styles.eyebrowAnimal, { color: auraColor }]}>
                {aura.name} {getAuraEmoji(aura.name)}
              </ThemedText>
            </>
          ) : null}
        </ThemedText>
        {state.status === 'ready' && onShare ? (
          <Pressable
            onPress={onShare}
            disabled={isSharing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share today's aura"
            accessibilityState={{ disabled: isSharing, busy: isSharing }}
            style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.7 }]}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Ionicons name="share-outline" size={18} color={Colors.text} />
            )}
          </Pressable>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.loading} accessibilityLabel="Loading today's aura">
          <View style={[styles.skeletonLine, { width: '92%' }]} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
          <View style={[styles.skeletonPill, { marginTop: 18 }]} />
          <View style={styles.skeletonPill} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.inlineState} accessibilityLiveRegion="polite">
          <ThemedText style={styles.errorText}>Today&apos;s aura got lost on the way. Check your connection.</ThemedText>
          <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="refresh" size={14} color={Colors.text} />
            <ThemedText style={styles.retryText}>Try again</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'empty' ? (
        <View style={styles.inlineState}>
          <ThemedText type="secondary" style={styles.emptyText}>
            Today&apos;s message is still being written. Check back tomorrow.
          </ThemedText>
        </View>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <ThemedText style={styles.message} accessibilityRole="text">{state.message.message}</ThemedText>
          <View style={styles.tips}>
            <View style={styles.tipRow}>
              <ThemedText style={styles.tipEmoji}>✅</ThemedText>
              <ThemedText style={styles.tipText}>
                <ThemedText style={styles.tipLabel}>Do </ThemedText>
                {state.message.doText}
              </ThemedText>
            </View>
            <View style={styles.tipRow}>
              <ThemedText style={styles.tipEmoji}>❌</ThemedText>
              <ThemedText style={styles.tipText}>
                <ThemedText style={styles.tipLabel}>Don&apos;t </ThemedText>
                {state.message.dontText}
              </ThemedText>
            </View>
          </View>
          {shareFeedback ? (
            <ThemedText
              style={[styles.shareFeedback, shareFeedback.kind === 'error' && styles.shareFeedbackError]}
              accessibilityLiveRegion="polite"
            >
              {shareFeedback.text}
            </ThemedText>
          ) : null}
        </>
      ) : null}

      {extraSections.map((section, index) => (
        <View key={index} style={styles.extraSection}>
          {section}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  // Rounded like the card instead of clipping it, so the iOS glow isn't cut off.
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    pointerEvents: 'none',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.cardRaised,
  },
  eyebrow: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  eyebrowDot: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  eyebrowAnimal: {
    fontSize: 14,
    fontWeight: '500',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
  },
  message: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 16,
  },
  tips: {
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.cardRaised,
  },
  tipEmoji: {
    fontSize: 14,
    lineHeight: 21,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  tipLabel: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: Colors.text,
  },
  loading: {
    gap: 10,
    paddingVertical: 4,
  },
  skeletonLine: {
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.cardRaised,
  },
  skeletonPill: {
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.cardRaised,
  },
  inlineState: {
    gap: 12,
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.danger,
  },
  retryButton: {
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
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
  },
  shareFeedback: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.success,
  },
  shareFeedbackError: {
    color: Colors.danger,
  },
  extraSection: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    marginBottom: 14,
  },
  lockedTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedText: {
    textAlign: 'center',
    marginBottom: 18,
  },
  lockedButton: {
    minWidth: 200,
  },
});
