#!/usr/bin/env node
/**
 * Compatibility v2 simulation. Proposal only: nothing in the app uses this yet.
 * See docs/compatibility-v2-proposal.md.
 *
 * Model (0-100 everywhere):
 *   sim(t)  = 100 - |a.t - b.t|                       similarity on trait t
 *   both(t) = 0.5 * mean(a.t, b.t) + 0.5 * min(a.t, b.t)   "both high" (the lower one counts double)
 *   Area raw scores = weighted sums of sim/both terms (AREAS below).
 *   Area score = clamp(target + (raw - center) * stretch), per area (CALIBRATION), so area
 *   scores spread out instead of all landing around 70.
 *   Overall = weighted average of the 4 areas (RELATIONSHIP_WEIGHTS), then an S-curve
 *   (OVERALL_CALIBRATION) because averaging pulls scores back to the middle. The S-curve
 *   never reaches 0 or 100, so near-identical pairs land in the high 90s instead of piling up at 100.
 *
 * Usage:
 *   node scripts/compatibility-v2-simulation.js                       # 20,000 pairs, seed 42
 *   node scripts/compatibility-v2-simulation.js 50000 7               # pairs, seed
 *   node scripts/compatibility-v2-simulation.js --noise=15            # trait noise (sd) around each animal
 *   node scripts/compatibility-v2-simulation.js --current=<file.json> # compare with animal_compatibility
 *   node scripts/compatibility-v2-simulation.js --calibrate           # print suggested calibration
 *   node scripts/compatibility-v2-simulation.js --fixture             # write the shared test fixture
 *
 * --fixture writes lib/__tests__/fixtures/compatibilityV2-fixture.json (checked by Jest against
 * lib/compatibilityV2.ts) and supabase/migrations/20261122100100_compatibility_v2_check.sql
 * (checks the SQL function compatibility_v2_scores() against the same cases). This script is the
 * reference model: change a formula or constant here, in lib/compatibilityV2.ts and in the
 * compatibility_v2_settings seed / SQL function together, then regenerate.
 *
 * --current: JSON array of rows exported from public.animal_compatibility (see the doc,
 * section 5). Animal columns can be ids or names; a relationship_type column is optional.
 */
const fs = require('fs');

const TRAITS = ['social', 'curiosity', 'organization', 'kindness', 'chill'];

// Same ids/order as animal_auras; profiles = final table in docs/quiz-v2-proposal.md.
const PROFILES = {
  1: { name: 'Dolphin', scores: [78, 58, 42, 72, 48] },
  2: { name: 'Peacock', scores: [74, 50, 60, 30, 34] },
  3: { name: 'Lion', scores: [70, 36, 68, 44, 58] },
  4: { name: 'Fox', scores: [60, 74, 36, 34, 52] },
  5: { name: 'Parrot', scores: [76, 66, 30, 54, 32] },
  6: { name: 'Owl', scores: [28, 66, 64, 50, 68] },
  7: { name: 'Wolf', scores: [54, 30, 62, 70, 34] },
  8: { name: 'Bear', scores: [26, 32, 68, 56, 70] },
  9: { name: 'Unicorn', scores: [46, 76, 32, 66, 50] },
  10: { name: 'Elephant', scores: [50, 40, 62, 76, 70] },
  11: { name: 'Snake', scores: [28, 62, 54, 30, 64] },
  12: { name: 'Cat', scores: [26, 70, 34, 38, 46] },
  13: { name: 'Eagle', scores: [42, 50, 78, 30, 46] },
  14: { name: 'Deer', scores: [28, 44, 40, 78, 38] },
  15: { name: 'Otter', scores: [66, 58, 30, 58, 72] },
};

