/**
 * Personal + pair insights, library v2 (pure). See docs/pair-insights-proposal.md, section 3.
 *
 * The app never runs this: the real texts come from the database RPC
 * get_personal_insights(result_id), which needs both people's traits. This file is
 * the reference implementation of the selection rules, checked against the shared
 * fixture (lib/__tests__/fixtures/personalInsights-fixture.json) in Jest and in SQL
 * (supabase/migrations/20261123100200_pair_insights_check.sql), so the SQL
 * function personal_insights_build() and this code can't drift apart.
 * It also parses the RPC response for the UI (parsePersonalInsights).
 *
 * Keep in sync with scripts/personal-insights-preview.js, which generates the fixture.
 *
 * Scores are compared in tenths of a point (integers), so JS floats and SQL numerics
 * always agree at the thresholds (trait scores have 1 decimal).
 */
import { QUIZ_V2_TRAITS, QuizV2Trait, TraitScores } from './quizV2Scoring';
import { AreaScores, COMPATIBILITY_AREAS, RelationshipType } from './compatibilityV2';

export type TraitLevel = 'high' | 'medium' | 'low';
/**
 * who: sentence 1 after {Label} (singular verb). who_they: sentence 2, starts with "They".
 * you / you_also: the "You" card. strength / challenge: v1 texts, kept but unused. tip: shown.
 */
export type InsightSection = 'who' | 'who_they' | 'strength' | 'challenge' | 'tip' | 'you' | 'you_also';
export type PairCombo = 'they_higher' | 'you_higher' | 'both_high' | 'both_low';
export type CrossDirection = 'they_first' | 'you_first';

interface PairTexts {
  strength: string;
  /** Only on challenge-leaning combos (gaps and the 3 overlap risks). */
  challenge?: string;
}

/** supabase/content/personal-insights/library.json */
export interface PersonalInsightsLibrary {
  version: number;
  levels: { high: number; low: number };
  labels: Record<RelationshipType, string>;
  traits: Record<QuizV2Trait, Record<TraitLevel, Record<RelationshipType, Record<InsightSection, string>>>>;
  balanced: Record<RelationshipType, string>;
  you_balanced: Record<RelationshipType, string>;
  difference: Record<QuizV2Trait, Record<'they_higher' | 'you_higher', Record<RelationshipType, string>>>;
  similar: Record<QuizV2Trait, string>;
  areas: Record<keyof AreaScores, Record<'strong' | 'weak', Record<RelationshipType, string>>>;
  pairs: Record<QuizV2Trait, Record<PairCombo, Record<RelationshipType, PairTexts>>>;
  cross: Record<string, Record<CrossDirection, Record<RelationshipType, string>>>;
  generic: { challenge: Record<RelationshipType, string> };
}

/** What get_personal_insights returns: finished texts only. */
export interface PersonalInsights {
  version: number;
  them: { name: string; who: string };
  you: { who: string };
  strengths: string[];
  challenges: string[];
  tips: string[];
}

export interface PersonalInsightsInput {
  /** The viewer. */
  me: TraitScores;
  /** The other person in the match. */
  them: TraitScores;
  relationshipType: RelationshipType;
  /** Their first name (lib/names.ts rule). */
  name: string;
  /** Stored area scores; null for v1 rows (no weakest-area fallback). */
  areas: AreaScores | null;
}

/** Selection thresholds, in points (doc section 3). The SQL function uses the same values. */
export const PERSONAL_INSIGHTS_RULES = {
  /** |score - 50| for a trait to "stand out" (cards, tips). */
  standOut: 10,
  /** |gap| for they_higher / you_higher. */
  bigGap: 20,
  /** Weight needed for a 2nd challenge. */
  secondChallenge: 30,
  /** Weight needed for a 3rd challenge. */
  thirdChallenge: 40,
  /** Cross-trait: min difference on each of the two traits. */
  crossGap: 10,
} as const;

