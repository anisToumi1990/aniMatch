import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';

interface ProgressIndicatorProps {
  currentQuestion: number;
  totalQuestions: number;
  progress: number;
}

export function ProgressIndicator({ 
  currentQuestion, 
  totalQuestions, 
  progress 
}: ProgressIndicatorProps) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.questionCounter}>
        Question {currentQuestion} of {totalQuestions}
      </ThemedText>
      
      <View style={[styles.progressBarContainer, { backgroundColor: '#E5E5E5' }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${progress * 100}%`,
              backgroundColor: '#7E4EFF'
            }
          ]} 
        />
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
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
}); 