import fixture from './fixtures/personalInsights-fixture.json';
import library from '../../supabase/content/personal-insights/library.json';
import {
  ChallengePick,
  PersonalInsights,
  PersonalInsightsLibrary,
  StrengthPick,
  buildPersonalInsights,
  getTraitLevel,
  parsePersonalInsights,
  planPersonalInsights,
} from '../personalInsights';
import type { AreaScores, RelationshipType } from '../compatibilityV2';
import type { TraitScores } from '../quizV2Scoring';

interface FixtureCase {
  name: string;
  relationshipType: RelationshipType;
  person: string;
  me: TraitScores;
  them: TraitScores;
  areas: AreaScores | null;
  expected: PersonalInsights;
}

const lib = library as unknown as PersonalInsightsLibrary;
const cases = (fixture as unknown as { cases: FixtureCase[] }).cases;
const mid: TraitScores = { social: 50, curiosity: 50, organization: 50, kindness: 50, chill: 50 };

describe('buildPersonalInsights (shared fixture, also checked in SQL)', () => {
  it('has cases for every relationship type, with and without areas', () => {
    expect(cases.length).toBeGreaterThan(80);
    expect(new Set(cases.map(c => c.relationshipType))).toEqual(new Set(['lover', 'business_partner', 'family']));
    expect(cases.some(c => c.areas === null)).toBe(true);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const result = buildPersonalInsights(lib, {
      me: c.me,
      them: c.them,
      relationshipType: c.relationshipType,
      name: c.person,
      areas: c.areas,
    });
    expect(result).toEqual(c.expected);
  });
});

/** Traits a pick uses (a cross-trait strength uses two). */
function traitsOf(item: StrengthPick | ChallengePick): string[] {
  if (item.kind === 'cross') return item.pair.split('+');
  if (item.kind === 'trait' || item.kind === 'similar') return [item.trait];
  return [];
}

describe('screen rules', () => {
  it.each(cases.map(c => [c.name, c] as const))('%s: sizes, no repeats, gender-neutral', (_name, c) => {
    const { them, you, strengths, challenges, tips } = c.expected;
    expect(strengths.length).toBeGreaterThanOrEqual(2);
    expect(strengths.length).toBeLessThanOrEqual(3);
    expect(challenges.length).toBeGreaterThanOrEqual(1);
    expect(challenges.length).toBeLessThanOrEqual(strengths.length);
    expect(tips).toHaveLength(3);
    expect(them.name).toBe(c.person);
    const all = [them.who, you.who, ...strengths, ...challenges, ...tips];
    expect(new Set(all).size).toBe(all.length);
    all.forEach(text => {
      expect(text).not.toMatch(/\{name\}|\{Label\}/);
      expect(text).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
      expect(text).not.toMatch(/together/i);
      expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
    });
    // Card 1 names them once; a 2nd sentence starts with "They". The "You" card starts with "You".
    expect(them.who.toLowerCase().split(c.person.toLowerCase()).length - 1).toBe(1);
    const second = them.who.split('. ')[1];
    if (second) expect(second).toMatch(/^They\b/);
    expect(you.who).toMatch(/^You\b/);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s: no trait twice, tips skip challenge traits', (_name, c) => {
    const plan = planPersonalInsights(lib.levels, c);
    const used = [...plan.strengths, ...plan.challenges].flatMap(traitsOf);
    expect(new Set(used).size).toBe(used.length);
    const challengeTraits = plan.challenges.flatMap(traitsOf);
    expect(plan.tips.filter(trait => challengeTraits.includes(trait))).toEqual([]);
    expect(new Set(plan.tips).size).toBe(3);
  });

  it('only ever adds a cross-trait strength as the 3rd one', () => {
    const withCross = cases.map(c => planPersonalInsights(lib.levels, c)).filter(plan => plan.strengths.some(item => item.kind === 'cross'));
    expect(withCross.length).toBeGreaterThan(2);
    withCross.forEach(plan => {
      expect(plan.strengths).toHaveLength(3);
      expect(plan.strengths[2].kind).toBe('cross');
    });
  });

  it('uses the relationship label only to open card 1', () => {
    const them = { ...mid, social: 80 };
    const build = (relationshipType: RelationshipType) =>
      buildPersonalInsights(lib, { me: mid, them, relationshipType, name: 'Taieb', areas: null }).them.who;
    expect(build('lover')).toMatch(/^Your partner Taieb /);
    expect(build('business_partner')).toMatch(/^Your business partner Taieb /);
    expect(build('family')).toMatch(/^Taieb /);
  });

  it('throws on a missing trait score', () => {
    const them = { ...mid, chill: Number.NaN };
    expect(() => buildPersonalInsights(lib, { me: mid, them, relationshipType: 'lover', name: 'Sam', areas: null })).toThrow('chill');
  });
});

describe('symmetry: both people get the same traits, each from their side', () => {
  const swap: Record<string, string> = { they_higher: 'you_higher', you_higher: 'they_higher', they_first: 'you_first', you_first: 'they_first' };
  const mirror = (item: StrengthPick | ChallengePick) => {
    if (item.kind === 'trait') return { ...item, combo: swap[item.combo] ?? item.combo };
    if (item.kind === 'cross') return { ...item, direction: swap[item.direction] };
    return item;
  };

  it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const mine = planPersonalInsights(lib.levels, { me: c.me, them: c.them, areas: c.areas });
    const theirs = planPersonalInsights(lib.levels, { me: c.them, them: c.me, areas: c.areas });
    expect(theirs.strengths.map(mirror)).toEqual(mine.strengths);
    expect(theirs.challenges.map(mirror)).toEqual(mine.challenges);
    expect(theirs.you).toEqual(mine.them);
  });
});

describe('getTraitLevel', () => {
  it('uses high >= 60 and low < 40', () => {
    expect(getTraitLevel(60, lib.levels)).toBe('high');
    expect(getTraitLevel(59.9, lib.levels)).toBe('medium');
    expect(getTraitLevel(40, lib.levels)).toBe('medium');
    expect(getTraitLevel(39.9, lib.levels)).toBe('low');
  });
});

describe('parsePersonalInsights', () => {
  const valid = cases[0].expected;

  it('accepts the v2 RPC shape', () => {
    expect(parsePersonalInsights(valid)).toEqual(valid);
  });

  it('rejects null, wrong types, empty lists and the v1 shape', () => {
    expect(parsePersonalInsights(null)).toBeNull();
    expect(parsePersonalInsights('text')).toBeNull();
    expect(parsePersonalInsights([valid])).toBeNull();
    expect(parsePersonalInsights({ ...valid, them: { ...valid.them, who: '' } })).toBeNull();
    expect(parsePersonalInsights({ ...valid, them: { who: valid.them.who } })).toBeNull();
    expect(parsePersonalInsights({ ...valid, you: null })).toBeNull();
    expect(parsePersonalInsights({ ...valid, tips: [] })).toBeNull();
    expect(parsePersonalInsights({ ...valid, strengths: ['ok', 3] })).toBeNull();
    expect(parsePersonalInsights({ version: 1, who: 'x', strengths: ['a'], challenges: ['b'], tips: ['c'], pair: 'd' })).toBeNull();
  });
});
