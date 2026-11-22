import fixture from './fixtures/personalInsights-fixture.json';
import library from '../../supabase/content/personal-insights/library.json';
import {
  PersonalInsights,
  PersonalInsightsLibrary,
  buildPersonalInsights,
  getTraitLevel,
  parsePersonalInsights,
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

const lib = library as PersonalInsightsLibrary;
const cases = (fixture as { cases: FixtureCase[] }).cases;

describe('buildPersonalInsights (shared fixture, also checked in SQL)', () => {
  it('has cases for every relationship type, with and without areas', () => {
    expect(cases.length).toBeGreaterThan(50);
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

describe('screen rules', () => {
  it.each(cases.map(c => [c.name, c] as const))('%s: sizes, no repeats, gender-neutral', (_name, c) => {
    const { who, strengths, challenges, tips, pair } = c.expected;
    expect(strengths.length).toBeGreaterThanOrEqual(2);
    expect(strengths.length).toBeLessThanOrEqual(3);
    expect(challenges.length).toBeGreaterThanOrEqual(1);
    expect(challenges.length).toBeLessThanOrEqual(2);
    expect(tips).toHaveLength(3);
    const all = [who, ...strengths, ...challenges, ...tips, pair];
    expect(new Set(all).size).toBe(all.length);
    all.forEach(text => {
      expect(text).not.toMatch(/\{name\}|\{Label\}/);
      expect(text).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
      expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
    });
    // "Who they are" names them once; a 2nd sentence starts with "They".
    expect(who.toLowerCase().split(c.person.toLowerCase()).length - 1).toBe(1);
    const second = who.split('. ')[1];
    if (second) expect(second).toMatch(/^They\b/);
  });

  it('uses the relationship label only to open "Who they are"', () => {
    const them = { social: 80, curiosity: 50, organization: 50, kindness: 50, chill: 50 };
    const me = { social: 50, curiosity: 50, organization: 50, kindness: 50, chill: 50 };
    const build = (relationshipType: RelationshipType) =>
      buildPersonalInsights(lib, { me, them, relationshipType, name: 'Taieb', areas: null }).who;
    expect(build('lover')).toMatch(/^Your partner Taieb /);
    expect(build('business_partner')).toMatch(/^Your business partner Taieb /);
    expect(build('family')).toMatch(/^Taieb /);
  });

  it('throws on a missing trait score', () => {
    const me = { social: 50, curiosity: 50, organization: 50, kindness: 50, chill: 50 };
    const them = { ...me, chill: Number.NaN };
    expect(() => buildPersonalInsights(lib, { me, them, relationshipType: 'lover', name: 'Sam', areas: null })).toThrow('chill');
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

  it('accepts the RPC shape', () => {
    expect(parsePersonalInsights(valid)).toEqual(valid);
  });

  it('rejects null, wrong types and empty lists', () => {
    expect(parsePersonalInsights(null)).toBeNull();
    expect(parsePersonalInsights('text')).toBeNull();
    expect(parsePersonalInsights([valid])).toBeNull();
    expect(parsePersonalInsights({ ...valid, who: '' })).toBeNull();
    expect(parsePersonalInsights({ ...valid, tips: [] })).toBeNull();
    expect(parsePersonalInsights({ ...valid, strengths: ['ok', 3] })).toBeNull();
    expect(parsePersonalInsights({ ...valid, pair: undefined })).toBeNull();
  });
});