const GAP_COMBOS: readonly PairCombo[] = ['they_higher', 'you_higher'];
/** Traits whose both_low overlap leans challenge. */
const OVERLAP_RISKS: readonly QuizV2Trait[] = ['organization', 'kindness', 'chill'];
/** Cross-trait complements, in tie-break order (library key "a+b"). */
export const CROSS_PAIRS: readonly (readonly [QuizV2Trait, QuizV2Trait])[] = [
  ['social', 'curiosity'],
  ['social', 'organization'],
  ['social', 'kindness'],
  ['social', 'chill'],
  ['curiosity', 'organization'],
  ['curiosity', 'kindness'],
  ['curiosity', 'chill'],
  ['organization', 'kindness'],
  ['organization', 'chill'],
  ['kindness', 'chill'],
];

export type StrengthPick =
  | { kind: 'trait'; trait: QuizV2Trait; combo: PairCombo }
  | { kind: 'similar'; trait: QuizV2Trait }
  | { kind: 'cross'; pair: string; direction: CrossDirection };
export type ChallengePick =
  | { kind: 'trait'; trait: QuizV2Trait; combo: PairCombo }
  | { kind: 'area'; area: keyof AreaScores }
  | { kind: 'generic' };

/** Which library entries a screen uses, before any text is filled in. */
export interface PersonalInsightsPlan {
  /** Their 1-2 stand-out traits for card 1 (empty = balanced). */
  them: QuizV2Trait[];
  /** Your 1-2 stand-out traits for the "You" card (empty = balanced). */
  you: QuizV2Trait[];
  strengths: StrengthPick[];
  challenges: ChallengePick[];
  /** Their traits for the 3 tips. */
  tips: QuizV2Trait[];
}

const tenths = (value: number) => Math.round(value * 10);

export function getTraitLevel(score: number, levels: PersonalInsightsLibrary['levels']): TraitLevel {
  const value = tenths(score);
  if (value >= tenths(levels.high)) return 'high';
  if (value < tenths(levels.low)) return 'low';
  return 'medium';
}

