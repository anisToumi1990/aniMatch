#!/usr/bin/env node
/**
 * Personal insights (phase 1, proposal): validates the content library, applies
 * the selection rules and writes the generated parts of
 * docs/personal-insights-proposal.md (between <!-- generated:<part> --> markers).
 * See that doc for the design.
 *
 *   node scripts/personal-insights-preview.js                    # validate, update the doc, and regenerate
 *                                                                # the fixture, the seed and the SQL check
 *   node scripts/personal-insights-preview.js --check            # validate only
 *   node scripts/personal-insights-preview.js --pairs <file>     # print insights for real pairs (stdout only)
 *
 * --pairs reads a JSON array produced by the SQL query in the doc (section 4):
 *   [{ "name": "Sam", "relationship_type": "lover", "me": {traits}, "them": {traits},
 *      "areas": { communication, energy, conflict, values } | null }]
 * Output goes to stdout only, so real people's data never lands in the repo by accident.
 *
 * Content: supabase/content/personal-insights/library.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIBRARY_FILE = path.join(ROOT, 'supabase', 'content', 'personal-insights', 'library.json');
const DOC_FILE = path.join(ROOT, 'docs', 'personal-insights-proposal.md');
const FIXTURE_FILE = path.join(ROOT, 'lib', '__tests__', 'fixtures', 'compatibilityV2-fixture.json');

const TRAITS = ['social', 'curiosity', 'organization', 'kindness', 'chill'];
const TRAIT_LABELS = { social: 'Social', curiosity: 'Curiosity', organization: 'Organization', kindness: 'Kindness', chill: 'Chill' };
const LEVELS = ['high', 'medium', 'low'];
const TYPES = ['lover', 'business_partner', 'family'];
const TYPE_LABELS = { lover: 'Lover', business_partner: 'Business partner', family: 'Family' };
const SECTIONS = ['who', 'strength', 'challenge', 'tip'];
const AREAS = ['communication', 'energy', 'conflict', 'values'];

/** Selection thresholds (see the doc, section 3). */
const RULES = {
  distinctive: 10, // |score - 50| for a trait to count as "standing out"
  secondChallenge: 25, // challenge score needed for a 2nd challenge
  bigGap: 20, // trait gap (points) for a "difference" sentence
  weakArea: 55, // below this, "Your pair" uses the weakest area's advice
  strongArea: 70, // else, at or above this, the strongest area's text (otherwise no 2nd sentence)
};

/** Max length per text, measured with a long first name in place of {name}. */
const MAX = { who: 95, strength: 135, challenge: 150, tip: 180, difference: 130, similar: 110, area: 115, balanced: 95 };
const SAMPLE_NAME = 'Alexandra';

