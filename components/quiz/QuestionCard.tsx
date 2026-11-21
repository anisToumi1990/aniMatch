import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { AnswerOption } from './AnswerOption';
import { Colors } from '@/constants/Colors';
import type { QuizV2Step } from '@/lib/quizV2Session';

interface QuestionCardProps {
  step: QuizV2Step;
  selectedOptionId: number | null;
  onSelectOption: (questionId: number, optionId: number) => void;
  /** Called shortly after a pick, except on the last step (the user taps Finish there). */
  goToNextQuestion: () => void;
  isLastQuestion: boolean;
}

/** Delay before auto-advancing, so the selection is visible. */
const AUTO_ADVANCE_MS = 300;

export function QuestionCard({ step, selectedOptionId, onSelectOption, goToNextQuestion, isLastQuestion }: QuestionCardProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't advance from a question the user has already left.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [step.questionId]);

  function handleSelect(optionId: number) {
    onSelectOption(step.questionId, optionId);
    if (isLastQuestion) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(goToNextQuestion, AUTO_ADVANCE_MS);
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.questionText}>{step.text}</ThemedText>

      <View style={styles.optionsContainer}>
        {step.options.map(option => (
          <AnswerOption
            key={option.id}
            optionKey={option.key}
            optionText={option.text}
            isSelected={selectedOptionId === option.id}
            onSelect={() => handleSelect(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 24,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  questionText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    marginTop: 8,
  },
});
