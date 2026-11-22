/**
 * Personal insights (pure). See docs/personal-insights-proposal.md, section 3.
 *
 * The app never runs this: the real texts come from the database RPC
 * get_personal_insights(result_id), which needs both people's traits. This file is
 * the reference implementation of the selection rules, checked against the shared
 * fixture (lib/__tests__/fixtures/personalInsights-fixture.json) in Jest and in SQL
 * (supabase/migrations/20261122120200_personal_insights_check.sql), so the SQL
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
export type InsightSection = 'who' | 'strength' | 'challenge' | 'tip';

/** supabase/content/personal-insights/library.json */
export interface PersonalInsightsLibrary {
  version: number;
  levels: { high: number; low: number };
  labels: Record<RelationshipType, string>;
  traits: Record<QuizV2Trait, Record<TraitLevel, Record<RelationshipType, Record<InsightSection, string>>>>;
  balanced: Record<RelationshipType, string>;
  difference: Record<QuizV2Trait, Record<'they_higher' | 'you_higher', Record<RelationshipType, string>>>;
  similar: Record<QuizV2Trait, string>;
  areas: Record<keyof AreaScores, Record<'strong' | 'weak', Record<RelationshipType, string>>>;
}

/** What get_personal_insights returns: finished texts only. */
export interface PersonalInsights {
  version: number;
  who: string;
  strengths: string[];
  challenges: string[];
  tips: string[];
  pair: string;
}

export interface PersonalInsightsInput {
  /** The viewer. */
  me: TraitScores;
  /** The other person in the match: every text is about them. */
  them: TraitScores;
  relationshipType: RelationshipType;
  /** Their first name (lib/names.ts rule). */
  name: string;
  /** Stored area scores; null for v1 rows (the "Your pair" area sentence is skipped). */
  areas: AreaScores | null;
}

/** Selection thresholds, in points (doc section 3). The SQL function uses the same values. */
export const PERSONAL_INSIGHTS_RULES = {
  /** |score - 50| for a trait to "stand out". */
  standOut: 10,
  /** Challenge score (stand-out + 0.5 x |gap|) needed for a 2nd challenge. */
  secondChallenge: 25,
  /** Trait gap for a "difference" sentence. */
  bigGap: 20,
  /** Below this, "Your pair" uses the weakest area's advice. */
  weakArea: 55,
  /** Otherwise, at or above this, the strongest area's text (else no 2nd sentence). */
  strongArea: 70,
} as const;

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

interface Ranked<T> {
  key: T;
  index: number;
  value: number;
}

/** Sorted by value (desc or asc), ties in declaration order. */
function rank<T>(keys: readonly T[], valueOf: (key: T) => number, direction: 'desc' | 'asc'): Ranked<T>[] {
  return keys
    .map((key, index) => ({ key, index, value: valueOf(key) }))
    .sort((x, y) => (direction === 'desc' ? y.value - x.value : x.value - y.value) || x.index - y.index);
}

