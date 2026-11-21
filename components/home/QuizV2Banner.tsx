import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors, withAlpha } from '@/constants/Colors';

interface QuizV2BannerProps {
  auraColor: string;
  onOpen: () => void;
  onDismiss: () => void;
}

/** Home: invites users with an old-quiz (v1) result to retake the new trait quiz. */
export function QuizV2Banner({ auraColor, onOpen, onDismiss }: QuizV2BannerProps) {
  return (
    <View style={[styles.container, { borderColor: withAlpha(auraColor, 0.4), shadowColor: auraColor }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="New, more accurate quiz. Retake it?"
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <ThemedText style={styles.title}>New, more accurate quiz ✨</ThemedText>
        <View style={styles.cta}>
          <ThemedText type="secondary" style={styles.ctaText}>
            Retake it?
          </ThemedText>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </View>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={10}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.card,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 16,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    padding: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
