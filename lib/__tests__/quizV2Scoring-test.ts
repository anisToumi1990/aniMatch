import {
  AnimalTraitProfile,
  QuizV2ScoredAnswer,
  QuizV2Trait,
  QUIZ_V2_TRAITS,
  computeTraitScores,
  evaluateQuizV2,
  rankAuras,
  roundTraitScores,
  tieBreakerTraitOrder,
  traitDistance,
} from '../quizV2Scoring';
import { shuffle } from '../shuffle';

function profile(auraId: number, [social, curiosity, organization, kindness, chill]: number[]): AnimalTraitProfile {
  return { auraId, scores: { social, curiosity, organization, kindness, chill } };
}

function main(trait: QuizV2Trait, ...points: number[]): QuizV2ScoredAnswer[] {
  return points.map(p => ({ trait, points: p, isTiebreaker: false }));
}

function tieBreaker(trait: QuizV2Trait, points: number): QuizV2ScoredAnswer {
  return { trait, points, isTiebreaker: true };
}

/** 2 answers worth 3 and 0 on every trait: 50 everywhere. */
function allFifty(): QuizV2ScoredAnswer[] {
  return QUIZ_V2_TRAITS.flatMap(trait => main(trait, 3, 0));
}

// Final table from docs/quiz-v2-proposal.md (ids as in animal_auras).
const REAL_PROFILES: AnimalTraitProfile[] = [
  profile(1, [78, 58, 42, 72, 48]), // Dolphin
  profile(2, [74, 50, 60, 30, 34]), // Peacock
  profile(3, [70, 36, 68, 44, 58]), // Lion
  profile(4, [60, 74, 36, 34, 52]), // Fox
  profile(5, [76, 66, 30, 54, 32]), // Parrot
  profile(6, [28, 66, 64, 50, 68]), // Owl
  profile(7, [54, 30, 62, 70, 34]), // Wolf
  profile(8, [26, 32, 68, 56, 70]), // Bear
  profile(9, [46, 76, 32, 66, 50]), // Unicorn
  profile(10, [50, 40, 62, 76, 70]), // Elephant
  profile(11, [28, 62, 54, 30, 64]), // Snake
  profile(12, [26, 70, 34, 38, 46]), // Cat
  profile(13, [42, 50, 78, 30, 46]), // Eagle
  profile(14, [28, 44, 40, 78, 38]), // Deer
  profile(15, [66, 58, 30, 58, 72]), // Otter
];

describe('computeTraitScores', () => {
  it('scores points out of 3 per answer, as 0-100', () => {
    const scores = computeTraitScores([...main('social', 3, 3, 3), ...main('curiosity', 3, 2, 1), ...main('kindness', 0, 0, 0)]);
    expect(scores.social).toBe(100);
    expect(scores.curiosity).toBeCloseTo(66.667, 2);
    expect(scores.kindness).toBe(0);
  });

  it('gives 50 to a trait without answers', () => {
    expect(computeTraitScores([]).organization).toBe(50);
  });

  it('counts tie-breakers as a 4th answer on their trait', () => {
    const scores = computeTraitScores([...main('chill', 3, 3, 0), tieBreaker('chill', 0)]);
    expect(scores.chill).toBe(50);
  });

  it('rounds to 1 decimal only for storage', () => {
    expect(roundTraitScores(computeTraitScores(main('social', 2, 0, 0))).social).toBe(22.2);
  });
});

describe('distance and ranking', () => {
  it('uses Euclidean distance over the 5 traits', () => {
    const a = profile(1, [0, 0, 0, 0, 0]).scores;
    const b = profile(2, [30, 40, 0, 0, 0]).scores;
    expect(traitDistance(a, b)).toBe(50);
  });

  it('ranks closest first and breaks exact ties by aura id', () => {
    const scores = computeTraitScores(allFifty());
    const ranking = rankAuras(scores, [profile(9, [60, 50, 50, 50, 50]), profile(3, [40, 50, 50, 50, 50]), profile(5, [50, 50, 50, 50, 50])]);
    expect(ranking.map(r => r.auraId)).toEqual([5, 3, 9]);
  });

  it('orders tie-breaker traits by profile difference, biggest first', () => {
    const order = tieBreakerTraitOrder(profile(1, [50, 50, 90, 50, 60]), profile(2, [50, 40, 10, 50, 40]));
    expect(order).toEqual(['organization', 'chill', 'curiosity', 'social', 'kindness']);
  });
});

