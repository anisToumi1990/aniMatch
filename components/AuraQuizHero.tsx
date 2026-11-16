import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { AuraButton } from '@/components/AuraButton';
import { Colors } from '@/constants/Colors';

interface AuraQuizHeroProps {
  onTakeQuiz: () => void;
}

/** Home's top block for users without an aura: the hero and the locked daily aura in one, with one button. */
export function AuraQuizHero({ onTakeQuiz }: AuraQuizHeroProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        What&apos;s your aura?
      </ThemedText>
      <ThemedText type="secondary" style={styles.subtitle}>
        Take a quick 10-question quiz to find the animal that reflects your personality, and see how you connect with others.
      </ThemedText>
      <View style={styles.lockRow}>
        <ThemedText style={styles.lockText}>🔒 Your daily aura unlocks after the quiz.</ThemedText>
      </View>
      <AuraButton
        label="Take the quiz"
        onPress={onTakeQuiz}
        size="large"
        icon="arrow-forward"
        iconPosition="right"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: 20,
  },
  lockRow: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    marginBottom: 24,
  },
  lockText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  button: {
    minWidth: 240,
  },
});
