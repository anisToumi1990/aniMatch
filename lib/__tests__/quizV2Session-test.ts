import { QUIZ_V2_TRAITS, QuizV2Trait } from '../quizV2Scoring';
import { shouldShowQuizV2Banner } from '../quizV2Banner';
import {
  EMPTY_QUIZ_V2_SESSION,
  QuizV2SessionState,
  areAllStepsAnswered,
  getAnswerRecords,
  getScoredAnswers,
  quizV2SessionReducer as reduce,
} from '../quizV2Session';
import type { QuizV2Question } from '../supabase/quizV2';

// lib/quizV2Banner.ts imports AsyncStorage (jest hoists this above the imports).
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

/** 3 main questions per trait (ids 1-15) + 1 tie-breaker per trait (ids 16-20); option id = q*10 + (4 - points). */
function buildQuestions(): QuizV2Question[] {
  const question = (id: number, trait: QuizV2Trait, isTiebreaker: boolean): QuizV2Question => ({
    id,
    trait,
    text: `Question ${id}`,
    isTiebreaker,
    sortOrder: id,
    options: [3, 2, 1, 0].map(points => ({ id: id * 10 + (4 - points), text: `${points} points`, points })),
  });
  const main = QUIZ_V2_TRAITS.flatMap((trait, t) => [1, 2, 3].map(n => question(t * 3 + n, trait, false)));
  const tieBreakers = QUIZ_V2_TRAITS.map((trait, t) => question(16 + t, trait, true));
  return [...main, ...tieBreakers];
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function loaded(): QuizV2SessionState {
  return reduce(EMPTY_QUIZ_V2_SESSION, { type: 'loaded', questions: buildQuestions(), profiles: [], random: seededRandom(3) });
}

/** Answers every step with the option worth `points`. */
function answerAll(state: QuizV2SessionState, points = 2): QuizV2SessionState {
  return state.steps.reduce((current, step) => {
    const option = step.options.find(o => o.points === points)!;
    return reduce(current, { type: 'select', questionId: step.questionId, optionId: option.id });
  }, state);
}

describe('quizV2SessionReducer', () => {
  it('starts with the 15 main questions shuffled, tie-breakers kept aside', () => {
    const state = loaded();
    expect(state.steps).toHaveLength(15);
    expect(state.steps.every(step => !step.isTiebreaker)).toBe(true);
    expect(state.steps.map(s => s.questionId)).not.toEqual([...Array(15)].map((_, i) => i + 1));
    expect(Object.keys(state.tieBreakers).sort()).toEqual([...QUIZ_V2_TRAITS].sort());
  });

  it('shuffles answers and labels them A-D by position', () => {
    const state = loaded();
    expect(state.steps.every(step => step.options.map(o => o.key).join('') === 'ABCD')).toBe(true);
    const pointOrders = new Set(state.steps.map(step => step.options.map(o => o.points).join('')));
    expect(pointOrders.size).toBeGreaterThan(1);
  });

  it('ignores options that do not belong to the question', () => {
    const state = loaded();
    const step = state.steps[0];
    expect(reduce(state, { type: 'select', questionId: step.questionId, optionId: 999 })).toBe(state);
  });

  it('collects scored answers and records in step order', () => {
    const state = answerAll(loaded(), 3);
    expect(areAllStepsAnswered(state)).toBe(true);
    expect(getScoredAnswers(state)).toHaveLength(15);
    expect(getScoredAnswers(state).every(a => a.points === 3 && !a.isTiebreaker)).toBe(true);
    expect(getAnswerRecords(state)[0]).toEqual({ question_id: state.steps[0].questionId, option_id: state.steps[0].questionId * 10 + 1 });
  });

  it('appends a tie-breaker once and jumps to it', () => {
    let state = answerAll(loaded());
    state = reduce(state, { type: 'addTieBreaker', trait: 'kindness' });
    state = reduce(state, { type: 'addTieBreaker', trait: 'kindness' });
    expect(state.steps).toHaveLength(16);
    expect(state.index).toBe(15);
    expect(state.steps[15]).toMatchObject({ questionId: 19, isTiebreaker: true });
    expect(areAllStepsAnswered(state)).toBe(false);
  });

  it('drops tie-breakers when a main answer changes', () => {
    let state = answerAll(loaded());
    state = reduce(state, { type: 'addTieBreaker', trait: 'social' });
    state = reduce(state, { type: 'select', questionId: 16, optionId: 161 });
    state = reduce(state, { type: 'back' });
    const main = state.steps[0];
    state = reduce(state, { type: 'select', questionId: main.questionId, optionId: main.options.find(o => o.points === 0)!.id });
    expect(state.steps).toHaveLength(15);
    expect(state.answers[16]).toBeUndefined();
    expect(areAllStepsAnswered(state)).toBe(true);
  });

  it('keeps earlier tie-breakers when a later one changes', () => {
    let state = answerAll(loaded());
    state = reduce(state, { type: 'addTieBreaker', trait: 'social' });
    state = reduce(state, { type: 'select', questionId: 16, optionId: 161 });
    state = reduce(state, { type: 'addTieBreaker', trait: 'chill' });
    state = reduce(state, { type: 'select', questionId: 20, optionId: 201 });
    state = reduce(state, { type: 'select', questionId: 16, optionId: 164 });
    expect(state.steps.map(s => s.questionId).slice(15)).toEqual([16]);
    expect(state.answers[16]).toBe(164);
  });

  it('moves between steps within bounds', () => {
    let state = loaded();
    state = reduce(state, { type: 'back' });
    expect(state.index).toBe(0);
    for (let i = 0; i < 20; i += 1) state = reduce(state, { type: 'next' });
    expect(state.index).toBe(14);
  });
});

describe('shouldShowQuizV2Banner', () => {
  it('shows only for old-quiz results that were not dismissed', () => {
    expect(shouldShowQuizV2Banner(1, false)).toBe(true);
    expect(shouldShowQuizV2Banner(1, true)).toBe(false);
    expect(shouldShowQuizV2Banner(2, false)).toBe(false);
    expect(shouldShowQuizV2Banner(null, false)).toBe(false);
  });
});
