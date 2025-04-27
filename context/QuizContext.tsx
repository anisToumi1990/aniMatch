import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  fetchQuizQuestions,
  fetchAnswerOptions,
  calculateQuizResult,
  submitQuizResult,
  fetchAnimalAura,
  fetchLatestQuizResult,
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
  isPreviousResult: boolean;
  
  // Navigation helper
  directNavigateToQuiz: boolean;
  setDirectNavigateToQuiz: (value: boolean) => void;
  
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
  const router = useRouter();

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
  const [isPreviousResult, setIsPreviousResult] = useState(false);

  // Navigation helper to enable direct navigation to quiz tab
  const [directNavigateToQuiz, setDirectNavigateToQuiz] = useState(false);

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

  // Load the user's latest quiz result when they sign in
  useEffect(() => {
    const loadLatestResult = async () => {
      // Only attempt to load if user is authenticated and we don't already have a result
      if (userId && !isQuizComplete && !animalAura) {
        setIsLoading(true);
        try {
          const latestResult = await fetchLatestQuizResult(userId);
          
          if (latestResult && latestResult.animal_aura) {
            // Set the animal aura from the latest result
            setAnimalAura(latestResult.animal_aura);
            setIsQuizComplete(true);
            setIsPreviousResult(true); // Mark this as a restored previous result
            console.log('Loaded previous quiz result:', latestResult.animal_aura.name);
          }
        } catch (err) {
          console.error('Error loading latest quiz result:', err);
          // Don't set error state here to avoid showing error to user on login
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadLatestResult();
  }, [userId]);

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
      console.log('Starting quiz submission process');
      
      // Calculate the matching animal aura
      const auraId = await calculateQuizResult(userAnswers);
      console.log('Calculated aura ID:', auraId);
      
      // Save the user's result
      await submitQuizResult(userId, auraId, userAnswers);
      console.log('Saved quiz result to database');
      
      // Fetch the detailed aura information
      const aura = await fetchAnimalAura(auraId);
      console.log('Fetched aura details:', aura.name);
      
      // Update state
      setAnimalAura(aura);
      setIsQuizComplete(true);
      setIsPreviousResult(false); // This is a fresh result, not a previous one
      
      console.log('States updated, navigating to results screen');
      
      // Ensure the state updates are processed before navigation
      setTimeout(() => {
        router.replace("/(tabs)/results");
        console.log('Navigation to results complete');
      }, 100);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred submitting your answers');
      console.error('Error submitting quiz:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset the quiz to start over
  const resetQuiz = () => {
    setIsLoading(true);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setIsQuizComplete(false);
    setAnimalAura(null);
    setIsPreviousResult(false);
    
    // Set flag to directly navigate to quiz tab
    setDirectNavigateToQuiz(true);
    
    // Immediately fetch fresh quiz data
    loadQuiz().then(() => {
      console.log('Quiz reset and reloaded successfully');
    }).catch(err => {
      console.error('Error reloading quiz after reset:', err);
    });
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
    isPreviousResult,
    directNavigateToQuiz,
    setDirectNavigateToQuiz,
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