export function buildPersonalInsights(library: PersonalInsightsLibrary, input: PersonalInsightsInput): PersonalInsights {
  const { me, them, relationshipType: type, name, areas } = input;
  for (const trait of QUIZ_V2_TRAITS) {
    if (!Number.isFinite(me[trait]) || !Number.isFinite(them[trait])) throw new Error(`Missing trait score: ${trait}`);
  }
  const rules = PERSONAL_INSIGHTS_RULES;
  const label = capitalizeFirst(fillName(library.labels[type], name));
  const level = (trait: QuizV2Trait) => getTraitLevel(them[trait], library.levels);
  const entry = (trait: QuizV2Trait) => library.traits[trait][level(trait)][type];
  // Every finished sentence starts with a capital, even with a lowercase name (email fallback).
  const text = (trait: QuizV2Trait, section: Exclude<InsightSection, 'who'>) => capitalizeFirst(fillName(entry(trait)[section], name));

  // All in tenths of a point.
  const standOut = (trait: QuizV2Trait) => Math.abs(tenths(them[trait]) - 500);
  const gap = (trait: QuizV2Trait) => tenths(them[trait]) - tenths(me[trait]);
  const ordered = rank(QUIZ_V2_TRAITS, standOut, 'desc');
  const standsOut = (item: Ranked<QuizV2Trait> | undefined) => !!item && item.value >= rules.standOut * 10;

  // 1. Who they are: the 1-2 traits that stand out most.
  let who: string;
  if (!standsOut(ordered[0])) {
    who = `${label} ${library.balanced[type]}.`;
  } else {
    who = `${label} ${entry(ordered[0].key).who}.`;
    if (standsOut(ordered[1])) who += ` ${capitalizeFirst(`${name} ${entry(ordered[1].key).who}`)}.`;
  }

  // 2. Strengths: top 2 traits, plus the 3rd if it stands out.
  const strengthTraits = ordered.slice(0, 3).filter((item, index) => index < 2 || standsOut(item)).map(item => item.key);
  const strengths = strengthTraits.map(trait => text(trait, 'strength'));

  // 3. Challenges: stand-out + 0.5 x |gap| (doubled here to stay in integers).
  const challengeOrder = rank(QUIZ_V2_TRAITS, trait => 2 * standOut(trait) + Math.abs(gap(trait)), 'desc');
  const challengeTraits = [challengeOrder[0].key];
  if (challengeOrder[1].value >= 2 * rules.secondChallenge * 10) challengeTraits.push(challengeOrder[1].key);
  const challenges = challengeTraits.map(trait => text(trait, 'challenge'));

  // 4. Tips: 3 different traits (top trait, biggest gap, first challenge), then fill by stand-out.
  const byGap = rank(QUIZ_V2_TRAITS, trait => Math.abs(gap(trait)), 'desc');
  const tipTraits: QuizV2Trait[] = [];
  const addTip = (trait: QuizV2Trait | undefined) => {
    if (trait && !tipTraits.includes(trait) && tipTraits.length < 3) tipTraits.push(trait);
  };
  addTip(ordered[0].key);
  addTip(byGap.find(item => !tipTraits.includes(item.key))?.key);
  addTip(challengeTraits.find(trait => !tipTraits.includes(trait)));
  ordered.forEach(item => addTip(item.key));
  const tips = tipTraits.map(trait => text(trait, 'tip'));

  // 5. Your pair: biggest trait difference (or closest trait), then the areas.
  const biggest = byGap[0];
  let pair: string;
  if (biggest.value >= rules.bigGap * 10) {
    const direction = gap(biggest.key) > 0 ? 'they_higher' : 'you_higher';
    pair = capitalizeFirst(fillName(library.difference[biggest.key][direction][type], name));
  } else {
    pair = capitalizeFirst(fillName(library.similar[byGap[byGap.length - 1].key], name));
  }
  if (areas) {
    const weakest = rank(COMPATIBILITY_AREAS, area => tenths(areas[area]), 'asc')[0];
    const strongest = rank(COMPATIBILITY_AREAS, area => tenths(areas[area]), 'desc')[0];
    if (weakest.value < rules.weakArea * 10) pair += ` ${library.areas[weakest.key].weak[type]}`;
    else if (strongest.value >= rules.strongArea * 10) pair += ` ${library.areas[strongest.key].strong[type]}`;
  }

  return { version: library.version, who, strengths, challenges, tips, pair };
}

function isStringList(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => typeof item === 'string' && item.trim() !== '');
}

/** The RPC response, or null when it's missing or not the expected shape. */
export function parsePersonalInsights(data: unknown): PersonalInsights | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (typeof value.who !== 'string' || !value.who.trim()) return null;
  if (typeof value.pair !== 'string' || !value.pair.trim()) return null;
  if (!isStringList(value.strengths, 1, 3) || !isStringList(value.challenges, 1, 2) || !isStringList(value.tips, 1, 3)) return null;
  return {
    version: typeof value.version === 'number' ? value.version : 1,
    who: value.who,
    strengths: value.strengths,
    challenges: value.challenges,
    tips: value.tips,
    pair: value.pair,
  };
}
