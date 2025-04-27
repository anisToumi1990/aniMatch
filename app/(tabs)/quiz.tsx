import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ProgressIndicator } from '@/components/quiz/ProgressIndicator';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { NavigationControls } from '@/components/quiz/NavigationControls';

export default function QuizScreen() {
  const router = useRouter();
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

  // Load the quiz when the component mounts
  useEffect(() => {
    loadQuiz();
  }, []);

  useEffect(() => {
    if (isQuizComplete && animalAura) {
      // Navigate directly to results tab
      router.navigate("/(tabs)/results");
    }
  }, [isQuizComplete, animalAura]);

  // Handle error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Personality Quiz' }} />
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
    );
  }

  // Handle loading state
  if (isLoading && questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Personality Quiz' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7E4EFF" />
          <ThemedText style={styles.loadingText}>
            Loading quiz...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Personality Quiz' }} />
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
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  // Function to handle completing the quiz
  const handleNext = () => {
    if (isLastQuestion) {
      // Check if all questions are answered
      if (userAnswers.length === questions.length) {
        // Submit directly without showing the popup
        submitQuiz();
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Personality Quiz' }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ThemedText style={styles.title}>Discover Your Animal Aura</ThemedText>
          
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