// Each area: list of [kind, trait, weight]; weights sum to 1.
const AREAS = {
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
const AREA_NAMES = Object.keys(AREAS);

// raw -> target + (raw - center) * stretch, clamped to 0-100. Tuned with --calibrate:
// center = median raw score of simulated pairs, stretch so p5-p95 spans AREA_SPAN.
const AREA_TARGET = 62;
const AREA_SPAN = 60; // p5 ~32, p95 ~92
const CALIBRATION = {
  communication: { center: 65, stretch: 1.88, target: AREA_TARGET },
  energy: { center: 78, stretch: 1.77, target: AREA_TARGET },
  conflict: { center: 54, stretch: 2.08, target: AREA_TARGET },
  values: { center: 66, stretch: 2.08, target: AREA_TARGET },
};

const RELATIONSHIP_WEIGHTS = {
  lover: { communication: 0.3, energy: 0.3, conflict: 0.25, values: 0.15 },
  business_partner: { communication: 0.25, energy: 0.1, conflict: 0.2, values: 0.45 },
  family: { communication: 0.2, energy: 0.05, conflict: 0.45, values: 0.3 },
};
const RELATIONSHIP_TYPES = Object.keys(RELATIONSHIP_WEIGHTS);

// Overall S-curve per relationship type: 100 / (1 + e^-(OVERALL_MID + slope * (average - center))).
// Tuned with --calibrate so simulated pairs land at p5 ~OVERALL_P5, median ~65, p95 ~OVERALL_P95.
const OVERALL_P5 = 28;
const OVERALL_P95 = 90;
const OVERALL_CALIBRATION = {
  lover: { center: 61.5, slope: 0.072 },
  business_partner: { center: 61.8, slope: 0.073 },
  family: { center: 62.0, slope: 0.071 },
};

function logit(p) {
  return Math.log(p / (1 - p));
}
const OVERALL_MID = (logit(OVERALL_P5 / 100) + logit(OVERALL_P95 / 100)) / 2;

function overallCurve(average, { center, slope }) {
  return 100 / (1 + Math.exp(-(OVERALL_MID + slope * (average - center))));
}

// Area text levels: high (where you click) >= HIGH, low (where you clash) < LOW, medium in between.
const LEVELS = { high: 70, low: 45 };

const GOAL = { p5Max: 40, p95Min: 85, sdMin: 13 }; // overall scores of simulated pairs

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function stretch(raw, { center, stretch: factor, target }) {
  return clamp(target + (raw - center) * factor);
}

function toTraits(scores) {
  return Object.fromEntries(TRAITS.map((trait, i) => [trait, scores[i]]));
}

function rawArea(area, a, b) {
  let total = 0;
  for (const [kind, trait, weight] of AREAS[area]) {
    const x = a[trait];
    const y = b[trait];
    const value = kind === 'sim' ? 100 - Math.abs(x - y) : 0.5 * ((x + y) / 2) + 0.5 * Math.min(x, y);
    total += weight * value;
  }
  return total;
}

/** Area scores (calibrated) and overall per relationship type. */
function compatibility(a, b, calibration = CALIBRATION, overallCalibration = OVERALL_CALIBRATION, isRounded = true) {
  const areas = {};
  for (const area of AREA_NAMES) areas[area] = stretch(rawArea(area, a, b), calibration[area]);
  const overall = {};
  for (const type of RELATIONSHIP_TYPES) {
    const weights = RELATIONSHIP_WEIGHTS[type];
    const average = AREA_NAMES.reduce((sum, area) => sum + weights[area] * areas[area], 0);
    const score = overallCalibration ? overallCurve(average, overallCalibration[type]) : average;
    overall[type] = isRounded ? Math.round(score) : score;
  }
  return { areas, overall };
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A random user: a random animal's profile plus noise, like a real quiz-taker of that animal. */
function randomUser(random, noise) {
  const ids = Object.keys(PROFILES);
  const id = ids[Math.floor(random() * ids.length)];
  const scores = PROFILES[id].scores.map(value => clamp(value + gaussian(random) * noise));
  return toTraits(scores);
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function stats(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  return {
    mean,
    sd,
    min: sorted[0],
    p5: percentile(sorted, 5),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

function histogram(values) {
  const buckets = [0, 30, 40, 50, 60, 70, 80, 90];
  const labels = ['<30', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90+'];
  const counts = buckets.map(() => 0);
  for (const value of values) {
    let i = buckets.length - 1;
    while (value < buckets[i]) i -= 1;
    counts[i] += 1;
  }
  return labels.map((label, i) => `${label}: ${((counts[i] / values.length) * 100).toFixed(0)}%`).join(' | ');
}

function parseArgs(argv) {
  const flags = Object.fromEntries(
    argv.filter(a => a.startsWith('--')).map(a => {
      const [key, value] = a.slice(2).split('=');
      return [key, value ?? true];
    })
  );
  const positional = argv.filter(a => !a.startsWith('--'));
  return {
    pairs: Number(positional[0]) || 20000,
    seed: Number(positional[1]) || 42,
    noise: flags.noise !== undefined ? Number(flags.noise) : 12,
    current: typeof flags.current === 'string' ? flags.current : null,
    calibrate: Boolean(flags.calibrate),
    fixture: Boolean(flags.fixture),
  };
}

function simulatePairs({ pairs, seed, noise }) {
  const random = mulberry32(seed);
  const results = [];
  for (let i = 0; i < pairs; i += 1) results.push([randomUser(random, noise), randomUser(random, noise)]);
  return results;
}

/** Suggests area center/stretch (p5-p95 spans AREA_SPAN) and overall center/slope (p5/p95 -> OVERALL_P5/OVERALL_P95). */
function printCalibration(pairList) {
  console.log('Suggested CALIBRATION (area raw scores):');
  for (const area of AREA_NAMES) {
    const raw = stats(pairList.map(([a, b]) => rawArea(area, a, b)));
    const factor = AREA_SPAN / (raw.p95 - raw.p5);
    console.log(`  ${area}: { center: ${raw.p50.toFixed(0)}, stretch: ${factor.toFixed(2)}, target: AREA_TARGET }   raw p5 ${raw.p5.toFixed(1)}, p50 ${raw.p50.toFixed(1)}, p95 ${raw.p95.toFixed(1)}`);
  }

  console.log('Suggested OVERALL_CALIBRATION (with the current area calibration):');
  for (const type of RELATIONSHIP_TYPES) {
    const values = stats(pairList.map(([a, b]) => compatibility(a, b, CALIBRATION, null, false).overall[type]));
    const slope = (logit(OVERALL_P95 / 100) - logit(OVERALL_P5 / 100)) / (values.p95 - values.p5);
    console.log(`  ${type}: { center: ${values.p50.toFixed(1)}, slope: ${slope.toFixed(3)} }   p5 ${values.p5.toFixed(1)}, p50 ${values.p50.toFixed(1)}, p95 ${values.p95.toFixed(1)}`);
  }
}

function loadCurrentScores(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('--current must be a JSON array of animal_compatibility rows');
  const idByName = Object.fromEntries(Object.entries(PROFILES).map(([id, p]) => [p.name.toLowerCase(), Number(id)]));
  const toId = value => (typeof value === 'number' ? value : idByName[String(value).toLowerCase()] ?? Number(value));
  const sample = rows[0] ?? {};
  const keys = Object.keys(sample);
  const animalKeys = keys.filter(k => /(aura|animal).*(id|_a|_b|1|2)|^(animal|aura)_?(a|b|1|2)/i.test(k) && k !== 'id');
  const scoreKey = keys.find(k => /score|compat/i.test(k) && typeof sample[k] === 'number' && !animalKeys.includes(k));
  if (animalKeys.length < 2 || !scoreKey) {
    throw new Error(`Can't find the animal and score columns in ${file}. Columns: ${keys.join(', ')}`);
  }
  const [keyA, keyB] = animalKeys;
  const scores = {}; // `${type}|${minId}|${maxId}` -> score
  for (const row of rows) {
    const a = toId(row[keyA]);
    const b = toId(row[keyB]);
    const type = row.relationship_type ?? 'any';
    scores[`${type}|${Math.min(a, b)}|${Math.max(a, b)}`] = Number(row[scoreKey]);
  }
  console.log(`Loaded ${rows.length} rows from ${file} (animals: ${keyA}, ${keyB}; score: ${scoreKey}).`);
  return scores;
}

function currentScore(scores, type, a, b) {
  const key = `${Math.min(a, b)}|${Math.max(a, b)}`;
  return scores[`${type}|${key}`] ?? scores[`any|${key}`];
}

function correlation(xs, ys) {
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

function printAnimalTable(type, current) {
  const ids = Object.keys(PROFILES).map(Number);
  const short = id => PROFILES[id].name.slice(0, 4);
  console.log(`\n### 15x15 animal table: ${type} (v2, animal profiles without noise)${current ? ' — "v2 / now"' : ''}\n`);
  console.log(`| | ${ids.map(short).join(' | ')} |`);
  console.log(`|---|${ids.map(() => '---').join('|')}|`);
  for (const a of ids) {
    const cells = ids.map(b => {
      const v2 = compatibility(toTraits(PROFILES[a].scores), toTraits(PROFILES[b].scores)).overall[type];
      const now = current ? currentScore(current, type, a, b) : undefined;
      return now === undefined ? String(v2) : `${v2}/${Math.round(now)}`;
    });
    console.log(`| **${short(a)}** | ${cells.join(' | ')} |`);
  }
}

function printComparison(type, current) {
  const ids = Object.keys(PROFILES).map(Number);
  const pairs = [];
  for (const a of ids) {
    for (const b of ids) {
      if (b < a) continue;
      const now = currentScore(current, type, a, b);
      if (now === undefined) continue;
      const v2 = compatibility(toTraits(PROFILES[a].scores), toTraits(PROFILES[b].scores)).overall[type];
      pairs.push({ a, b, v2, now });
    }
  }
  if (pairs.length === 0) {
    console.log(`\n${type}: no current scores to compare.`);
    return;
  }
  const v2 = stats(pairs.map(p => p.v2));
  const now = stats(pairs.map(p => p.now));
  const r = correlation(pairs.map(p => p.v2), pairs.map(p => p.now));
  const mad = pairs.reduce((s, p) => s + Math.abs(p.v2 - p.now), 0) / pairs.length;
  console.log(`\n${type}: ${pairs.length} animal pairs`);
  console.log(`  now: mean ${now.mean.toFixed(0)}, sd ${now.sd.toFixed(1)}, range ${now.min}-${now.max}`);
  console.log(`  v2:  mean ${v2.mean.toFixed(0)}, sd ${v2.sd.toFixed(1)}, range ${v2.min}-${v2.max}`);
  console.log(`  correlation ${r.toFixed(2)}, mean |difference| ${mad.toFixed(1)}`);
  const movers = [...pairs].sort((x, y) => Math.abs(y.v2 - y.now) - Math.abs(x.v2 - x.now)).slice(0, 5);
  console.log(`  biggest changes: ${movers.map(p => `${PROFILES[p.a].name}+${PROFILES[p.b].name} ${Math.round(p.now)}→${p.v2}`).join(', ')}`);
}

const FIXTURE_JSON = 'lib/__tests__/fixtures/compatibilityV2-fixture.json';
const FIXTURE_SQL = 'supabase/migrations/20261122100100_compatibility_v2_check.sql';

function roundTraits(traits) {
  return Object.fromEntries(TRAITS.map(t => [t, Math.round(traits[t] * 10) / 10]));
}

function fixtureCases() {
  const byName = name => toTraits(Object.values(PROFILES).find(p => p.name === name).scores);
  const fill = value => toTraits(TRAITS.map(() => value));
  const cases = [
    ['Dolphin + Otter (profiles)', byName('Dolphin'), byName('Otter')],
    ['Parrot + Bear (profiles)', byName('Parrot'), byName('Bear')],
    ['Cat + Peacock (profiles)', byName('Cat'), byName('Peacock')],
    ['Elephant + Wolf (profiles)', byName('Elephant'), byName('Wolf')],
    ['Owl + Snake (profiles)', byName('Owl'), byName('Snake')],
    ['all 100 + all 100', fill(100), fill(100)],
    ['all 0 + all 100', fill(0), fill(100)],
    ['all 0 + all 0', fill(0), fill(0)],
    ['quiz-like steps', toTraits([33.3, 66.7, 100, 22.2, 77.8]), toTraits([44.4, 55.6, 11.1, 88.9, 0])],
  ];
  const random = mulberry32(2026);
  for (let i = 1; i <= 8; i += 1) cases.push([`random pair ${i}`, randomUser(random, 12), randomUser(random, 12)]);
  return cases.map(([name, a, b]) => {
    const ra = roundTraits(a);
    const rb = roundTraits(b);
    const { areas, overall } = compatibility(ra, rb, CALIBRATION, OVERALL_CALIBRATION, false);
    return {
      name,
      a: ra,
      b: rb,
      areas,
      areasRounded: Object.fromEntries(AREA_NAMES.map(area => [area, Math.round(areas[area])])),
      overall,
      overallRounded: Object.fromEntries(RELATIONSHIP_TYPES.map(type => [type, Math.round(overall[type])])),
    };
  });
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function writeFixture() {
  const path = require('path');
  const root = path.join(__dirname, '..');
  const cases = fixtureCases();
  const json = { generatedBy: 'node scripts/compatibility-v2-simulation.js --fixture', cases };
  fs.mkdirSync(path.join(root, path.dirname(FIXTURE_JSON)), { recursive: true });
  fs.writeFileSync(path.join(root, FIXTURE_JSON), JSON.stringify(json, null, 2) + '\n');

  const rows = cases.flatMap(c =>
    RELATIONSHIP_TYPES.map(type =>
      `    (${sqlString(c.name)}, ${sqlString(type)}, ${sqlString(JSON.stringify(c.a))}::jsonb, ${sqlString(JSON.stringify(c.b))}::jsonb, ` +
      `${c.areas.communication}, ${c.areas.energy}, ${c.areas.conflict}, ${c.areas.values}, ${c.overall[type]})`
    )
  );
  const sql = `-- Compatibility v2: checks compatibility_v2_scores() against the shared fixture.
-- GENERATED by \`node scripts/compatibility-v2-simulation.js --fixture\` (same cases as
-- ${FIXTURE_JSON}, which Jest checks against lib/compatibilityV2.ts). Don't edit by hand.
--
-- Read-only: raises an exception (and changes nothing) if any score differs by more than 0.0001
-- or rounds differently. Valid for the default compatibility_v2_settings values.
--
-- Run in the Supabase SQL editor, after 20261122100000_compatibility_v2.sql and before
-- 20261122100200_compatibility_v2_rollout.sql.

do $$
declare
  c record;
  s record;
  failures text[] := array[]::text[];
  checked integer := 0;
begin
  for c in
    select * from (values
${rows.join(',\n')}
    ) as t (name, relationship_type, a, b, communication, energy, conflict, values_area, overall)
  loop
    select * into s from public.compatibility_v2_scores(c.a, c.b, c.relationship_type);
    checked := checked + 1;
    if not found then
      failures := failures || format('%s / %s: no score returned', c.name, c.relationship_type);
      continue;
    end if;
    if s.out_overall is null
      or abs(s.out_communication - c.communication) > 0.0001
      or abs(s.out_energy - c.energy) > 0.0001
      or abs(s.out_conflict - c.conflict) > 0.0001
      or abs(s.out_values - c.values_area) > 0.0001
      or abs(s.out_overall - c.overall) > 0.0001
      or round(s.out_overall::numeric) <> round(c.overall::numeric)
    then
      failures := failures || format('%s / %s: got overall %s (communication %s, energy %s, conflict %s, values %s), expected %s',
        c.name, c.relationship_type, s.out_overall, s.out_communication, s.out_energy, s.out_conflict, s.out_values, c.overall);
    end if;
  end loop;

  if array_length(failures, 1) > 0 then
    raise exception 'compatibility_v2_scores() does not match the fixture (% of % cases): %',
      array_length(failures, 1), checked, array_to_string(failures, '; ');
  end if;
  raise notice 'compatibility_v2_scores() matches the fixture (% cases).', checked;
end;
$$;
`;
  fs.writeFileSync(path.join(root, FIXTURE_SQL), sql);
  console.log(`Wrote ${FIXTURE_JSON} and ${FIXTURE_SQL} (${cases.length} cases x ${RELATIONSHIP_TYPES.length} relationship types).`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fixture) {
    writeFixture();
    return;
  }
  const pairList = simulatePairs(args);
  console.log(`Pairs: ${args.pairs}, seed: ${args.seed}, noise sd: ${args.noise}\n`);

  if (args.calibrate) {
    printCalibration(pairList);
    return;
  }

  const results = pairList.map(([a, b]) => compatibility(a, b));
  console.log('| Score | mean | sd | p5 | p25 | median | p75 | p95 | min-max |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  const failures = [];
  for (const area of AREA_NAMES) {
    const s = stats(results.map(r => r.areas[area]));
    console.log(`| ${area} (area) | ${s.mean.toFixed(0)} | ${s.sd.toFixed(1)} | ${s.p5.toFixed(0)} | ${s.p25.toFixed(0)} | ${s.p50.toFixed(0)} | ${s.p75.toFixed(0)} | ${s.p95.toFixed(0)} | ${s.min.toFixed(0)}-${s.max.toFixed(0)} |`);
  }
  for (const type of RELATIONSHIP_TYPES) {
    const values = results.map(r => r.overall[type]);
    const s = stats(values);
    console.log(`| **${type}** | ${s.mean.toFixed(0)} | ${s.sd.toFixed(1)} | ${s.p5} | ${s.p25} | ${s.p50} | ${s.p75} | ${s.p95} | ${s.min}-${s.max} |`);
    if (s.p5 > GOAL.p5Max || s.p95 < GOAL.p95Min || s.sd < GOAL.sdMin) failures.push(type);
  }
  console.log('\nArea text levels (high >= ' + LEVELS.high + ', low < ' + LEVELS.low + '):');
  for (const area of AREA_NAMES) {
    const values = results.map(r => r.areas[area]);
    const share = test => ((values.filter(test).length / values.length) * 100).toFixed(0) + '%';
    console.log(`  ${area}: high ${share(v => v >= LEVELS.high)} | medium ${share(v => v >= LEVELS.low && v < LEVELS.high)} | low ${share(v => v < LEVELS.low)}`);
  }
  console.log('\nOverall score buckets:');
  for (const type of RELATIONSHIP_TYPES) console.log(`  ${type}: ${histogram(results.map(r => r.overall[type]))}`);

  const current = args.current ? loadCurrentScores(args.current) : null;
  for (const type of RELATIONSHIP_TYPES) printAnimalTable(type, current);
  if (current) for (const type of RELATIONSHIP_TYPES) printComparison(type, current);

  if (failures.length > 0) {
    console.error(`\nSpread goal missed (p5 <= ${GOAL.p5Max}, p95 >= ${GOAL.p95Min}, sd >= ${GOAL.sdMin}): ${failures.join(', ')}`);
    process.exit(1);
  }
}

main();
