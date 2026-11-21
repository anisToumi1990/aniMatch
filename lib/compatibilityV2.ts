/**
 * Compatibility v2 (pure). See docs/compatibility-v2-proposal.md.
 *
 * The real scores are computed in the database (compatibility_v2_scores(), which reads
 * compatibility_v2_settings), because they need both people's traits. This file is the
 * reference implementation with the same default settings, checked against the shared
 * fixture (lib/__tests__/fixtures/compatibilityV2-fixture.json) in Jest and in SQL
 * (supabase/migrations/20261122100100_compatibility_v2_check.sql). It also picks the
 * "Where you click" / "Where you clash" areas for the UI.
 *
 * Keep in sync with scripts/compatibility-v2-simulation.js, which generates the fixture.
 */
import { QUIZ_V2_TRAITS, QuizV2Trait, TraitScores } from './quizV2Scoring';

export const COMPATIBILITY_AREAS = ['communication', 'energy', 'conflict', 'values'] as const;
export type CompatibilityArea = (typeof COMPATIBILITY_AREAS)[number];
export type AreaScores = Record<CompatibilityArea, number>;

export const RELATIONSHIP_TYPES = ['lover', 'business_partner', 'family'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

type TermKind = 'sim' | 'both';
type AreaTerm = [TermKind, QuizV2Trait, number];

/** sim(t) = 100 - |a - b|; both(t) = 0.5 * mean + 0.5 * min. Weights per area sum to 1. */
const AREA_TERMS: Record<CompatibilityArea, AreaTerm[]> = {
  communication: [
    ['sim', 'social', 0.35],
    ['sim', 'curiosity', 0.25],
    ['both', 'kindness', 0.4],
  ],
  energy: [
    ['sim', 'social', 0.45],
    ['sim', 'curiosity', 0.35],
    ['sim', 'chill', 0.2],
  ],
  conflict: [
    ['both', 'chill', 0.4],
    ['both', 'kindness', 0.35],
    ['sim', 'organization', 0.25],
  ],
  values: [
    ['both', 'organization', 0.35],
    ['sim', 'organization', 0.2],
    ['sim', 'curiosity', 0.25],
    ['sim', 'kindness', 0.2],
  ],
};

export interface AreaCalibration {
  center: number;
  stretch: number;
}

export interface CompatibilityV2Settings {
  areaTarget: number;
  areas: Record<CompatibilityArea, AreaCalibration>;
  weights: Record<CompatibilityArea, number>;
  overallCenter: number;
  overallSlope: number;
  overallP5: number;
  overallP95: number;
}

const DEFAULT_AREA_CALIBRATION: Record<CompatibilityArea, AreaCalibration> = {
  communication: { center: 65, stretch: 1.88 },
  energy: { center: 78, stretch: 1.77 },
  conflict: { center: 54, stretch: 2.08 },
  values: { center: 66, stretch: 2.08 },
};

/** Same values as the seed rows of compatibility_v2_settings. */
export const DEFAULT_COMPATIBILITY_V2_SETTINGS: Record<RelationshipType, CompatibilityV2Settings> = {
  lover: {
    areaTarget: 62,
    areas: DEFAULT_AREA_CALIBRATION,
    weights: { communication: 0.3, energy: 0.3, conflict: 0.25, values: 0.15 },
    overallCenter: 61.5,
    overallSlope: 0.072,
    overallP5: 28,
    overallP95: 90,
  },
  business_partner: {
    areaTarget: 62,
    areas: DEFAULT_AREA_CALIBRATION,
    weights: { communication: 0.25, energy: 0.1, conflict: 0.2, values: 0.45 },
    overallCenter: 61.8,
    overallSlope: 0.073,
    overallP5: 28,
    overallP95: 90,
  },
  family: {
    areaTarget: 62,
    areas: DEFAULT_AREA_CALIBRATION,
    weights: { communication: 0.2, energy: 0.05, conflict: 0.45, values: 0.3 },
    overallCenter: 62.0,
    overallSlope: 0.071,
    overallP5: 28,
    overallP95: 90,
  },
};

export interface CompatibilityV2Result {
  /** Unrounded, as computed. */
  areas: AreaScores;
  overall: number;
  /** What gets stored: whole numbers. */
  rounded: { areas: AreaScores; overall: number };
}

export function isRelationshipType(value: string | null | undefined): value is RelationshipType {
  return (RELATIONSHIP_TYPES as readonly (string | null | undefined)[]).includes(value);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function logit(p: number): number {
  return Math.log(p / (1 - p));
}

export function rawAreaScore(area: CompatibilityArea, a: TraitScores, b: TraitScores): number {
  let total = 0;
  for (const [kind, trait, weight] of AREA_TERMS[area]) {
    const x = a[trait];
    const y = b[trait];
    const value = kind === 'sim' ? 100 - Math.abs(x - y) : 0.5 * ((x + y) / 2) + 0.5 * Math.min(x, y);
    total += weight * value;
  }
  return total;
}

export function computeCompatibilityV2(
  a: TraitScores,
  b: TraitScores,
  relationshipType: RelationshipType,
  settings: CompatibilityV2Settings = DEFAULT_COMPATIBILITY_V2_SETTINGS[relationshipType]
): CompatibilityV2Result {
  for (const trait of QUIZ_V2_TRAITS) {
    if (!Number.isFinite(a[trait]) || !Number.isFinite(b[trait])) throw new Error(`Missing trait score: ${trait}`);
  }

  const areas = {} as AreaScores;
  for (const area of COMPATIBILITY_AREAS) {
    const { center, stretch } = settings.areas[area];
    areas[area] = clamp(settings.areaTarget + (rawAreaScore(area, a, b) - center) * stretch);
  }

  const average = COMPATIBILITY_AREAS.reduce((sum, area) => sum + settings.weights[area] * areas[area], 0);
  const mid = (logit(settings.overallP5 / 100) + logit(settings.overallP95 / 100)) / 2;
  const overall = 100 / (1 + Math.exp(-(mid + settings.overallSlope * (average - settings.overallCenter))));

  const roundedAreas = {} as AreaScores;
  for (const area of COMPATIBILITY_AREAS) roundedAreas[area] = Math.round(areas[area]);
  return { areas, overall, rounded: { areas: roundedAreas, overall: Math.round(overall) } };
}

// ---------------------------------------------------------------------------
// UI helpers: levels and "Where you click" / "Where you clash"
// ---------------------------------------------------------------------------

export type AreaLevel = 'high' | 'medium' | 'low';

export const AREA_LEVEL_THRESHOLDS = { high: 70, low: 45 };

export function getAreaLevel(score: number): AreaLevel {
  if (score >= AREA_LEVEL_THRESHOLDS.high) return 'high';
  if (score >= AREA_LEVEL_THRESHOLDS.low) return 'medium';
  return 'low';
}

export interface AreaHighlight {
  area: CompatibilityArea;
  score: number;
  level: AreaLevel;
}

export interface ClickAndClash {
  click: AreaHighlight;
  /** Null when every area is high: nothing worth calling a clash. */
  clash: AreaHighlight | null;
}

/** Click = the highest area, clash = the lowest one unless it's high. Ties: COMPATIBILITY_AREAS order. */
export function getClickAndClash(areas: AreaScores): ClickAndClash {
  const sorted = COMPATIBILITY_AREAS.map((area, index) => ({ area, index, score: areas[area] })).sort(
    (x, y) => y.score - x.score || x.index - y.index
  );
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const click: AreaHighlight = { area: top.area, score: top.score, level: getAreaLevel(top.score) };
  const bottomLevel = getAreaLevel(bottom.score);
  const clash = bottomLevel === 'high' ? null : { area: bottom.area, score: bottom.score, level: bottomLevel };
  return { click, clash };
}

/** Area scores from a compatibility_results row, or null for v1 rows / missing columns. */
export function getStoredAreaScores(row: {
  compatibility_version?: number | null;
  communication_score?: number | null;
  energy_score?: number | null;
  conflict_score?: number | null;
  values_score?: number | null;
}): AreaScores | null {
  if (row.compatibility_version !== 2) return null;
  const scores = [row.communication_score, row.energy_score, row.conflict_score, row.values_score];
  if (scores.some(score => score === null || score === undefined)) return null;
  return {
    communication: row.communication_score as number,
    energy: row.energy_score as number,
    conflict: row.conflict_score as number,
    values: row.values_score as number,
  };
}
