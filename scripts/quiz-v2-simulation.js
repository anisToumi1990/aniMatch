#!/usr/bin/env node
/**
 * Quiz v2 (trait-based) simulation. Proposal only: nothing in the app uses this yet.
 * See docs/quiz-v2-proposal.md.
 *
 * Model:
 *   - 15 questions, 3 per trait, 4 answers each worth 0..3 points on that trait.
 *   - Trait score (0-100) = points / max points * 100.
 *   - Each animal has an ideal profile on the same 5 traits.
 *   - The user's animal = the profile with the smallest Euclidean distance.
 *   - Tie rule: if (2nd distance - 1st distance) < TIE_GAP, ask up to 3 tie-breaker
 *     questions on the traits where the two animals differ most, re-scoring after each.
 *
 * Usage:
 *   node scripts/quiz-v2-simulation.js              # 10,000 users, seed 42
 *   node scripts/quiz-v2-simulation.js 50000 7      # users, seed
 *
 * Simulated users pick every answer uniformly at random. Exits 1 if any animal
 * falls outside MIN_SHARE..MAX_SHARE.
 */

const TRAITS = ['social', 'curiosity', 'organization', 'kindness', 'calm'];

// Trait of each main question, in order (Q1..Q15). Answers A..D are worth 3, 2, 1, 0 points.
const QUESTION_TRAITS = [
  'social', 'social', 'social',
  'curiosity', 'curiosity', 'curiosity',
  'organization', 'organization', 'organization',
  'kindness', 'kindness', 'kindness',
  'calm', 'calm', 'calm',
];
const ANSWER_POINTS = [3, 2, 1, 0];
const MAX_POINTS = 3;

// One tie-breaker question per trait (TB-S, TB-C, TB-O, TB-K, TB-Ca), same 3/2/1/0 scale.
const MAX_TIE_BREAKERS = 3;
const TIE_GAP = 2; // distance units (trait points)

const MIN_SHARE = 3;
const MAX_SHARE = 12;

// Final tuned profiles: [social, curiosity, organization, kindness, calm].
const PROFILES = {
  Dolphin:  [78, 58, 42, 72, 48],
  Peacock:  [74, 50, 60, 30, 34],
  Lion:     [70, 36, 68, 44, 58],
  Fox:      [60, 74, 36, 34, 52],
  Parrot:   [76, 66, 30, 54, 32],
  Owl:      [28, 66, 64, 50, 68],
  Wolf:     [54, 30, 62, 70, 34],
  Bear:     [26, 32, 68, 56, 70],
  Unicorn:  [46, 76, 32, 66, 50],
  Elephant: [50, 40, 62, 76, 70],
  Snake:    [28, 62, 54, 30, 64],
  Cat:      [26, 70, 34, 38, 46],
  Eagle:    [42, 50, 78, 30, 46],
  Deer:     [28, 44, 40, 78, 38],
  Otter:    [66, 58, 30, 58, 72],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAnswerPoints(random) {
  return ANSWER_POINTS[Math.floor(random() * ANSWER_POINTS.length)];
}

/** points[trait] and counts[trait] -> 0-100 scores. */
function toScores(points, counts) {
  return TRAITS.map(trait => (points[trait] / (counts[trait] * MAX_POINTS)) * 100);
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** Animals sorted by distance to the scores, closest first. */
function rankAnimals(scores) {
  return Object.entries(PROFILES)
    .map(([name, profile]) => ({ name, distance: distance(scores, profile) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Trait indexes ordered by how much two animals differ on them, biggest first. */
function tieBreakerOrder(first, second) {
  const a = PROFILES[first];
  const b = PROFILES[second];
  return TRAITS.map((_, i) => i).sort((i, j) => Math.abs(a[j] - b[j]) - Math.abs(a[i] - b[i]));
}

function simulateUser(random) {
  const points = Object.fromEntries(TRAITS.map(t => [t, 0]));
  const counts = Object.fromEntries(TRAITS.map(t => [t, 0]));
  for (const trait of QUESTION_TRAITS) {
    points[trait] += randomAnswerPoints(random);
    counts[trait] += 1;
  }

  const initial = rankAnimals(toScores(points, counts));
  const isTie = initial[1].distance - initial[0].distance < TIE_GAP;
  if (!isTie) return { animal: initial[0].name, initialAnimal: initial[0].name, isTie, asked: 0, isResolved: true };

  // Tie-breakers target the traits that separate the two tied animals.
  const order = tieBreakerOrder(initial[0].name, initial[1].name);
  let ranking = initial;
  let asked = 0;
  while (asked < MAX_TIE_BREAKERS && ranking[1].distance - ranking[0].distance < TIE_GAP) {
    const trait = TRAITS[order[asked]];
    points[trait] += randomAnswerPoints(random);
    counts[trait] += 1;
    asked += 1;
    ranking = rankAnimals(toScores(points, counts));
  }
  const isResolved = ranking[1].distance - ranking[0].distance >= TIE_GAP;
  return { animal: ranking[0].name, initialAnimal: initial[0].name, isTie, asked, isResolved };
}

function main() {
  const users = Number(process.argv[2]) || 10000;
  const seed = Number(process.argv[3]) || 42;
  const random = mulberry32(seed);

  const finalCounts = Object.fromEntries(Object.keys(PROFILES).map(n => [n, 0]));
  const initialCounts = { ...finalCounts };
  let ties = 0;
  let unresolved = 0;
  let changed = 0;
  const askedHistogram = [0, 0, 0, 0];

  for (let i = 0; i < users; i += 1) {
    const result = simulateUser(random);
    finalCounts[result.animal] += 1;
    initialCounts[result.initialAnimal] += 1;
    if (result.isTie) {
      ties += 1;
      askedHistogram[result.asked] += 1;
      if (!result.isResolved) unresolved += 1;
      if (result.animal !== result.initialAnimal) changed += 1;
    }
  }

  const pct = n => (n / users) * 100;
  console.log(`Users: ${users}, seed: ${seed}, tie gap: ${TIE_GAP}\n`);
  console.log('| Animal | Before tie-breakers | Final |');
  console.log('|---|---|---|');
  const rows = Object.keys(PROFILES).sort((a, b) => finalCounts[b] - finalCounts[a]);
  for (const name of rows) {
    console.log(`| ${name} | ${pct(initialCounts[name]).toFixed(1)}% | ${pct(finalCounts[name]).toFixed(1)}% |`);
  }
  const shares = rows.map(n => pct(finalCounts[n]));
  console.log(`\nRange: ${Math.min(...shares).toFixed(1)}% - ${Math.max(...shares).toFixed(1)}%`);
  console.log(`Ties: ${pct(ties).toFixed(1)}% of users`);
  console.log(`  needed 1 / 2 / 3 tie-breakers: ${askedHistogram.slice(1).map(n => pct(n).toFixed(1) + '%').join(' / ')}`);
  console.log(`  still close after 3 (closest animal wins): ${pct(unresolved).toFixed(1)}%`);
  console.log(`  animal changed by tie-breakers: ${pct(changed).toFixed(1)}%`);

  const outOfRange = rows.filter(n => pct(finalCounts[n]) < MIN_SHARE || pct(finalCounts[n]) > MAX_SHARE);
  if (outOfRange.length > 0) {
    console.error(`\nOutside ${MIN_SHARE}-${MAX_SHARE}%: ${outOfRange.join(', ')}`);
    process.exit(1);
  }
}

main();
