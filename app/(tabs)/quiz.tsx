import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ProgressIndicator } from '@/components/quiz/ProgressIndicator';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { NavigationControls } from '@/components/quiz/NavigationControls';
import { ScreenBackground } from '@/components/ScreenBackground';
import { Colors } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isRetaking = params.source === 'retake';

  const {
    currentStep,
    currentIndex,
    stepCount,
    mainQuestionCount,
    tieBreakerNumber,
    selectedOptionId,
    isLastStep,
    allAnswered,
    isLoading,
    error,
    loadQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    selectOption,
    finishQuiz,
    isQuizComplete,
    animalAura,
  } = useQuiz();

  // If the quiz is already complete and not retaking, show the result instead.
  useEffect(() => {
    if (isQuizComplete && animalAura && !isRetaking) {
      router.replace('/(tabs)/results');
    }
  }, [isQuizComplete, animalAura, router, isRetaking]);

  // Load (and shuffle) a fresh quiz when the screen mounts.
  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const header = (
    <Stack.Screen
      options={{
        ...transparentHeaderOptions,
        title: 'Quiz',
      }}
    />
  );

  // Loading failed: nothing to show but a retry.
  if (error && !currentStep) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          {header}
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <ThemedText style={styles.retryText} onPress={loadQuiz} accessibilityRole="button">
              Tap to retry
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (isLoading && !currentStep) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          {header}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.textSecondary} />
            <ThemedText type="secondary" style={styles.loadingText}>
              Loading quiz...
            </ThemedText>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  if (!currentStep) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          {header}
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>No questions available. Please try again later.</ThemedText>
            <ThemedText style={styles.retryText} onPress={loadQuiz} accessibilityRole="button">
              Tap to retry
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const isTieBreaker = tieBreakerNumber !== null;
  // Tie-breakers keep the bar full: the 15 questions are done.
  const progress = isTieBreaker ? 1 : (currentIndex + 1) / Math.max(1, mainQuestionCount);
  const progressLabel = isTieBreaker ? `Bonus question ${tieBreakerNumber} · You're between two auras` : undefined;

  function handleNext() {
    if (!isLastStep) {
      goToNextQuestion();
      return;
    }
    if (!allAnswered) {
      Alert.alert('Incomplete Quiz', 'Please answer all questions before submitting.', [{ text: 'OK' }]);
      return;
    }
    // Adds a tie-breaker if the two closest auras are too close, otherwise saves the result.
    finishQuiz();
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        {header}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ProgressIndicator
              currentQuestion={currentIndex + 1}
              totalQuestions={mainQuestionCount}
              progress={progress}
              label={progressLabel}
            />

            <QuestionCard
              key={currentStep.questionId}
              step={currentStep}
              selectedOptionId={selectedOptionId}
              onSelectOption={selectOption}
              goToNextQuestion={goToNextQuestion}
              isLastQuestion={isLastStep}
            />

            {error ? (
              <ThemedText style={styles.inlineError} accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            <NavigationControls
              onPrevious={goToPreviousQuestion}
              onNext={handleNext}
              canGoBack={currentIndex > 0}
              canGoForward={selectedOptionId !== null && currentIndex < stepCount}
              isLastQuestion={isLastStep}
              isLoading={isLoading}
              allQuestionsAnswered={allAnswered}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  inlineError: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.danger,
  },
  retryText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
}); 