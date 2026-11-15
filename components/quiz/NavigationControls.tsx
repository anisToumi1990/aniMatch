import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { AuraButton } from '@/components/AuraButton';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface NavigationControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isLastQuestion: boolean;
  isLoading: boolean;
  allQuestionsAnswered: boolean;
}

export function NavigationControls({
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
  isLastQuestion,
  isLoading,
  allQuestionsAnswered,
}: NavigationControlsProps) {
  const isNextDisabled = (isLastQuestion && !allQuestionsAnswered) || !canGoForward;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.backButton,
          { opacity: canGoBack ? 1 : 0.4 }
        ]}
        onPress={onPrevious}
        disabled={!canGoBack}
        accessibilityRole="button"
      >
        <Ionicons 
          name="chevron-back" 
          size={20} 
          color={Colors.textSecondary} 
        />
        <ThemedText type="secondary" style={styles.backButtonText}>Back</ThemedText>
      </TouchableOpacity>

      <AuraButton
        label={isLastQuestion ? 'Finish quiz' : 'Next'}
        onPress={onNext}
        disabled={isNextDisabled}
        isLoading={isLoading}
        icon={isLastQuestion ? undefined : 'chevron-forward'}
        iconPosition="right"
        style={styles.primaryButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  backButtonText: {
    marginLeft: 4,
  },
  primaryButton: {
    minWidth: 128,
  },
});