const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|he's|she's|boyfriend|girlfriend|husband|wife)\b/i;
const ZODIAC = /\b(zodiac\w*|horoscopes?|astrolog\w*|signs?|stars?|planets?|retrograde|mercury|destiny|fate|cosmic)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(lib) {
  const errors = [];
  const seen = new Map();
  function check(where, text, kind, { placeholders = ['{name}'] } = {}) {
    if (typeof text !== 'string' || !text.trim()) {
      errors.push(`${where}: missing`);
      return;
    }
    const measured = text.replace(/\{name\}/g, SAMPLE_NAME);
    if (measured.length > MAX[kind]) errors.push(`${where}: ${measured.length} chars (max ${MAX[kind]}): ${text}`);
    const gendered = text.match(GENDERED);
    if (gendered) errors.push(`${where}: uses "${gendered[0]}" (keep it gender-neutral): ${text}`);
    const zodiac = text.match(ZODIAC);
    if (zodiac) errors.push(`${where}: zodiac-like word "${zodiac[0]}": ${text}`);
    if (EMOJI.test(text)) errors.push(`${where}: contains an emoji`);
    const unknown = (text.match(/\{[^}]*\}/g) ?? []).filter(token => !placeholders.includes(token));
    if (unknown.length) errors.push(`${where}: unknown placeholder ${unknown.join(', ')}`);
    if (kind !== 'who' && kind !== 'balanced' && !/[.!?]["”]?$/.test(text)) errors.push(`${where}: should end with a full stop`);
    if ((kind === 'who' || kind === 'balanced') && /[.!?]$/.test(text)) errors.push(`${where}: "who" texts are fragments, no final full stop`);
    const key = text.toLowerCase();
    if (seen.has(key)) errors.push(`${where}: same text as ${seen.get(key)}`);
    else seen.set(key, where);
  }

  for (const trait of TRAITS) {
    for (const level of LEVELS) {
      for (const type of TYPES) {
        for (const section of SECTIONS) {
          const where = `traits.${trait}.${level}.${type}.${section}`;
          const text = lib.traits?.[trait]?.[level]?.[type]?.[section];
          check(where, text, section, { placeholders: section === 'who' ? [] : ['{name}'] });
          if (section !== 'who' && typeof text === 'string' && !text.includes('{name}')) {
            errors.push(`${where}: should mention {name}`);
          }
        }
      }
    }
    for (const direction of ['they_higher', 'you_higher']) {
      for (const type of TYPES) check(`difference.${trait}.${direction}.${type}`, lib.difference?.[trait]?.[direction]?.[type], 'difference');
    }
    check(`similar.${trait}`, lib.similar?.[trait], 'similar');
  }
  for (const type of TYPES) check(`balanced.${type}`, lib.balanced?.[type], 'balanced', { placeholders: [] });
  for (const area of AREAS) {
    for (const strength of ['strong', 'weak']) {
      for (const type of TYPES) check(`areas.${area}.${strength}.${type}`, lib.areas?.[area]?.[strength]?.[type], 'area', { placeholders: [] });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Selection (keep in sync with section 3 of the doc)
// ---------------------------------------------------------------------------

// Scores are compared in tenths of a point (integers), like lib/personalInsights.ts and
// the SQL function, so floats can't flip a threshold or a tie (trait scores have 1 decimal).
const tenths = value => Math.round(value * 10);

function levelOf(score, lib) {
  if (tenths(score) >= tenths(lib.levels.high)) return 'high';
  if (tenths(score) < tenths(lib.levels.low)) return 'low';
  return 'medium';
}

/** Sorted by value, ties in declaration order. */
function rank(keys, valueOf, direction) {
  return keys
    .map((key, index) => ({ key, index, value: valueOf(key) }))
    .sort((x, y) => (direction === 'desc' ? y.value - x.value : x.value - y.value) || x.index - y.index);
}

/** Replaces {name} literally (no `$&`-style patterns from the name). */
function fillName(text, name) {
  return text.split('{name}').join(name);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds the finished texts for one match, from the viewer's point of view.
 * Returns the texts plus `picks` (which library entries were used) for the doc.
 * Same rules as buildPersonalInsights() in lib/personalInsights.ts and
 * personal_insights_build() in SQL; the fixture checks all three.
 */
function buildInsights(lib, { name, type, me, them, areas }) {
  const label = capitalize(fillName(lib.labels[type], name));
  const level = trait => levelOf(them[trait], lib);
  const entry = trait => lib.traits[trait][level(trait)][type];
  // Every finished sentence starts with a capital, even with a lowercase name (email fallback).
  const text = (trait, section) => capitalize(fillName(entry(trait)[section], name));
  const standOut = trait => Math.abs(tenths(them[trait]) - 500);
  const gap = trait => tenths(them[trait]) - tenths(me[trait]);
  const ordered = rank(TRAITS, standOut, 'desc');
  const standsOut = item => !!item && item.value >= RULES.distinctive * 10;
  const picks = {};

  // 1. Who they are: the 1-2 traits that stand out most.
  let who;
  if (!standsOut(ordered[0])) {
    who = `${label} ${lib.balanced[type]}.`;
    picks.who = ['balanced'];
  } else {
    who = `${label} ${entry(ordered[0].key).who}.`;
    picks.who = [`${ordered[0].key} ${level(ordered[0].key)}`];
    if (standsOut(ordered[1])) {
      who += ` ${capitalize(`${name} ${entry(ordered[1].key).who}`)}.`;
      picks.who.push(`${ordered[1].key} ${level(ordered[1].key)}`);
    }
  }

  // 2. Strengths: the top 2 traits, plus a 3rd if it stands out too.
  const strengthTraits = ordered.slice(0, 3).filter((item, index) => index < 2 || standsOut(item)).map(item => item.key);
  const strengths = strengthTraits.map(trait => text(trait, 'strength'));
  picks.strengths = strengthTraits.map(trait => `${trait} ${level(trait)}`);

  // 3. Challenges: stand-out + 0.5 x |gap| (doubled to stay in integers).
  const challengeOrder = rank(TRAITS, trait => 2 * standOut(trait) + Math.abs(gap(trait)), 'desc');
  const challengeTraits = [challengeOrder[0].key];
  if (challengeOrder[1].value >= 2 * RULES.secondChallenge * 10) challengeTraits.push(challengeOrder[1].key);
  const challenges = challengeTraits.map(trait => text(trait, 'challenge'));
  picks.challenges = challengeTraits.map(trait => `${trait} ${level(trait)}`);

  // 4. Tips: 3 different traits. Their top trait (what makes them give their best),
  // your biggest gap (how to deal with the difference), their first unused challenge.
  const byGap = rank(TRAITS, trait => Math.abs(gap(trait)), 'desc');
  const tipTraits = [];
  const addTip = trait => {
    if (trait && !tipTraits.includes(trait) && tipTraits.length < 3) tipTraits.push(trait);
  };
  addTip(ordered[0].key);
  addTip(byGap.find(item => !tipTraits.includes(item.key))?.key);
  addTip(challengeTraits.find(trait => !tipTraits.includes(trait)));
  for (const item of ordered) addTip(item.key);
  const tips = tipTraits.map(trait => text(trait, 'tip'));
  picks.tips = tipTraits.map(trait => `${trait} ${level(trait)}`);

  // 5. Your pair: the biggest trait difference, then the area scores.
  const biggest = byGap[0];
  let pair;
  if (biggest.value >= RULES.bigGap * 10) {
    const direction = gap(biggest.key) > 0 ? 'they_higher' : 'you_higher';
    pair = capitalize(fillName(lib.difference[biggest.key][direction][type], name));
    picks.pair = [`difference ${biggest.key} ${direction} (${biggest.value / 10} pts)`];
  } else {
    const closest = byGap[byGap.length - 1];
    pair = capitalize(fillName(lib.similar[closest.key], name));
    picks.pair = [`similar ${closest.key}`];
  }
  if (areas) {
    const weakest = rank(AREAS, area => tenths(areas[area]), 'asc')[0];
    const strongest = rank(AREAS, area => tenths(areas[area]), 'desc')[0];
    if (weakest.value < RULES.weakArea * 10) {
      pair += ` ${lib.areas[weakest.key].weak[type]}`;
      picks.pair.push(`${weakest.key} weak (${areas[weakest.key]})`);
    } else if (strongest.value >= RULES.strongArea * 10) {
      pair += ` ${lib.areas[strongest.key].strong[type]}`;
      picks.pair.push(`${strongest.key} strong (${areas[strongest.key]})`);
    } else {
      picks.pair.push('no area sentence (all areas 55-69)');
    }
  }

  return { version: lib.version, who, strengths, challenges, tips, pair, picks };
}

// ---------------------------------------------------------------------------
// Area scores for the profile-only examples (same formula as lib/compatibilityV2.ts,
// checked against its fixture below so the copy can't drift silently).
// ---------------------------------------------------------------------------

const AREA_TERMS = {
  communication: [['sim', 'social', 0.35], ['sim', 'curiosity', 0.25], ['both', 'kindness', 0.4]],
  energy: [['sim', 'social', 0.45], ['sim', 'curiosity', 0.35], ['sim', 'chill', 0.2]],
  conflict: [['both', 'chill', 0.4], ['both', 'kindness', 0.35], ['sim', 'organization', 0.25]],
  values: [['both', 'organization', 0.35], ['sim', 'organization', 0.2], ['sim', 'curiosity', 0.25], ['sim', 'kindness', 0.2]],
};
const AREA_CALIBRATION = {
  communication: { center: 65, stretch: 1.88 },
  energy: { center: 78, stretch: 1.77 },
  conflict: { center: 54, stretch: 2.08 },
  values: { center: 66, stretch: 2.08 },
};

function areaScores(a, b) {
  const result = {};
  for (const area of AREAS) {
    let raw = 0;
    for (const [kind, trait, weight] of AREA_TERMS[area]) {
      const x = a[trait];
      const y = b[trait];
      raw += weight * (kind === 'sim' ? 100 - Math.abs(x - y) : 0.5 * ((x + y) / 2) + 0.5 * Math.min(x, y));
    }
    const { center, stretch } = AREA_CALIBRATION[area];
    result[area] = Math.round(Math.min(100, Math.max(0, 62 + (raw - center) * stretch)));
  }
  return result;
}

function checkAreaFormula() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
  for (const testCase of fixture.cases) {
    const got = areaScores(testCase.a, testCase.b);
    for (const area of AREAS) {
      if (got[area] !== testCase.areasRounded[area]) {
        throw new Error(`Area formula out of sync with lib/compatibilityV2.ts (${testCase.name}, ${area}: ${got[area]} vs ${testCase.areasRounded[area]})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Doc output
// ---------------------------------------------------------------------------

// Animal profiles (animal_trait_profiles seed, 20261121100100_quiz_v2_seed.sql).
const PROFILES = {
  dolphin: [78, 58, 42, 72, 48], peacock: [74, 50, 60, 30, 34], lion: [70, 36, 68, 44, 58],
  fox: [60, 74, 36, 34, 52], parrot: [76, 66, 30, 54, 32], owl: [28, 66, 64, 50, 68],
  wolf: [54, 30, 62, 70, 34], bear: [26, 32, 68, 56, 70], unicorn: [46, 76, 32, 66, 50],
  elephant: [50, 40, 62, 76, 70], snake: [28, 62, 54, 30, 64], cat: [26, 70, 34, 38, 46],
  eagle: [42, 50, 78, 30, 46], deer: [28, 44, 40, 78, 38], otter: [66, 58, 30, 58, 72],
};
const profile = animal => Object.fromEntries(TRAITS.map((trait, index) => [trait, PROFILES[animal][index]]));

/** Illustrative pairs built from animal profiles only (no real users). */
const PROFILE_EXAMPLES = [
  { title: 'Lover: you are an Owl, Sam is a Dolphin', name: 'Sam', type: 'lover', meAnimal: 'owl', themAnimal: 'dolphin' },
  { title: 'Business partner: you are an Eagle, Alex is an Otter', name: 'Alex', type: 'business_partner', meAnimal: 'eagle', themAnimal: 'otter' },
  { title: 'Family: you are a Deer, Noor is a Lion', name: 'Noor', type: 'family', meAnimal: 'deer', themAnimal: 'lion' },
];

function traitLine(traits) {
  return TRAITS.map(trait => `${TRAIT_LABELS[trait]} ${Math.round(traits[trait])}`).join(' · ');
}

function renderInsights(result) {
  let out = `**Who they are.** ${result.who}\n\n`;
  out += `**Strengths**\n${result.strengths.map(text => `- ${text}`).join('\n')}\n\n`;
  out += `**Challenges**\n${result.challenges.map(text => `- ${text}`).join('\n')}\n\n`;
  out += `**Tips**\n${result.tips.map((text, index) => `${index + 1}. ${text}`).join('\n')}\n\n`;
  out += `**Your pair.** ${result.pair}\n`;
  return out;
}

function renderPicks(picks) {
  return `<sub>Picked: who = ${picks.who.join(', ')}; strengths = ${picks.strengths.join(', ')}; challenges = ${picks.challenges.join(', ')}; tips = ${picks.tips.join(', ')}; pair = ${picks.pair.join(', ')}.</sub>\n`;
}

function renderExample(lib, pair) {
  const result = buildInsights(lib, pair);
  let out = `#### ${pair.title}\n\n`;
  out += `Input: them (${pair.themLabel}) ${traitLine(pair.them)}; you (${pair.meLabel}) ${traitLine(pair.me)}; `;
  out += pair.areas ? `areas ${AREAS.map(area => `${area} ${pair.areas[area]}`).join(', ')}.\n\n` : 'no stored areas (v1 result).\n\n';
  out += renderInsights(result);
  out += `\n${renderPicks(result.picks)}`;
  return out;
}

const cell = text => text.replace(/\|/g, '\\|');

function renderLibrary(lib) {
  let out = '';
  for (const trait of TRAITS) {
    out += `\n#### ${TRAIT_LABELS[trait]}\n`;
    for (const level of LEVELS) {
      out += `\n**${TRAIT_LABELS[trait]}: ${level}** (${level === 'high' ? `≥ ${lib.levels.high}` : level === 'low' ? `< ${lib.levels.low}` : `${lib.levels.low}-${lib.levels.high - 1}`})\n\n`;
      out += `| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |\n|---|---|---|---|---|\n`;
      for (const type of TYPES) {
        const entry = lib.traits[trait][level][type];
        out += `| ${TYPE_LABELS[type]} | ${SECTIONS.map(section => cell(entry[section])).join(' | ')} |\n`;
      }
    }
  }
  out += `\n#### Balanced (no trait stands out)\n\n| Type | Who they are ("{Label} …") |\n|---|---|\n`;
  for (const type of TYPES) out += `| ${TYPE_LABELS[type]} | ${cell(lib.balanced[type])} |\n`;

  out += `\n#### Differences ("Your pair", sentence 1)\n\nUsed when the biggest gap is ≥ ${RULES.bigGap} points. "They" = the match, "you" = the viewer.\n\n`;
  out += `| Trait | Direction | Lover | Business partner | Family |\n|---|---|---|---|---|\n`;
  for (const trait of TRAITS) {
    for (const direction of ['they_higher', 'you_higher']) {
      out += `| ${TRAIT_LABELS[trait]} | ${direction === 'they_higher' ? 'They score higher' : 'You score higher'} | ${TYPES.map(type => cell(lib.difference[trait][direction][type])).join(' | ')} |\n`;
    }
  }
  out += `\n#### Similar (no gap ≥ ${RULES.bigGap} points; the closest trait)\n\n| Trait | Text (all types) |\n|---|---|\n`;
  for (const trait of TRAITS) out += `| ${TRAIT_LABELS[trait]} | ${cell(lib.similar[trait])} |\n`;

  out += `\n#### Areas ("Your pair", sentence 2)\n\n| Area | Case | Lover | Business partner | Family |\n|---|---|---|---|---|\n`;
  for (const area of AREAS) {
    for (const strength of ['strong', 'weak']) {
      out += `| ${area} | ${strength === 'weak' ? `weakest, < ${RULES.weakArea}` : `strongest, ≥ ${RULES.strongArea} (none < ${RULES.weakArea})`} | ${TYPES.map(type => cell(lib.areas[area][strength][type])).join(' | ')} |\n`;
    }
  }
  return out;
}

/** Variety check: simulated users (animal profile + noise), how the texts get spread. */
function renderVariety(lib) {
  let seed = 7;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const animals = Object.keys(PROFILES);
  const person = () => {
    const base = profile(animals[Math.floor(random() * animals.length)]);
    return Object.fromEntries(TRAITS.map(trait => [trait, Math.min(100, Math.max(0, Math.round(base[trait] + gaussian() * 12)))]));
  };
  const runs = 5000;
  const screens = new Set();
  const textUse = new Map();
  let balanced = 0;
  let similar = 0;
  let twoChallenges = 0;
  let threeStrengths = 0;
  for (let i = 0; i < runs; i += 1) {
    const me = person();
    const them = person();
    const type = TYPES[i % 3];
    const result = buildInsights(lib, { name: 'Sam', type, me, them, areas: areaScores(me, them) });
    const all = [result.who, ...result.strengths, ...result.challenges, ...result.tips, result.pair];
    if (new Set(all).size !== all.length) throw new Error('A screen repeated a text');
    screens.add(all.join('|'));
    for (const key of [...result.picks.strengths.map(p => `strength ${p}`), ...result.picks.challenges.map(p => `challenge ${p}`), ...result.picks.tips.map(p => `tip ${p}`)]) {
      textUse.set(`${type} ${key}`, (textUse.get(`${type} ${key}`) ?? 0) + 1);
    }
    if (result.picks.who[0] === 'balanced') balanced += 1;
    if (result.picks.pair[0].startsWith('similar')) similar += 1;
    if (result.challenges.length === 2) twoChallenges += 1;
    if (result.strengths.length === 3) threeStrengths += 1;
  }
  const possible = TYPES.length * TRAITS.length * LEVELS.length * 3; // strength / challenge / tip per type
  const pct = value => `${Math.round((value / runs) * 100)}%`;
  return (
    `${runs} simulated pairs (random animal profile + noise, sd 12 per trait, types in rotation):\n\n` +
    `- ${screens.size} different screens out of ${runs}; no screen repeats a text (checked).\n` +
    `- ${textUse.size} of ${possible} strength / challenge / tip texts get used at least once.\n` +
    `- 3 strengths: ${pct(threeStrengths)} of screens; 2 challenges: ${pct(twoChallenges)}.\n` +
    `- "Balanced" who-text: ${pct(balanced)}; "similar" pair sentence: ${pct(similar)}.\n`
  );
}

function replaceGenerated(doc, part, content) {
  const start = `<!-- generated:${part} -->`;
  const end = `<!-- /generated:${part} -->`;
  const from = doc.indexOf(start);
  const to = doc.indexOf(end);
  if (from === -1 || to === -1) throw new Error(`Markers for "${part}" not found in ${path.relative(ROOT, DOC_FILE)}`);
  return `${doc.slice(0, from + start.length)}\n${content.trim()}\n${doc.slice(to)}`;
}

// ---------------------------------------------------------------------------
// Generated files: fixture (Jest + SQL), content seed, SQL check
// ---------------------------------------------------------------------------

const FIXTURE_OUT = path.join(ROOT, 'lib', '__tests__', 'fixtures', 'personalInsights-fixture.json');
const SEED_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20261122120100_personal_insights_seed.sql');
const CHECK_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20261122120200_personal_insights_check.sql');

function traits(social, curiosity, organization, kindness, chill) {
  return { social, curiosity, organization, kindness, chill };
}

/** Deterministic cases: profiles, noisy users (1 decimal), and every threshold and tie. */
function fixtureCases() {
  const cases = [];
  const animals = Object.keys(PROFILES);
  const add = (name, input) => cases.push({ name, ...input });

  // Each animal as "them", against a different animal, in all 3 relationship types.
  animals.forEach((animal, index) => {
    const meAnimal = animals[(index + 5) % animals.length];
    const me = profile(meAnimal);
    const them = profile(animal);
    for (const type of TYPES) {
      add(`${capitalize(animal)} seen by ${capitalize(meAnimal)} (${type})`, { type, person: 'Sam', me, them, areas: areaScores(me, them) });
    }
  });

  // Noisy users with 1-decimal scores, like real v2 results.
  let seed = 2026;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noisy = () => {
    const base = profile(animals[Math.floor(random() * animals.length)]);
    return Object.fromEntries(TRAITS.map(trait => [trait, Math.round(Math.min(100, Math.max(0, base[trait] + (random() - 0.5) * 50)) * 10) / 10]));
  };
  for (let i = 0; i < 30; i += 1) {
    const me = noisy();
    const them = noisy();
    add(`noisy pair ${i + 1}`, { type: TYPES[i % 3], person: 'Alex', me, them, areas: i % 5 === 4 ? null : areaScores(me, them) });
  }

  // Edge cases: thresholds are inclusive/exclusive exactly as documented.
  const mid = traits(50, 50, 50, 50, 50);
  add('everyone at 50: balanced, similar, no area sentence', { type: 'lover', person: 'Sam', me: mid, them: mid, areas: { communication: 60, energy: 60, conflict: 60, values: 60 } });
  add('levels at the limits (60 high, 59.9 medium, 40 medium, 39.9 low)', { type: 'business_partner', person: 'Alex', me: mid, them: traits(60, 59.9, 40, 39.9, 50), areas: null });
  add('stand-out exactly 10 vs 9.9', { type: 'family', person: 'Noor', me: mid, them: traits(60, 40.1, 50, 50, 50), areas: null });
  add('gap exactly 20 (difference text)', { type: 'lover', person: 'Sam', me: traits(50, 50, 50, 50, 50), them: traits(70, 55, 50, 50, 50), areas: null });
  add('gap 19.9 (similar text)', { type: 'lover', person: 'Sam', me: traits(50.1, 50, 50, 50, 50), them: traits(70, 55, 50, 50, 50), areas: null });
  add('2nd challenge score exactly 25', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 50, 50, 60), them: traits(90, 50, 50, 50, 70), areas: null });
  add('2nd challenge score 24.9', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 50, 50, 60.2), them: traits(90, 50, 50, 50, 70), areas: null });
  add('weakest area exactly 55 and strongest 70', { type: 'family', person: 'Noor', me: profile('owl'), them: profile('lion'), areas: { communication: 70, energy: 55, conflict: 60, values: 65 } });
  add('weakest area 54', { type: 'family', person: 'Noor', me: profile('owl'), them: profile('lion'), areas: { communication: 70, energy: 54, conflict: 60, values: 65 } });
  add('area ties (first in area order wins)', { type: 'lover', person: 'Sam', me: profile('bear'), them: profile('parrot'), areas: { communication: 40, energy: 40, conflict: 40, values: 40 } });
  add('trait ties (first in trait order wins)', { type: 'family', person: 'Noor', me: mid, them: traits(80, 20, 80, 20, 50), areas: null });
  add('they score lower on the biggest gap', { type: 'business_partner', person: 'Alex', me: traits(90, 50, 50, 50, 50), them: traits(20, 50, 50, 50, 50), areas: null });
  add('extremes 0 and 100', { type: 'lover', person: 'Sam', me: traits(0, 0, 0, 0, 0), them: traits(100, 100, 100, 100, 100), areas: { communication: 0, energy: 0, conflict: 100, values: 100 } });
  add("name with an apostrophe", { type: 'family', person: "D'Arcy", me: profile('deer'), them: profile('lion'), areas: null });
  add('name with $& (inserted literally)', { type: 'lover', person: 'Jo$&n', me: profile('deer'), them: profile('lion'), areas: null });
  add('lowercase name (sentences still start with a capital)', { type: 'family', person: 'sam', me: profile('owl'), them: profile('otter'), areas: null });

  const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  return cases.map(testCase => {
    const { picks, ...expected } = buildInsights(lib, { name: testCase.person, type: testCase.type, me: testCase.me, them: testCase.them, areas: testCase.areas });
    return { name: testCase.name, relationshipType: testCase.type, person: testCase.person, me: testCase.me, them: testCase.them, areas: testCase.areas, expected };
  });
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return value === null ? 'null::jsonb' : `${sqlString(JSON.stringify(value))}::jsonb`;
}

function writeFixture(cases) {
  const fixture = {
    generatedBy: 'node scripts/personal-insights-preview.js (do not edit by hand)',
    library: 'supabase/content/personal-insights/library.json',
    cases,
  };
  fs.writeFileSync(FIXTURE_OUT, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, FIXTURE_OUT)} (${cases.length} cases)`);
}

/** Content rows for both tables, from the library. */
function contentRows(lib) {
  const traitRows = [];
  for (const trait of TRAITS) {
    for (const level of LEVELS) {
      for (const type of TYPES) {
        for (const section of SECTIONS) traitRows.push([trait, level, type, section, lib.traits[trait][level][type][section]]);
      }
    }
  }
  // (kind, key, variant, relationship_type, text); '' = not applicable.
  const pairRows = [];
  for (const type of TYPES) pairRows.push(['label', '', '', type, lib.labels[type]]);
  for (const type of TYPES) pairRows.push(['balanced', '', '', type, lib.balanced[type]]);
  for (const trait of TRAITS) {
    for (const direction of ['they_higher', 'you_higher']) {
      for (const type of TYPES) pairRows.push(['difference', trait, direction, type, lib.difference[trait][direction][type]]);
    }
    pairRows.push(['similar', trait, '', '', lib.similar[trait]]);
  }
  for (const area of AREAS) {
    for (const strength of ['strong', 'weak']) {
      for (const type of TYPES) pairRows.push(['area', area, strength, type, lib.areas[area][strength][type]]);
    }
  }
  return { traitRows, pairRows };
}

function writeSeed(lib) {
  const { traitRows, pairRows } = contentRows(lib);
  const values = rows => rows.map(row => `  (${row.map(sqlString).join(', ')})`).join(',\n');
  const sql = `-- Personal insights content (library version ${lib.version}): ${traitRows.length} trait texts + ${pairRows.length} pair texts.
-- GENERATED by node scripts/personal-insights-preview.js from supabase/content/personal-insights/library.json.
-- Edit the JSON and re-run the script; don't edit this file by hand.
--
-- Replaces the whole library in one transaction (only personal_insights_build() reads it).
-- Run in the Supabase SQL editor after 20261122120000_personal_insights.sql.

begin;

delete from public.personal_insight_trait_texts;
insert into public.personal_insight_trait_texts (trait, level, relationship_type, section, text) values
${values(traitRows)};

delete from public.personal_insight_pair_texts;
insert into public.personal_insight_pair_texts (kind, key, variant, relationship_type, text) values
${values(pairRows)};

do $$
begin
  if (select count(*) from public.personal_insight_trait_texts) <> ${traitRows.length}
    or (select count(*) from public.personal_insight_pair_texts) <> ${pairRows.length} then
    raise exception 'personal insights seed: unexpected row counts';
  end if;
end $$;

commit;
`;
  fs.writeFileSync(SEED_MIGRATION, sql);
  console.log(`Wrote ${path.relative(ROOT, SEED_MIGRATION)}`);
}

function writeCheck(cases) {
  const rows = cases
    .map(c => `    (${[sqlString(c.name), sqlString(c.relationshipType), sqlString(c.person), sqlJson(c.me), sqlJson(c.them), sqlJson(c.areas), sqlJson(c.expected)].join(', ')})`)
    .join(',\n');
  const sql = `-- Personal insights: checks personal_insights_build() against the shared fixture.
-- GENERATED by node scripts/personal-insights-preview.js (same cases as
-- lib/__tests__/fixtures/personalInsights-fixture.json, which Jest checks against
-- lib/personalInsights.ts). Don't edit by hand.
--
-- Read-only: raises an exception (and changes nothing) if any case returns different texts.
-- Run in the Supabase SQL editor after 20261122120100_personal_insights_seed.sql.

do $$
declare
  c record;
  v_got jsonb;
  failures text[] := array[]::text[];
  checked integer := 0;
begin
  for c in
    select * from (values
${rows}
    ) as t (name, relationship_type, person, me, them, areas, expected)
  loop
    v_got := public.personal_insights_build(c.me, c.them, c.relationship_type, c.person, c.areas);
    checked := checked + 1;
    if v_got is distinct from c.expected then
      failures := failures || format(E'%s\\n  got:      %s\\n  expected: %s', c.name, v_got, c.expected);
    end if;
  end loop;

  if cardinality(failures) > 0 then
    raise exception E'personal insights check: % of % cases differ:\\n%', cardinality(failures), checked, array_to_string(failures[1:5], E'\\n');
  end if;
  raise notice 'personal insights check: all % cases match', checked;
end $$;
`;
  fs.writeFileSync(CHECK_MIGRATION, sql);
  console.log(`Wrote ${path.relative(ROOT, CHECK_MIGRATION)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const errors = validate(lib);
  if (errors.length) {
    console.error(`Found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  checkAreaFormula();
  console.log('OK: library is complete and valid.');
  if (args.includes('--check')) return;

  const pairsIndex = args.indexOf('--pairs');
  if (pairsIndex !== -1) {
    const pairs = JSON.parse(fs.readFileSync(args[pairsIndex + 1], 'utf8'));
    pairs.forEach((pair, index) => {
      // v1 rows have no stored areas: the area sentence is skipped, like in the app.
      const areas = pair.areas && AREAS.every(area => Number.isFinite(pair.areas[area])) ? pair.areas : null;
      console.log(
        renderExample(lib, {
          ...pair,
          type: pair.relationship_type,
          areas,
          title: `Pair ${index + 1}: ${TYPE_LABELS[pair.relationship_type]}, ${pair.name}`,
          themLabel: pair.name,
          meLabel: 'you',
        })
      );
    });
    return;
  }

  const examples = PROFILE_EXAMPLES.map(example => {
    const me = profile(example.meAnimal);
    const them = profile(example.themAnimal);
    return renderExample(lib, {
      ...example,
      me,
      them,
      areas: areaScores(me, them),
      themLabel: capitalize(example.themAnimal),
      meLabel: capitalize(example.meAnimal),
    });
  }).join('\n');

  let doc = fs.readFileSync(DOC_FILE, 'utf8');
  doc = replaceGenerated(doc, 'library', renderLibrary(lib));
  doc = replaceGenerated(doc, 'examples', examples);
  doc = replaceGenerated(doc, 'variety', renderVariety(lib));
  fs.writeFileSync(DOC_FILE, doc);
  console.log(`Updated ${path.relative(ROOT, DOC_FILE)}`);

  const cases = fixtureCases();
  writeFixture(cases);
  writeSeed(lib);
  writeCheck(cases);
}

main();
