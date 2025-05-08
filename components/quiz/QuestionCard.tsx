import React from 'react';
import { View, StyleSheet } from 'react-native';
import { QuizQuestion, QuizAnswerOption, UserAnswer } from '@/lib/supabase/quiz';
import { ThemedText } from '@/components/ThemedText';
import { AnswerOption } from './AnswerOption';

interface QuestionCardProps {
  question: QuizQuestion;
  answerOptions: QuizAnswerOption[];
  userAnswers: UserAnswer[];
  onSelectAnswer: (questionId: number, optionKey: string) => void;
  goToNextQuestion: () => void;
  isLastQuestion: boolean;
}

export function QuestionCard({ 
  question, 
  answerOptions, 
  userAnswers, 
  onSelectAnswer,
  goToNextQuestion,
  isLastQuestion
}: QuestionCardProps) {
  const selectedAnswer = userAnswers.find(
    (answer) => answer.question_id === question.id
  );

  const handleOptionSelect = (questionId: number, optionKey: string) => {
    onSelectAnswer(questionId, optionKey);
    
    // Auto-advance to next question if this isn't the last question
    if (!isLastQuestion) {
      // Use a short timeout to give visual feedback of selection before advancing
      setTimeout(() => {
        goToNextQuestion();
      }, 300);
    }
  };

  return (
    <View style={[
      styles.container
    ]}>
      <ThemedText style={styles.questionText}>
        {question.question_text}
      </ThemedText>
      
      <View style={styles.optionsContainer}>
        {answerOptions.map((option) => (
          <AnswerOption
            key={option.id}
            optionKey={option.option_key}
            optionText={option.option_text}
            isSelected={selectedAnswer?.selected_option === option.option_key}
            onSelect={() => handleOptionSelect(question.id, option.option_key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    marginTop: 8,
  },
}); 