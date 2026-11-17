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
    questions,
    currentQuestionIndex,
    currentAnswerOptions,
    isLoading,
    error,
    userAnswers,
    progress,
    loadQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    selectAnswer,
    submitQuiz,
    isQuizComplete,
    animalAura,
  } = useQuiz();
  
  useEffect(() => {
    // For debugging
    console.log('Quiz screen params:', params);
    console.log('isRetaking:', isRetaking);
    console.log('isQuizComplete:', isQuizComplete);
  }, [params, isRetaking, isQuizComplete]);

  // If quiz is already complete and not retaking, redirect to results
  useEffect(() => {
    if (isQuizComplete && animalAura && !isRetaking) {
      console.log('Quiz is complete, redirecting to results');
      // The QuizContext's submitQuiz will now handle navigation to results
      // This redirect is only for cases where someone navigates back to the quiz
      router.replace("/(tabs)/results");
    }
  }, [isQuizComplete, animalAura, router, isRetaking]);

  // Load the quiz when the component mounts or is accessed through Retake Quiz
  useEffect(() => {
    // Always load the quiz when the component mounts
    loadQuiz();
  }, []);

  // Handle error state
  if (error) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Quiz',
            }}
          />
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>
              {error}
            </ThemedText>
            <ThemedText
              style={styles.retryText}
              onPress={loadQuiz}
            >
              Tap to retry
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  // Handle loading state
  if (isLoading && questions.length === 0) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Quiz',
            }}
          />
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

  if (questions.length === 0) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              ...transparentHeaderOptions,
              title: 'Quiz',
            }}
          />
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>
              No questions available. Please try again later.
            </ThemedText>
            <ThemedText
              style={styles.retryText}
              onPress={loadQuiz}
            >
              Tap to retry
            </ThemedText>
          </ThemedView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  // Function to handle completing the quiz
  const handleNext = () => {
    if (isLastQuestion) {
      // Check if all questions are answered
      if (userAnswers.length === questions.length) {
        console.log('Submitting quiz with', userAnswers.length, 'answers');
        // Submit directly without showing the popup
        submitQuiz();
        console.log('Quiz submitted, isQuizComplete:', isQuizComplete);
      } else {
        Alert.alert(
          'Incomplete Quiz',
          'Please answer all questions before submitting.',
          [{ text: 'OK' }]
        );
      }
    } else {
      goToNextQuestion();
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'Quiz',
          }}
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ProgressIndicator
              currentQuestion={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              progress={(currentQuestionIndex + 1) / questions.length}
            />
            
            <QuestionCard 
              question={currentQuestion}
              answerOptions={currentAnswerOptions}
              userAnswers={userAnswers}
              onSelectAnswer={selectAnswer}
              goToNextQuestion={goToNextQuestion}
              isLastQuestion={isLastQuestion}
            />
            
            <NavigationControls
              onPrevious={goToPreviousQuestion}
              onNext={handleNext}
              canGoBack={currentQuestionIndex > 0}
              canGoForward={currentQuestionIndex < questions.length}
              isLastQuestion={isLastQuestion}
              isLoading={isLoading}
              allQuestionsAnswered={userAnswers.length === questions.length}
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
  retryText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
}); 