describe('evaluateQuizV2 tie rule', () => {
  const clearWinner = [profile(1, [70, 50, 50, 50, 50]), profile(2, [30, 50, 50, 50, 40])];
  // dA = 20, dB = 20.6: gap 0.6 < 2, and the two differ most on social.
  const nearTie = [profile(1, [70, 50, 50, 50, 50]), profile(2, [30, 50, 50, 50, 45])];

  it('returns the closest aura when the gap is at least 2', () => {
    const result = evaluateQuizV2(allFifty(), clearWinner);
    expect(result).toMatchObject({ status: 'done', auraId: 1 });
  });

  it('asks a tie-breaker on the trait where the 2 closest auras differ most', () => {
    expect(evaluateQuizV2(allFifty(), nearTie)).toMatchObject({ status: 'needsTieBreaker', trait: 'social' });
  });

  it('lets the tie-breaker answer decide', () => {
    expect(evaluateQuizV2([...allFifty(), tieBreaker('social', 3)], nearTie)).toMatchObject({ status: 'done', auraId: 1 });
    expect(evaluateQuizV2([...allFifty(), tieBreaker('social', 0)], nearTie)).toMatchObject({ status: 'done', auraId: 2 });
  });

  it('asks the next traits in order and stops after 3 tie-breakers', () => {
    const profiles = [profile(1, [60, 50, 50, 50, 60]), profile(2, [40, 50, 52, 50, 40])];
    const options = { tieGap: 1000 }; // always "close"
    const answers = allFifty();
    const asked: QuizV2Trait[] = [];
    for (let i = 0; i < 5; i += 1) {
      const result = evaluateQuizV2(answers, profiles, options);
      if (result.status === 'done') break;
      asked.push(result.trait);
      answers.push(tieBreaker(result.trait, 1));
    }
    expect(asked).toEqual(['social', 'chill', 'organization']);
    expect(evaluateQuizV2(answers, profiles, options).status).toBe('done');
  });

  it('picks the closest (then lowest id) when still tied after 3 tie-breakers', () => {
    const twins = [profile(4, [60, 50, 50, 50, 50]), profile(2, [60, 50, 50, 50, 50])];
    const answers = [...allFifty(), tieBreaker('social', 3), tieBreaker('curiosity', 3), tieBreaker('organization', 3)];
    expect(evaluateQuizV2(answers, twins)).toMatchObject({ status: 'done', auraId: 2 });
  });

  it('throws without profiles', () => {
    expect(() => evaluateQuizV2(allFifty(), [])).toThrow();
  });
});

describe('evaluateQuizV2 with the real profiles', () => {
  /** Plays a full quiz: main answers from `pick`, tie-breakers answered with `tieBreakerPoints`. */
  function play(pick: (trait: QuizV2Trait, index: number) => number, tieBreakerPoints = 2) {
    const answers = QUIZ_V2_TRAITS.flatMap(trait => main(trait, pick(trait, 0), pick(trait, 1), pick(trait, 2)));
    let result = evaluateQuizV2(answers, REAL_PROFILES);
    let tieBreakers = 0;
    while (result.status === 'needsTieBreaker') {
      answers.push(tieBreaker(result.trait, tieBreakerPoints));
      tieBreakers += 1;
      result = evaluateQuizV2(answers, REAL_PROFILES);
    }
    return { result, tieBreakers };
  }

  it('matches typical answer patterns to the expected animals', () => {
    const patterns: [Partial<Record<QuizV2Trait, number>>, number][] = [
      [{ social: 3, curiosity: 2, organization: 1, kindness: 3, chill: 1 }, 1], // social, warm -> Dolphin
      [{ social: 0, curiosity: 2, organization: 2, kindness: 1, chill: 2 }, 6], // quiet, curious, steady -> Owl
      [{ social: 1, curiosity: 1, organization: 3, kindness: 1, chill: 1 }, 13], // organized, driven -> Eagle
      [{ social: 1, curiosity: 1, organization: 1, kindness: 3, chill: 1 }, 14], // gentle, sensitive -> Deer
      [{ social: 2, curiosity: 2, organization: 1, kindness: 2, chill: 3 }, 15], // playful, easygoing -> Otter
    ];
    for (const [points, expectedAuraId] of patterns) {
      const { result } = play(trait => points[trait] ?? 1);
      expect(result.status === 'done' && result.auraId).toBe(expectedAuraId);
    }
  });

  it('always ends with a known aura after at most 3 tie-breakers', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const auraIds = new Set(REAL_PROFILES.map(p => p.auraId));
    for (let i = 0; i < 500; i += 1) {
      const { result, tieBreakers } = play(() => Math.floor(random() * 4), Math.floor(random() * 4));
      expect(result.status).toBe('done');
      if (result.status === 'done') expect(auraIds.has(result.auraId)).toBe(true);
      expect(tieBreakers).toBeLessThanOrEqual(3);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input, () => 0);
    expect([...output].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(output).not.toEqual(input);
  });
});
