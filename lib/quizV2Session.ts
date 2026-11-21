/**
 * Quiz v2 session state (pure reducer + selectors), used by context/QuizContext.tsx.
 *
 * Steps = the shuffled main questions, then any tie-breakers appended one at a time
 * (only when lib/quizV2Scoring.ts says the two closest auras are too close).
 * Changing a main answer drops the tie-breakers; changing a tie-breaker drops the ones after it.
 * They are asked again, if still needed, when the user finishes.
 */
import { AnimalTraitProfile, QuizV2ScoredAnswer, QuizV2Trait } from './quizV2Scoring';
import { shuffle } from './shuffle';
import type { QuizV2AnswerRecord, QuizV2Question } from './supabase/quizV2';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface QuizV2DisplayOption {
  id: number;
  /** Letter by display position, so it says nothing about points. */
  key: string;
  text: string;
  points: number;
}

export interface QuizV2Step {
  questionId: number;
  trait: QuizV2Trait;
  text: string;
  isTiebreaker: boolean;
  options: QuizV2DisplayOption[];
}

export interface QuizV2SessionState {
  steps: QuizV2Step[];
  /** One tie-breaker per trait, options already shuffled. */
  tieBreakers: Partial<Record<QuizV2Trait, QuizV2Step>>;
  profiles: AnimalTraitProfile[];
  /** questionId -> optionId */
  answers: Record<number, number>;
  index: number;
}

export type QuizV2SessionAction =
  | { type: 'loaded'; questions: QuizV2Question[]; profiles: AnimalTraitProfile[]; random?: () => number }
  | { type: 'select'; questionId: number; optionId: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'addTieBreaker'; trait: QuizV2Trait }
  | { type: 'reset' };

export const EMPTY_QUIZ_V2_SESSION: QuizV2SessionState = {
  steps: [],
  tieBreakers: {},
  profiles: [],
  answers: {},
  index: 0,
};

function toStep(question: QuizV2Question, random: () => number): QuizV2Step {
  return {
    questionId: question.id,
    trait: question.trait,
    text: question.text,
    isTiebreaker: question.isTiebreaker,
    options: shuffle(question.options, random).map((option, i) => ({
      id: option.id,
      key: OPTION_KEYS[i] ?? String(i + 1),
      text: option.text,
      points: option.points,
    })),
  };
}

export function quizV2SessionReducer(state: QuizV2SessionState, action: QuizV2SessionAction): QuizV2SessionState {
  switch (action.type) {
    case 'loaded': {
      const random = action.random ?? Math.random;
      const main = action.questions.filter(q => !q.isTiebreaker);
      const tieBreakers: Partial<Record<QuizV2Trait, QuizV2Step>> = {};
      for (const question of action.questions) {
        if (question.isTiebreaker && !tieBreakers[question.trait]) tieBreakers[question.trait] = toStep(question, random);
      }
      return {
        steps: shuffle(main, random).map(question => toStep(question, random)),
        tieBreakers,
        profiles: action.profiles,
        answers: {},
        index: 0,
      };
    }
    case 'select': {
      const stepIndex = state.steps.findIndex(step => step.questionId === action.questionId);
      if (stepIndex < 0) return state;
      const step = state.steps[stepIndex];
      if (!step.options.some(option => option.id === action.optionId)) return state;
      if (state.answers[action.questionId] === action.optionId) return state;

      // A changed answer invalidates the tie-breakers that depend on it.
      const firstTieBreakerIndex = state.steps.findIndex(s => s.isTiebreaker);
      const keepUntil = step.isTiebreaker
        ? stepIndex + 1
        : firstTieBreakerIndex < 0
          ? state.steps.length
          : firstTieBreakerIndex;
      const steps = state.steps.slice(0, keepUntil);
      const answers: Record<number, number> = {};
      for (const kept of steps) {
        const optionId = state.answers[kept.questionId];
        if (optionId !== undefined) answers[kept.questionId] = optionId;
      }
      answers[action.questionId] = action.optionId;
      return { ...state, steps, answers, index: Math.min(state.index, steps.length - 1) };
    }
    case 'next':
      return state.index < state.steps.length - 1 ? { ...state, index: state.index + 1 } : state;
    case 'back':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case 'addTieBreaker': {
      const step = state.tieBreakers[action.trait];
      if (!step || state.steps.some(s => s.questionId === step.questionId)) return state;
      const steps = [...state.steps, step];
      return { ...state, steps, index: steps.length - 1 };
    }
    case 'reset':
      return EMPTY_QUIZ_V2_SESSION;
    default:
      return state;
  }
}

export function getMainQuestionCount(state: QuizV2SessionState): number {
  return state.steps.filter(step => !step.isTiebreaker).length;
}

export function areAllStepsAnswered(state: QuizV2SessionState): boolean {
  return state.steps.length > 0 && state.steps.every(step => state.answers[step.questionId] !== undefined);
}

/** Answers with their points and trait, main questions first (the steps' order). */
export function getScoredAnswers(state: QuizV2SessionState): QuizV2ScoredAnswer[] {
  return state.steps.flatMap(step => {
    const option = step.options.find(o => o.id === state.answers[step.questionId]);
    return option ? [{ trait: step.trait, points: option.points, isTiebreaker: step.isTiebreaker }] : [];
  });
}

/** What gets saved in user_quiz_results.answer_data. */
export function getAnswerRecords(state: QuizV2SessionState): QuizV2AnswerRecord[] {
  return state.steps.flatMap(step => {
    const optionId = state.answers[step.questionId];
    return optionId === undefined ? [] : [{ question_id: step.questionId, option_id: optionId }];
  });
}
