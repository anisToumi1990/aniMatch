import fixture from './fixtures/compatibilityV2-fixture.json';
import {
  AreaScores,
  COMPATIBILITY_AREAS,
  RELATIONSHIP_TYPES,
  computeCompatibilityV2,
  getAreaLevel,
  getClickAndClash,
  getStoredAreaScores,
  isRelationshipType,
} from '../compatibilityV2';
import type { TraitScores } from '../quizV2Scoring';
import { AREA_COPY, AREA_LABELS } from '../../constants/compatibilityCopy';

interface FixtureCase {
  name: string;
  a: TraitScores;
  b: TraitScores;
  areas: AreaScores;
  areasRounded: AreaScores;
  overall: Record<string, number>;
  overallRounded: Record<string, number>;
}

const cases = (fixture as { cases: FixtureCase[] }).cases;

function traits(social: number, curiosity: number, organization: number, kindness: number, chill: number): TraitScores {
  return { social, curiosity, organization, kindness, chill };
}

describe('computeCompatibilityV2 matches the shared fixture (also checked in SQL)', () => {
  it('has cases', () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  for (const c of cases) {
    for (const type of RELATIONSHIP_TYPES) {
      it(`${c.name} / ${type}`, () => {
        const result = computeCompatibilityV2(c.a, c.b, type);
        for (const area of COMPATIBILITY_AREAS) {
          expect(result.areas[area]).toBeCloseTo(c.areas[area], 6);
          expect(result.rounded.areas[area]).toBe(c.areasRounded[area]);
        }
        expect(result.overall).toBeCloseTo(c.overall[type], 6);
        expect(result.rounded.overall).toBe(c.overallRounded[type]);
      });
    }
  }
});

describe('computeCompatibilityV2 behaviour', () => {
  const a = traits(70, 40, 60, 65, 55);
  const b = traits(45, 75, 30, 50, 70);

  it('is symmetric', () => {
    for (const type of RELATIONSHIP_TYPES) {
      expect(computeCompatibilityV2(a, b, type).overall).toBeCloseTo(computeCompatibilityV2(b, a, type).overall, 10);
    }
  });

  it('keeps every score between 0 and 100, and the overall strictly inside', () => {
    const extremes = [traits(0, 0, 0, 0, 0), traits(100, 100, 100, 100, 100), traits(0, 100, 0, 100, 0)];
    for (const x of extremes) {
      for (const y of extremes) {
        const result = computeCompatibilityV2(x, y, 'lover');
        for (const area of COMPATIBILITY_AREAS) {
          expect(result.areas[area]).toBeGreaterThanOrEqual(0);
          expect(result.areas[area]).toBeLessThanOrEqual(100);
        }
        expect(result.overall).toBeGreaterThan(0);
        expect(result.overall).toBeLessThan(100);
      }
    }
  });

  it('rewards both people being kind and chill, not just being alike', () => {
    const kindAndChill = traits(50, 50, 50, 90, 90);
    const unkindAndTense = traits(50, 50, 50, 10, 10);
    const together = computeCompatibilityV2(kindAndChill, kindAndChill, 'family');
    const alikeButTense = computeCompatibilityV2(unkindAndTense, unkindAndTense, 'family');
    expect(together.areas.conflict).toBeGreaterThan(alikeButTense.areas.conflict + 30);
    expect(together.overall).toBeGreaterThan(alikeButTense.overall);
  });

  it('weights areas differently per relationship type', () => {
    const results = RELATIONSHIP_TYPES.map(type => computeCompatibilityV2(a, b, type).overall);
    expect(new Set(results.map(Math.round)).size).toBeGreaterThan(1);
  });

  it('throws on a missing trait', () => {
    const broken = { ...a, chill: undefined } as unknown as TraitScores;
    expect(() => computeCompatibilityV2(broken, b, 'lover')).toThrow();
  });
});

describe('levels and click / clash', () => {
  it('maps scores to levels at 70 and 45', () => {
    expect(getAreaLevel(70)).toBe('high');
    expect(getAreaLevel(69)).toBe('medium');
    expect(getAreaLevel(45)).toBe('medium');
    expect(getAreaLevel(44)).toBe('low');
  });

  it('picks the highest area to click and the lowest to clash', () => {
    const result = getClickAndClash({ communication: 60, energy: 88, conflict: 30, values: 55 });
    expect(result.click).toEqual({ area: 'energy', score: 88, level: 'high' });
    expect(result.clash).toEqual({ area: 'conflict', score: 30, level: 'low' });
  });

  it('has no clash when every area is high, and breaks ties in area order', () => {
    const result = getClickAndClash({ communication: 80, energy: 80, conflict: 75, values: 90 });
    expect(result.click.area).toBe('values');
    expect(result.clash).toBeNull();
    expect(getClickAndClash({ communication: 50, energy: 50, conflict: 50, values: 50 }).click.area).toBe('communication');
  });

  it('reads area scores only from v2 rows', () => {
    const row = { compatibility_version: 2, communication_score: 1, energy_score: 2, conflict_score: 3, values_score: 4 };
    expect(getStoredAreaScores(row)).toEqual({ communication: 1, energy: 2, conflict: 3, values: 4 });
    expect(getStoredAreaScores({ ...row, compatibility_version: 1 })).toBeNull();
    expect(getStoredAreaScores({ ...row, values_score: null })).toBeNull();
    expect(getStoredAreaScores({})).toBeNull();
  });

  it('accepts only the 3 relationship types', () => {
    expect(isRelationshipType('lover')).toBe(true);
    expect(isRelationshipType('friend')).toBe(false);
    expect(isRelationshipType(null)).toBe(false);
  });
});

describe('copy', () => {
  it('has a label and a text for every area and level, short enough for a card', () => {
    for (const area of COMPATIBILITY_AREAS) {
      expect(AREA_LABELS[area].length).toBeGreaterThan(0);
      for (const level of ['high', 'medium', 'low'] as const) {
        const text = AREA_COPY[area][level];
        expect(text.length).toBeGreaterThan(10);
        expect(text.length).toBeLessThanOrEqual(110);
      }
    }
  });
});
