import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

interface ProgressIndicatorProps {
  currentQuestion: number;
  totalQuestions: number;
  progress: number;
  /** Replaces "Question X of Y", e.g. for tie-breakers. */
  label?: string;
}

export function ProgressIndicator({ 
  currentQuestion, 
  totalQuestions, 
  progress,
  label,
}: ProgressIndicatorProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="muted" style={styles.questionCounter}>
        {label ?? `Question ${currentQuestion} of ${totalQuestions}`}
      </ThemedText>
      
      <View
        style={styles.progressBarContainer}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.progressBar, { width: `${Math.min(1, progress) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 16,
  },
  questionCounter: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 2,
    borderRadius: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: Colors.text,
  },
});
