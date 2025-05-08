import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ProgressIndicator } from '@/components/quiz/ProgressIndicator';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { NavigationControls } from '@/components/quiz/NavigationControls';
import { BackgroundPattern } from '../../components/BackgroundPattern';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';

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
      <BackgroundPattern>
        <SafeAreaViewContext style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Personality Quiz',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
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
        </SafeAreaViewContext>
      </BackgroundPattern>
    );
  }

  // Handle loading state
  if (isLoading && questions.length === 0) {
    return (
      <BackgroundPattern>
        <SafeAreaViewContext style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Personality Quiz',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
            }}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7E4EFF" />
            <ThemedText style={styles.loadingText}>
              Loading quiz...
            </ThemedText>
          </View>
        </SafeAreaViewContext>
      </BackgroundPattern>
    );
  }

  if (questions.length === 0) {
    return (
      <BackgroundPattern>
        <SafeAreaViewContext style={styles.container} edges={['bottom', 'left', 'right']}>
          <Stack.Screen
            options={{
              title: 'Personality Quiz',
              headerShown: true,
              headerStyle: {
                backgroundColor: 'transparent',
              },
              headerTransparent: true,
              headerTintColor: '#2E7D32',
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
        </SafeAreaViewContext>
      </BackgroundPattern>
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
    <BackgroundPattern>
      <SafeAreaViewContext style={styles.container} edges={['bottom', 'left', 'right']}>
        <Stack.Screen
          options={{
            title: 'Personality Quiz',
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTransparent: true,
            headerTintColor: '#2E7D32',
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
      </SafeAreaViewContext>
    </BackgroundPattern>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
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
    color: '#7E4EFF',
    fontWeight: '600',
  },
}); 