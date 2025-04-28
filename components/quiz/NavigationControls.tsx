import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
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
  const primaryColor = '#7E4EFF';
  const disabledColor = '#E5E5EA';
  const textColor = '#FFFFFF';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.backButton,
          { opacity: canGoBack ? 1 : 0.5 }
        ]}
        onPress={onPrevious}
        disabled={!canGoBack}
      >
        <Ionicons 
          name="chevron-back" 
          size={24} 
          color="#000000" 
        />
        <ThemedText style={styles.backButtonText}>Back</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          {
            backgroundColor: 
              (isLastQuestion && !allQuestionsAnswered) || !canGoForward
                ? disabledColor
                : primaryColor,
          },
        ]}
        onPress={onNext}
        disabled={isLoading || !canGoForward || (isLastQuestion && !allQuestionsAnswered)}
      >
        {isLoading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            <ThemedText style={styles.primaryButtonText}>
              {isLastQuestion ? 'Finish Quiz' : 'Next'}
            </ThemedText>
            {!isLastQuestion && (
              <Ionicons name="chevron-forward" size={24} color={textColor} />
            )}
          </>
        )}
      </TouchableOpacity>
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
    fontSize: 16,
    marginLeft: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 120,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
}); 