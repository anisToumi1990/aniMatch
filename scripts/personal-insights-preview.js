#!/usr/bin/env node
/**
 * Personal insights (phase 1, proposal): validates the content library, applies
 * the selection rules and writes the generated parts of
 * docs/personal-insights-proposal.md (between <!-- generated:<part> --> markers).
 * See that doc for the design.
 *
 *   node scripts/personal-insights-preview.js                    # validate + update the doc
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

function levelOf(score, lib) {
  if (score >= lib.levels.high) return 'high';
  if (score < lib.levels.low) return 'low';
  return 'medium';
}

/** Traits by how much they stand out (|score - 50|), ties in TRAITS order. */
function byDistinctiveness(them) {
  return TRAITS.map((trait, index) => ({ trait, index, dist: Math.abs(them[trait] - 50) })).sort(
    (x, y) => y.dist - x.dist || x.index - y.index
  );
}

function fill(text, name, label) {
  return text.replace(/\{Label\}/g, label).replace(/\{name\}/g, name);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds the finished texts for one match, from the viewer's point of view.
 * Returns the texts plus `picks` (which library entries were used) for the doc.
 */
function buildInsights(lib, { name, type, me, them, areas }) {
  const label = capitalize(lib.labels[type].replace('{name}', name));
  const level = trait => levelOf(them[trait], lib);
  const text = (trait, section) => fill(lib.traits[trait][level(trait)][type][section], name, label);
  const ordered = byDistinctiveness(them);
  const gap = trait => them[trait] - me[trait];
  const picks = {};

  // 1. Who they are: the 1-2 traits that stand out most.
  const standOut = ordered.filter(entry => entry.dist >= RULES.distinctive).slice(0, 2);
  let who;
  if (standOut.length === 0) {
    who = `${label} ${lib.balanced[type]}.`;
    picks.who = ['balanced'];
  } else {
    who = `${label} ${lib.traits[standOut[0].trait][level(standOut[0].trait)][type].who}.`;
    if (standOut[1]) who += ` ${name} ${lib.traits[standOut[1].trait][level(standOut[1].trait)][type].who}.`;
    picks.who = standOut.map(entry => `${entry.trait} ${level(entry.trait)}`);
  }

  // 2. Strengths: the top 2 traits, plus a 3rd if it stands out too.
  const strengthTraits = ordered.slice(0, 3).filter((entry, index) => index < 2 || entry.dist >= RULES.distinctive).map(entry => entry.trait);
  const strengths = strengthTraits.map(trait => text(trait, 'strength'));
  picks.strengths = strengthTraits.map(trait => `${trait} ${level(trait)}`);

  // 3. Challenges: standing out + being far from you (that's where friction shows up).
  const challengeScore = trait => Math.abs(them[trait] - 50) + 0.5 * Math.abs(gap(trait));
  const challengeOrder = TRAITS.map((trait, index) => ({ trait, index, score: challengeScore(trait) })).sort(
    (x, y) => y.score - x.score || x.index - y.index
  );
  const challengeTraits = [challengeOrder[0].trait];
  if (challengeOrder[1].score >= RULES.secondChallenge) challengeTraits.push(challengeOrder[1].trait);
  const challenges = challengeTraits.map(trait => text(trait, 'challenge'));
  picks.challenges = challengeTraits.map(trait => `${trait} ${level(trait)}`);

  // 4. Tips: 3 different traits. Their top trait (what makes them give their best),
  // your biggest gap (how to deal with the difference), their main challenge.
  const byGap = TRAITS.map((trait, index) => ({ trait, index, gap: Math.abs(gap(trait)) })).sort((x, y) => y.gap - x.gap || x.index - y.index);
  const tipTraits = [];
  const addTip = trait => {
    if (trait && !tipTraits.includes(trait) && tipTraits.length < 3) tipTraits.push(trait);
  };
  addTip(ordered[0].trait);
  addTip(byGap.find(entry => !tipTraits.includes(entry.trait))?.trait);
  addTip(challengeTraits.find(trait => !tipTraits.includes(trait)));
  for (const entry of ordered) addTip(entry.trait);
  const tips = tipTraits.map(trait => text(trait, 'tip'));
  picks.tips = tipTraits.map(trait => `${trait} ${level(trait)}`);

  // 5. Your pair: the biggest trait difference, then the area scores.
  const biggest = byGap[0];
  let pair;
  if (biggest.gap >= RULES.bigGap) {
    const direction = gap(biggest.trait) > 0 ? 'they_higher' : 'you_higher';
    pair = fill(lib.difference[biggest.trait][direction][type], name, label);
    picks.pair = [`difference ${biggest.trait} ${direction} (${Math.round(biggest.gap)} pts)`];
  } else {
    const closest = byGap[byGap.length - 1];
    pair = fill(lib.similar[closest.trait], name, label);
    picks.pair = [`similar ${closest.trait}`];
  }
  if (areas) {
    const sorted = AREAS.map((area, index) => ({ area, index, score: areas[area] })).sort((x, y) => x.score - y.score || x.index - y.index);
    const weakest = sorted[0];
    const strongest = [...sorted].sort((x, y) => y.score - x.score || x.index - y.index)[0];
    if (weakest.score < RULES.weakArea) {
      pair += ` ${lib.areas[weakest.area].weak[type]}`;
      picks.pair.push(`${weakest.area} weak (${weakest.score})`);
    } else if (strongest.score >= RULES.strongArea) {
      pair += ` ${lib.areas[strongest.area].strong[type]}`;
      picks.pair.push(`${strongest.area} strong (${strongest.score})`);
    } else {
      picks.pair.push('no area sentence (all areas 55-69)');
    }
  }

  return { who, strengths, challenges, tips, pair, picks };
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
  out += `areas ${AREAS.map(area => `${area} ${pair.areas[area]}`).join(', ')}.\n\n`;
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
      const areas = pair.areas && AREAS.every(area => Number.isFinite(pair.areas[area])) ? pair.areas : areaScores(pair.me, pair.them);
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
}

main();
