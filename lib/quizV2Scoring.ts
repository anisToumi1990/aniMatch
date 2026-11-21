/**
 * Quiz v2 scoring (pure, no I/O). See docs/quiz-v2-proposal.md.
 *
 * - Each answer is worth 0-3 points on its question's trait.
 * - Trait score (0-100) = points / (answers on that trait * 3) * 100.
 * - The user's aura = the profile closest by Euclidean distance.
 * - Tie rule: if 2nd distance - 1st distance < TIE_GAP, ask a tie-breaker on the trait
 *   where the two closest auras (after the main questions) differ most, then the next,
 *   up to MAX_TIE_BREAKERS. Stop as soon as the gap is big enough; otherwise the closest wins.
 *
 * Mirrors scripts/quiz-v2-simulation.js, which was used to tune the profiles.
 */

export const QUIZ_V2_TRAITS = ['social', 'curiosity', 'organization', 'kindness', 'chill'] as const;

export type QuizV2Trait = (typeof QUIZ_V2_TRAITS)[number];

export type TraitScores = Record<QuizV2Trait, number>;

export const QUIZ_V2_MAX_POINTS = 3;
export const QUIZ_V2_TIE_GAP = 2;
export const QUIZ_V2_MAX_TIE_BREAKERS = 3;

export interface QuizV2ScoredAnswer {
  trait: QuizV2Trait;
  points: number;
  isTiebreaker: boolean;
}

export interface AnimalTraitProfile {
  auraId: number;
  scores: TraitScores;
}

export interface RankedAura {
  auraId: number;
  distance: number;
}

export type QuizV2Evaluation =
  | { status: 'done'; auraId: number; traitScores: TraitScores; ranking: RankedAura[] }
  | { status: 'needsTieBreaker'; trait: QuizV2Trait; traitScores: TraitScores; ranking: RankedAura[] };

export interface QuizV2Options {
  tieGap?: number;
  maxTieBreakers?: number;
}

export function isQuizV2Trait(value: string): value is QuizV2Trait {
  return (QUIZ_V2_TRAITS as readonly string[]).includes(value);
}

/** 0-100 per trait (not rounded). A trait with no answers scores 50 (neutral). */
export function computeTraitScores(answers: QuizV2ScoredAnswer[]): TraitScores {
  const scores = {} as TraitScores;
  for (const trait of QUIZ_V2_TRAITS) {
    const traitAnswers = answers.filter(answer => answer.trait === trait);
    if (traitAnswers.length === 0) {
      scores[trait] = 50;
      continue;
    }
    const points = traitAnswers.reduce((sum, answer) => sum + answer.points, 0);
    scores[trait] = (points / (traitAnswers.length * QUIZ_V2_MAX_POINTS)) * 100;
  }
  return scores;
}

/** Rounded to 1 decimal, for storing in user_quiz_results.trait_scores. Matching uses the exact scores. */
export function roundTraitScores(scores: TraitScores): TraitScores {
  const rounded = {} as TraitScores;
  for (const trait of QUIZ_V2_TRAITS) rounded[trait] = Math.round(scores[trait] * 10) / 10;
  return rounded;
}

export function traitDistance(a: TraitScores, b: TraitScores): number {
  let sum = 0;
  for (const trait of QUIZ_V2_TRAITS) sum += (a[trait] - b[trait]) ** 2;
  return Math.sqrt(sum);
}

/** Profiles by distance, closest first. Equal distances: lower aura id first (stable result). */
export function rankAuras(scores: TraitScores, profiles: AnimalTraitProfile[]): RankedAura[] {
  return profiles
    .map(profile => ({ auraId: profile.auraId, distance: traitDistance(scores, profile.scores) }))
    .sort((a, b) => a.distance - b.distance || a.auraId - b.auraId);
}

/** Traits ordered by how much two profiles differ, biggest first (ties keep QUIZ_V2_TRAITS order). */
export function tieBreakerTraitOrder(first: AnimalTraitProfile, second: AnimalTraitProfile): QuizV2Trait[] {
  return QUIZ_V2_TRAITS.map((trait, index) => ({
    trait,
    index,
    difference: Math.abs(first.scores[trait] - second.scores[trait]),
  }))
    .sort((a, b) => b.difference - a.difference || a.index - b.index)
    .map(entry => entry.trait);
}

/**
 * Evaluates the answers so far (main answers first, then any tie-breakers in the order asked).
 * Returns the aura, or the trait of the next tie-breaker to ask.
 */
export function evaluateQuizV2(
  answers: QuizV2ScoredAnswer[],
  profiles: AnimalTraitProfile[],
  options: QuizV2Options = {}
): QuizV2Evaluation {
  const tieGap = options.tieGap ?? QUIZ_V2_TIE_GAP;
  const maxTieBreakers = options.maxTieBreakers ?? QUIZ_V2_MAX_TIE_BREAKERS;
  if (profiles.length === 0) throw new Error('No animal trait profiles to match against.');

  const traitScores = computeTraitScores(answers);
  const ranking = rankAuras(traitScores, profiles);
  const done: QuizV2Evaluation = { status: 'done', auraId: ranking[0].auraId, traitScores, ranking };
  if (ranking.length < 2) return done;

  const askedCount = answers.filter(answer => answer.isTiebreaker).length;
  const isClose = ranking[1].distance - ranking[0].distance < tieGap;
  if (!isClose || askedCount >= maxTieBreakers) return done;

  // The tie-breaker order is fixed by the two closest auras after the main questions only.
  const mainRanking = rankAuras(
    computeTraitScores(answers.filter(answer => !answer.isTiebreaker)),
    profiles
  );
  const first = profiles.find(profile => profile.auraId === mainRanking[0].auraId);
  const second = profiles.find(profile => profile.auraId === mainRanking[1].auraId);
  if (!first || !second) return done;

  const trait = tieBreakerTraitOrder(first, second)[askedCount];
  if (!trait) return done;
  return { status: 'needsTieBreaker', trait, traitScores, ranking };
}