/** Replaces {name} literally (no `$&`-style patterns from the name). */
function fillName(text: string, name: string): string {
  return text.split('{name}').join(name);
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Keys sorted by value (desc or asc), ties in declaration order. */
function rank<T>(keys: readonly T[], valueOf: (key: T) => number, direction: 'desc' | 'asc'): T[] {
  return keys
    .map((key, index) => ({ key, index, value: valueOf(key) }))
    .sort((x, y) => (direction === 'desc' ? y.value - x.value : x.value - y.value) || x.index - y.index)
    .map(item => item.key);
}

function leansChallenge(trait: QuizV2Trait, combo: PairCombo): boolean {
  return GAP_COMBOS.includes(combo) || (combo === 'both_low' && OVERLAP_RISKS.includes(trait));
}

function assertScores(input: Pick<PersonalInsightsInput, 'me' | 'them'>) {
  for (const trait of QUIZ_V2_TRAITS) {
    if (!Number.isFinite(input.me[trait]) || !Number.isFinite(input.them[trait])) throw new Error(`Missing trait score: ${trait}`);
  }
}

/** The selection rules (doc section 3), without texts. Same as planInsights() in the script. */
export function planPersonalInsights(
  levels: PersonalInsightsLibrary['levels'],
  input: Pick<PersonalInsightsInput, 'me' | 'them' | 'areas'>
): PersonalInsightsPlan {
  assertScores(input);
  const { me, them, areas } = input;
  const rules = PERSONAL_INSIGHTS_RULES;
  const high = tenths(levels.high);
  const low = tenths(levels.low);
  const M = (trait: QuizV2Trait) => tenths(me[trait]);
  const T = (trait: QuizV2Trait) => tenths(them[trait]);
  const gap = (trait: QuizV2Trait) => T(trait) - M(trait);

  // 1. Combo + weight per trait.
  const combo: Partial<Record<QuizV2Trait, PairCombo>> = {};
  const weight: Record<QuizV2Trait, number> = { social: 0, curiosity: 0, organization: 0, kindness: 0, chill: 0 };
  for (const trait of QUIZ_V2_TRAITS) {
    const g = gap(trait);
    if (Math.abs(g) >= rules.bigGap * 10) {
      combo[trait] = g > 0 ? 'they_higher' : 'you_higher';
      weight[trait] = Math.abs(g);
    } else if (M(trait) >= high && T(trait) >= high) {
      combo[trait] = 'both_high';
      weight[trait] = Math.abs(M(trait) + T(trait) - 1000);
    } else if (M(trait) < low && T(trait) < low) {
      combo[trait] = 'both_low';
      weight[trait] = Math.abs(M(trait) + T(trait) - 1000);
    }
  }
  const withCombo = QUIZ_V2_TRAITS.filter(trait => combo[trait]);
  const byWeight = (list: QuizV2Trait[]) => rank(list, trait => weight[trait], 'desc');
  const comboOf = (trait: QuizV2Trait) => combo[trait] as PairCombo;

  // 2. Challenges: an extra one needs its threshold, and as many combo traits still free
  // for strengths as there are challenges (never more challenges than strengths).
  const candidates = byWeight(withCombo.filter(trait => leansChallenge(trait, comboOf(trait))));
  const challengeTraits = candidates.slice(0, 1);
  const extraMin = [rules.secondChallenge, rules.thirdChallenge];
  for (let k = 1; k < candidates.length && k <= extraMin.length; k += 1) {
    const trait = candidates[k];
    if (weight[trait] < extraMin[k - 1] * 10) break;
    const free = withCombo.filter(other => other !== trait && !challengeTraits.includes(other)).length;
    if (free < challengeTraits.length + 1) break;
    challengeTraits.push(trait);
  }
  let challenges: ChallengePick[] = challengeTraits.map(trait => ({ kind: 'trait', trait, combo: comboOf(trait) }));
  if (!challenges.length) {
    challenges = areas ? [{ kind: 'area', area: rank(COMPATIBILITY_AREAS, area => tenths(areas[area]), 'asc')[0] }] : [{ kind: 'generic' }];
  }

  // 3. Strengths: strength-leaning shared combos, then gap combos, then overlap risks; max 3.
  const free = withCombo.filter(trait => !challengeTraits.includes(trait));
  const strengthTraits = [
    ...byWeight(free.filter(trait => !leansChallenge(trait, comboOf(trait)))),
    ...byWeight(free.filter(trait => GAP_COMBOS.includes(comboOf(trait)))),
    ...byWeight(free.filter(trait => comboOf(trait) === 'both_low' && OVERLAP_RISKS.includes(trait))),
  ].slice(0, 3);
  const strengths: StrengthPick[] = strengthTraits.map(trait => ({ kind: 'trait', trait, combo: comboOf(trait) }));
  const used: QuizV2Trait[] = [...challengeTraits, ...strengthTraits];
  for (const trait of rank(QUIZ_V2_TRAITS, item => Math.abs(gap(item)), 'asc')) {
    if (strengths.length >= 2) break;
    if (used.includes(trait)) continue;
    strengths.push({ kind: 'similar', trait });
    used.push(trait);
  }

  // 4. Cross-trait complement: optional 3rd strength, on two traits not used yet.
  if (strengths.length === 2) {
    const clear = (hi: number, lo: number) => hi >= high && lo < high && hi - lo >= rules.crossGap * 10;
    let best: { pair: string; direction: CrossDirection; value: number } | null = null;
    for (const [a, b] of CROSS_PAIRS) {
      if (used.includes(a) || used.includes(b)) continue;
      let candidate: { direction: CrossDirection; value: number } | null = null;
      if (clear(T(a), M(a)) && clear(M(b), T(b))) candidate = { direction: 'they_first', value: T(a) - M(a) + M(b) - T(b) };
      else if (clear(M(a), T(a)) && clear(T(b), M(b))) candidate = { direction: 'you_first', value: M(a) - T(a) + T(b) - M(b) };
      if (candidate && (!best || candidate.value > best.value)) best = { pair: `${a}+${b}`, ...candidate };
    }
    if (best) strengths.push({ kind: 'cross', pair: best.pair, direction: best.direction });
  }

  // 5. Tips (about them): top trait, biggest gap, then by stand-out; challenge traits skipped.
  const ordered = rank(QUIZ_V2_TRAITS, trait => Math.abs(T(trait) - 500), 'desc');
  const byGap = rank(QUIZ_V2_TRAITS, trait => Math.abs(gap(trait)), 'desc');
  const tips: QuizV2Trait[] = [];
  const isOpen = (trait: QuizV2Trait) => !challengeTraits.includes(trait) && !tips.includes(trait);
  const addTip = (trait: QuizV2Trait | undefined) => {
    if (trait && !tips.includes(trait) && tips.length < 3) tips.push(trait);
  };
  addTip(ordered.find(isOpen));
  addTip(byGap.find(isOpen));
  ordered.filter(isOpen).forEach(addTip);
  ordered.forEach(addTip);

  // 6. Cards: the 1-2 traits that stand out most.
  const card = (scoreOf: (trait: QuizV2Trait) => number) =>
    rank(QUIZ_V2_TRAITS, trait => Math.abs(scoreOf(trait) - 500), 'desc')
      .slice(0, 2)
      .filter(trait => Math.abs(scoreOf(trait) - 500) >= rules.standOut * 10);

  return { them: card(T), you: card(M), strengths, challenges, tips };
}

export function buildPersonalInsights(library: PersonalInsightsLibrary, input: PersonalInsightsInput): PersonalInsights {
  const { me, them, relationshipType: type, name } = input;
  const plan = planPersonalInsights(library.levels, input);
  // Every finished sentence starts with a capital, even with a lowercase name (email fallback).
  const fill = (text: string) => capitalizeFirst(fillName(text, name));
  const theirs = (trait: QuizV2Trait) => library.traits[trait][getTraitLevel(them[trait], library.levels)][type];
  const mine = (trait: QuizV2Trait) => library.traits[trait][getTraitLevel(me[trait], library.levels)][type];

  const label = fill(library.labels[type]);
  let theirWho = `${label} ${library.balanced[type]}.`;
  if (plan.them[0]) {
    theirWho = `${label} ${theirs(plan.them[0]).who}.`;
    // Sentence 2 starts with "They" (plural form), so the name isn't repeated.
    if (plan.them[1]) theirWho += ` ${theirs(plan.them[1]).who_they}.`;
  }
  let yourWho = library.you_balanced[type];
  if (plan.you[0]) {
    yourWho = mine(plan.you[0]).you;
    if (plan.you[1]) yourWho += ` ${mine(plan.you[1]).you_also}`;
  }

  const strengths = plan.strengths.map(item => {
    if (item.kind === 'trait') return fill(library.pairs[item.trait][item.combo][type].strength);
    if (item.kind === 'similar') return fill(library.similar[item.trait]);
    return fill(library.cross[item.pair][item.direction][type]);
  });
  const challenges = plan.challenges.map(item => {
    if (item.kind === 'trait') {
      const text = library.pairs[item.trait][item.combo][type].challenge;
      if (!text) throw new Error(`Missing challenge text: ${item.trait} ${item.combo} ${type}`);
      return fill(text);
    }
    if (item.kind === 'area') return library.areas[item.area].weak[type];
    return library.generic.challenge[type];
  });
  const tips = plan.tips.map(trait => fill(theirs(trait).tip));

  return { version: library.version, them: { name, who: theirWho }, you: { who: yourWho }, strengths, challenges, tips };
}

function isStringList(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(isText);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The RPC response (v2 shape), or null when it's missing or not the expected shape. */
export function parsePersonalInsights(data: unknown): PersonalInsights | null {
  const value = asObject(data);
  const theirs = asObject(value?.them);
  const yours = asObject(value?.you);
  if (!value || !theirs || !yours) return null;
  if (!isText(theirs.name) || !isText(theirs.who) || !isText(yours.who)) return null;
  if (!isStringList(value.strengths, 1, 3) || !isStringList(value.challenges, 1, 3) || !isStringList(value.tips, 1, 3)) return null;
  return {
    version: typeof value.version === 'number' ? value.version : 2,
    them: { name: theirs.name, who: theirs.who },
    you: { who: yours.who },
    strengths: value.strengths,
    challenges: value.challenges,
    tips: value.tips,
  };
}
