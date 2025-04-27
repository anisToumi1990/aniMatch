import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  fetchQuizQuestions,
  fetchAnswerOptions,
  calculateQuizResult,
  submitQuizResult,
  fetchAnimalAura,
  QuizQuestion,
  QuizAnswerOption,
  UserAnswer,
  AnimalAura,
} from '../lib/supabase/quiz';
import { useAuth } from './AuthContext';

interface QuizContextType {
  // Quiz data
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  currentAnswerOptions: QuizAnswerOption[];
  isLoading: boolean;
  error: string | null;
  
  // Quiz state
  userAnswers: UserAnswer[];
  isQuizComplete: boolean;
  progress: number;
  animalAura: AnimalAura | null;
  
  // Actions
  loadQuiz: () => Promise<void>;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  selectAnswer: (questionId: number, optionKey: string) => void;
  submitQuiz: () => Promise<void>;
  resetQuiz: () => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Quiz data state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswerOptions, setCurrentAnswerOptions] = useState<QuizAnswerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz progress state
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [animalAura, setAnimalAura] = useState<AnimalAura | null>(null);

  // Calculate progress (0 to 1)
  const progress = questions.length ? userAnswers.length / questions.length : 0;

  // Load quiz questions and answer options
  const loadQuiz = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Reset state
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setUserAnswers([]);
      setIsQuizComplete(false);
      setAnimalAura(null);
      
      // Fetch all questions
      const quizQuestions = await fetchQuizQuestions();
      setQuestions(quizQuestions);
      
      // If questions exist, load the first one's answer options
      if (quizQuestions.length > 0) {
        const firstQuestion = quizQuestions[0];
        const options = await fetchAnswerOptions(firstQuestion.id);
        setCurrentAnswerOptions(options);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading the quiz');
      console.error('Error loading quiz:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load answer options for the current question
  const loadCurrentQuestionOptions = async () => {
    if (questions.length === 0 || currentQuestionIndex >= questions.length) {
      return;
    }
    
    try {
      const options = await fetchAnswerOptions(questions[currentQuestionIndex].id);
      setCurrentAnswerOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load answer options');
      console.error('Error loading answer options:', err);
    }
  };

  // Navigate to the next question
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Navigate to the previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Select an answer for the current question
  const selectAnswer = (questionId: number, optionKey: string) => {
    setUserAnswers((prev) => {
      // Check if this question is already answered
      const existingAnswerIndex = prev.findIndex((a) => a.question_id === questionId);
      
      if (existingAnswerIndex >= 0) {
        // Update existing answer
        const updated = [...prev];
        updated[existingAnswerIndex] = { question_id: questionId, selected_option: optionKey };
        return updated;
      } else {
        // Add new answer
        return [...prev, { question_id: questionId, selected_option: optionKey }];
      }
    });
  };

  // Submit the quiz and calculate results
  const submitQuiz = async () => {
    if (!userId) {
      setError('You must be logged in to submit the quiz');
      return;
    }

    if (userAnswers.length !== questions.length) {
      setError('Please answer all questions before submitting');
      return;
    }

    setIsLoading(true);
    try {
      // Calculate the matching animal aura
      const auraId = await calculateQuizResult(userAnswers);
      
      // Save the user's result
      await submitQuizResult(userId, auraId, userAnswers);
      
      // Fetch the detailed aura information
      const aura = await fetchAnimalAura(auraId);
      setAnimalAura(aura);
      setIsQuizComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred submitting your answers');
      console.error('Error submitting quiz:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset the quiz to start over
  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setIsQuizComplete(false);
    setAnimalAura(null);
    loadCurrentQuestionOptions();
  };

  // Load answer options when the current question changes
  useEffect(() => {
    loadCurrentQuestionOptions();
  }, [currentQuestionIndex, questions]);

  const value = {
    questions,
    currentQuestionIndex,
    currentAnswerOptions,
    isLoading,
    error,
    userAnswers,
    isQuizComplete,
    progress,
    animalAura,
    loadQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    selectAnswer,
    submitQuiz,
    resetQuiz,
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
} 