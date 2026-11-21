import { createContext, useCallback, useContext, useEffect, useReducer, useState, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  fetchAnimalAura,
  fetchLatestQuizResult,
  updateUserCompatibilityResults,
  AnimalAura,
} from '../lib/supabase/quiz';
import { fetchAnimalTraitProfiles, fetchQuizV2Questions, submitQuizV2Result, QUIZ_V2_VERSION } from '../lib/supabase/quizV2';
import { evaluateQuizV2, roundTraitScores } from '../lib/quizV2Scoring';
import {
  EMPTY_QUIZ_V2_SESSION,
  QuizV2Step,
  areAllStepsAnswered,
  getAnswerRecords,
  getMainQuestionCount,
  getScoredAnswers,
  quizV2SessionReducer,
} from '../lib/quizV2Session';
import { useAuth } from './AuthContext';

interface QuizContextType {
  // Quiz v2 session
  currentStep: QuizV2Step | null;
  currentIndex: number;
  stepCount: number;
  mainQuestionCount: number;
  tieBreakerNumber: number | null;
  selectedOptionId: number | null;
  isLastStep: boolean;
  allAnswered: boolean;
  isLoading: boolean;
  error: string | null;

  // Result
  isQuizComplete: boolean;
  animalAura: AnimalAura | null;
  isPreviousResult: boolean;
  /** Version of the latest saved result: 1 (old quiz), 2, or null (none / not loaded). */
  latestQuizVersion: number | null;

  // Navigation helper
  directNavigateToQuiz: boolean;
  setDirectNavigateToQuiz: (value: boolean) => void;

  // Actions
  loadQuiz: () => Promise<void>;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  selectOption: (questionId: number, optionId: number) => void;
  /** On the last step: asks a tie-breaker if needed, otherwise saves the result. */
  finishQuiz: () => Promise<void>;
  resetQuiz: () => void;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const router = useRouter();

  const [quiz, dispatch] = useReducer(quizV2SessionReducer, EMPTY_QUIZ_V2_SESSION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [animalAura, setAnimalAura] = useState<AnimalAura | null>(null);
  const [isPreviousResult, setIsPreviousResult] = useState(false);
  const [latestQuizVersion, setLatestQuizVersion] = useState<number | null>(null);

  // Navigation helper to enable direct navigation to quiz tab
  const [directNavigateToQuiz, setDirectNavigateToQuiz] = useState(false);

  // Reset quiz state when user changes
  useEffect(() => {
    dispatch({ type: 'reset' });
    setIsQuizComplete(false);
    setAnimalAura(null);
    setIsPreviousResult(false);
    setLatestQuizVersion(null);
    setDirectNavigateToQuiz(false);
  }, [userId]);

  const loadQuiz = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    dispatch({ type: 'reset' });
    try {
      const [questions, profiles] = await Promise.all([fetchQuizV2Questions(), fetchAnimalTraitProfiles()]);
      if (profiles.length === 0) throw new Error('The quiz is not available right now. Please try again later.');
      dispatch({ type: 'loaded', questions, profiles });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading the quiz');
      console.error('Error loading quiz:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const goToNextQuestion = useCallback(() => dispatch({ type: 'next' }), []);
  const goToPreviousQuestion = useCallback(() => dispatch({ type: 'back' }), []);
  const selectOption = useCallback((questionId: number, optionId: number) => {
    dispatch({ type: 'select', questionId, optionId });
  }, []);

  // Load the user's latest quiz result when they sign in
  useEffect(() => {
    if (!userId) return;
    let isCancelled = false;
    setIsLoading(true);
    fetchLatestQuizResult(userId)
      .then(latestResult => {
        if (isCancelled) return;
        if (latestResult?.animal_aura) {
          setAnimalAura(latestResult.animal_aura);
          setIsQuizComplete(true);
          setIsPreviousResult(true);
          // Rows saved before the v2 migration have no quiz_version: they're v1.
          setLatestQuizVersion(latestResult.quiz_version ?? 1);
        } else {
          setAnimalAura(null);
          setIsQuizComplete(false);
          setIsPreviousResult(false);
          setLatestQuizVersion(null);
        }
      })
      .catch(err => {
        // Don't show an error on login, just start without a result.
        console.error('Error loading latest quiz result:', err);
        if (isCancelled) return;
        setAnimalAura(null);
        setIsQuizComplete(false);
        setIsPreviousResult(false);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const finishQuiz = async () => {
    setError(null);
    if (!userId) {
      setError('You must be logged in to submit the quiz');
      return;
    }
    if (!areAllStepsAnswered(quiz)) {
      setError('Please answer all questions before submitting');
      return;
    }

    let evaluation;
    try {
      evaluation = evaluateQuizV2(getScoredAnswers(quiz), quiz.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate your aura');
      return;
    }

    // Too close to call: one more question, if we have one for that trait.
    if (evaluation.status === 'needsTieBreaker' && quiz.tieBreakers[evaluation.trait]) {
      dispatch({ type: 'addTieBreaker', trait: evaluation.trait });
      return;
    }

    const auraId = evaluation.ranking[0].auraId;
    setIsLoading(true);
    try {
      await submitQuizV2Result(userId, auraId, getAnswerRecords(quiz), roundTraitScores(evaluation.traitScores));
      const aura = await fetchAnimalAura(auraId);
      // Same flow as before: refresh match scores (match_ready notifications come from the database).
      await updateUserCompatibilityResults(userId, auraId);
      setAnimalAura(aura);
      setIsQuizComplete(true);
      setIsPreviousResult(false);
      setLatestQuizVersion(QUIZ_V2_VERSION);
      // Let the state updates land before navigating.
      setTimeout(() => router.replace('/(tabs)/results'), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred submitting your answers');
      console.error('Error submitting quiz:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset the quiz to start over (Retake screen)
  const resetQuiz = () => {
    setIsQuizComplete(false);
    setAnimalAura(null);
    setIsPreviousResult(false);
    setDirectNavigateToQuiz(true);
    loadQuiz();
  };

  const currentStep = quiz.steps[quiz.index] ?? null;
  const mainQuestionCount = getMainQuestionCount(quiz);
  const selectedOptionId = currentStep ? quiz.answers[currentStep.questionId] ?? null : null;

  const value: QuizContextType = {
    currentStep,
    currentIndex: quiz.index,
    stepCount: quiz.steps.length,
    mainQuestionCount,
    tieBreakerNumber: currentStep?.isTiebreaker ? quiz.index - mainQuestionCount + 1 : null,
    selectedOptionId,
    isLastStep: quiz.steps.length > 0 && quiz.index === quiz.steps.length - 1,
    allAnswered: areAllStepsAnswered(quiz),
    isLoading,
    error,
    isQuizComplete,
    animalAura,
    isPreviousResult,
    latestQuizVersion,
    directNavigateToQuiz,
    setDirectNavigateToQuiz,
    loadQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    selectOption,
    finishQuiz,
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
