#!/usr/bin/env node
/**
 * Personal + pair insights (library v2): validates the content library, applies the
 * selection rules and regenerates everything derived from them:
 *
 *   - docs/personal-insights-proposal.md  generated part "library" (trait texts)
 *   - docs/pair-insights-proposal.md      generated parts "examples" and "stats"
 *   - docs/pair-insights-review.md        every v2 text, for copy review (whole file)
 *   - lib/__tests__/fixtures/personalInsights-fixture.json (Jest + SQL)
 *   - supabase/migrations/20261123100100_pair_insights_seed.sql
 *   - supabase/migrations/20261123100200_pair_insights_check.sql
 *
 *   node scripts/personal-insights-preview.js                    # validate + regenerate
 *   node scripts/personal-insights-preview.js --check            # validate only
 *   node scripts/personal-insights-preview.js --pairs <file>     # print insights for real pairs (stdout only)
 *
 * --pairs reads a JSON array produced by the SQL query in docs/personal-insights-proposal.md (section 4):
 *   [{ "name": "Sam", "relationship_type": "lover", "me": {traits}, "them": {traits},
 *      "areas": { communication, energy, conflict, values } | null }]
 * Output goes to stdout only, so real people's data never lands in the repo by accident.
 *
 * Same rules as lib/personalInsights.ts and personal_insights_build() in SQL
 * (supabase/migrations/20261123100000_pair_insights.sql); the fixture checks all three.
 * Design: docs/pair-insights-proposal.md (section 3).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIBRARY_FILE = path.join(ROOT, 'supabase', 'content', 'personal-insights', 'library.json');
const PERSONAL_DOC = path.join(ROOT, 'docs', 'personal-insights-proposal.md');
const PAIR_DOC = path.join(ROOT, 'docs', 'pair-insights-proposal.md');
const REVIEW_DOC = path.join(ROOT, 'docs', 'pair-insights-review.md');
const FIXTURE_FILE = path.join(ROOT, 'lib', '__tests__', 'fixtures', 'compatibilityV2-fixture.json');
const FIXTURE_OUT = path.join(ROOT, 'lib', '__tests__', 'fixtures', 'personalInsights-fixture.json');
const SEED_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20261123100100_pair_insights_seed.sql');
const CHECK_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20261123100200_pair_insights_check.sql');

const TRAITS = ['social', 'curiosity', 'organization', 'kindness', 'chill'];
const TRAIT_LABELS = { social: 'Social', curiosity: 'Curiosity', organization: 'Organization', kindness: 'Kindness', chill: 'Chill' };
const LEVELS = ['high', 'medium', 'low'];
const TYPES = ['lover', 'business_partner', 'family'];
const TYPE_LABELS = { lover: 'Lover', business_partner: 'Business partner', family: 'Family' };
// who = sentence 1 after {Label} (singular verb); who_they = sentence 2, starts with "They".
// strength / challenge / tip: v1 texts about them (tips still shown; strength / challenge kept, unused).
// you / you_also: the "You" card, sentence 1 and 2 (full sentences).
const SECTIONS = ['who', 'who_they', 'strength', 'challenge', 'tip', 'you', 'you_also'];
const AREAS = ['communication', 'energy', 'conflict', 'values'];

/** Pair combos per trait (doc section 2.3), checked in this order. */
const COMBOS = ['they_higher', 'you_higher', 'both_high', 'both_low'];
const GAP_COMBOS = ['they_higher', 'you_higher'];
/** Traits whose both_low overlap leans challenge (decision 8). */
const OVERLAP_RISKS = ['organization', 'kindness', 'chill'];
/** Cross-trait complements, in tie-break order. Key "a+b". */
const CROSS_PAIRS = [
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
const CROSS_DIRECTIONS = ['they_first', 'you_first'];

/** Selection thresholds in points (doc section 3). The TS and SQL versions use the same values. */
const RULES = {
  distinctive: 10, // |score - 50| for a trait to "stand out" (who / you cards, tips)
  bigGap: 20, // |gap| for they_higher / you_higher
  secondChallenge: 30, // weight needed for a 2nd challenge
  thirdChallenge: 40, // weight needed for a 3rd challenge
  crossGap: 10, // cross-trait: min difference on each of the two traits
};

/** Max length per text, measured with a long first name in place of {name}. */
const MAX = {
  who: 95, who_they: 100, strength: 135, challenge: 150, tip: 180, you: 100, you_also: 100,
  difference: 130, similar: 110, area: 115, balanced: 95, you_balanced: 100,
  pair_strength: 135, pair_challenge: 170, cross: 135, generic: 170,
};
const SAMPLE_NAME = 'Alexandra';

const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|he's|she's|boyfriend|girlfriend|husband|wife)\b/i;
const ZODIAC = /\b(zodiac\w*|horoscopes?|astrolog\w*|signs?|stars?|planets?|retrograde|mercury|destiny|fate|cosmic)\b/i;
const TOGETHER = /together/i;
const EMOJI = /\p{Extended_Pictographic}/u;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(lib) {
  const errors = [];
  const seen = new Map();
  function check(where, text, kind, { placeholders = ['{name}'], needsName = false } = {}) {
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
    if (TOGETHER.test(text)) errors.push(`${where}: uses "together" (not allowed): ${text}`);
    if (EMOJI.test(text)) errors.push(`${where}: contains an emoji`);
    const unknown = (text.match(/\{[^}]*\}/g) ?? []).filter(token => !placeholders.includes(token));
    if (unknown.length) errors.push(`${where}: unknown placeholder ${unknown.join(', ')}`);
    if (needsName && !text.includes('{name}')) errors.push(`${where}: should mention {name}`);
    const isFragment = kind === 'who' || kind === 'who_they' || kind === 'balanced';
    if (!isFragment && !/[.!?]["”]?$/.test(text)) errors.push(`${where}: should end with a full stop`);
    if (isFragment && /[.!?]$/.test(text)) errors.push(`${where}: "who" texts are fragments, no final full stop`);
    if (kind === 'who_they' && !/^They\b/.test(text)) errors.push(`${where}: must start with "They": ${text}`);
    if ((kind === 'you' || kind === 'you_also' || kind === 'you_balanced') && !/^You\b/.test(text)) errors.push(`${where}: must start with "You": ${text}`);
    if ((kind === 'pair_challenge' || kind === 'generic') && !/[.:]\s+[A-Z]/.test(text)) {
      errors.push(`${where}: a challenge is the clash, then a tip (2 sentences): ${text}`);
    }
    const key = text.toLowerCase();
    if (seen.has(key)) errors.push(`${where}: same text as ${seen.get(key)}`);
    else seen.set(key, where);
  }

  for (const trait of TRAITS) {
    for (const level of LEVELS) {
      for (const type of TYPES) {
        for (const section of SECTIONS) {
          const where = `traits.${trait}.${level}.${type}.${section}`;
          const isPersonOnly = ['who', 'who_they', 'you', 'you_also'].includes(section);
          check(where, lib.traits?.[trait]?.[level]?.[type]?.[section], section, {
            placeholders: isPersonOnly ? [] : ['{name}'],
            needsName: !isPersonOnly,
          });
        }
      }
    }
    for (const direction of GAP_COMBOS) {
      for (const type of TYPES) check(`difference.${trait}.${direction}.${type}`, lib.difference?.[trait]?.[direction]?.[type], 'difference');
    }
    check(`similar.${trait}`, lib.similar?.[trait], 'similar', { needsName: true });
    for (const combo of COMBOS) {
      for (const type of TYPES) {
        const where = `pairs.${trait}.${combo}.${type}`;
        const cell = lib.pairs?.[trait]?.[combo]?.[type];
        const isGap = GAP_COMBOS.includes(combo);
        check(`${where}.strength`, cell?.strength, 'pair_strength', { needsName: isGap });
        if (!isGap && typeof cell?.strength === 'string' && !/\b(both|neither)\b/i.test(cell.strength)) {
          errors.push(`${where}.strength: a shared combo says "both" or "neither": ${cell.strength}`);
        }
        if (leansChallenge(trait, combo)) {
          check(`${where}.challenge`, cell?.challenge, 'pair_challenge', { needsName: isGap });
        } else if (cell && 'challenge' in cell) {
          errors.push(`${where}.challenge: never shown (this combo leans strength), remove it`);
        }
      }
    }
  }
  for (const [a, b] of CROSS_PAIRS) {
    for (const direction of CROSS_DIRECTIONS) {
      for (const type of TYPES) check(`cross.${a}+${b}.${direction}.${type}`, lib.cross?.[`${a}+${b}`]?.[direction]?.[type], 'cross', { needsName: true });
    }
  }
  const crossKeys = Object.keys(lib.cross ?? {});
  if (crossKeys.join() !== CROSS_PAIRS.map(pair => pair.join('+')).join()) errors.push(`cross: keys must be ${CROSS_PAIRS.map(pair => pair.join('+')).join(', ')}`);
  for (const type of TYPES) {
    check(`balanced.${type}`, lib.balanced?.[type], 'balanced', { placeholders: [] });
    check(`you_balanced.${type}`, lib.you_balanced?.[type], 'you_balanced', { placeholders: [] });
    check(`generic.challenge.${type}`, lib.generic?.challenge?.[type], 'generic', { placeholders: [] });
  }
  for (const area of AREAS) {
    for (const strength of ['strong', 'weak']) {
      for (const type of TYPES) check(`areas.${area}.${strength}.${type}`, lib.areas?.[area]?.[strength]?.[type], 'area', { placeholders: [] });
    }
  }
  return errors;
}

function leansChallenge(trait, combo) {
  return GAP_COMBOS.includes(combo) || (combo === 'both_low' && OVERLAP_RISKS.includes(trait));
}

// ---------------------------------------------------------------------------
// Selection (keep in sync with section 3 of docs/pair-insights-proposal.md)
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
 * Which library entries a screen uses (no texts yet). Pure; also used for the
 * symmetry check: both people of a pair get mirrored plans.
 */
function planInsights(lib, { me, them, areas }) {
  const high = tenths(lib.levels.high);
  const low = tenths(lib.levels.low);
  const M = trait => tenths(me[trait]);
  const T = trait => tenths(them[trait]);
  const gap = trait => T(trait) - M(trait);

  // 1. Combo + weight per trait.
  const combo = {};
  const weight = {};
  for (const trait of TRAITS) {
    const g = gap(trait);
    combo[trait] = null;
    weight[trait] = 0;
    if (Math.abs(g) >= RULES.bigGap * 10) {
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
  const withCombo = TRAITS.filter(trait => combo[trait]);
  const byWeight = list => rank(list, trait => weight[trait], 'desc').map(item => item.key);

  // 2. Challenges: challenge-leaning combos by weight. Extra ones need their threshold, and
  // as many combo traits still free for strengths as there are challenges.
  const candidates = byWeight(withCombo.filter(trait => leansChallenge(trait, combo[trait])));
  const challengeTraits = candidates.slice(0, 1);
  const extraMin = [RULES.secondChallenge, RULES.thirdChallenge];
  for (let k = 1; k < candidates.length && k <= extraMin.length; k += 1) {
    const trait = candidates[k];
    if (weight[trait] < extraMin[k - 1] * 10) break;
    const free = withCombo.filter(other => other !== trait && !challengeTraits.includes(other)).length;
    if (free < challengeTraits.length + 1) break;
    challengeTraits.push(trait);
  }
  let challenges = challengeTraits.map(trait => ({ kind: 'trait', trait, combo: combo[trait] }));
  if (!challenges.length) {
    if (areas) challenges = [{ kind: 'area', area: rank(AREAS, area => tenths(areas[area]), 'asc')[0].key }];
    else challenges = [{ kind: 'generic' }];
  }

  // 3. Strengths: strength-leaning shared combos, then gap combos, then overlap risks; max 3.
  const free = withCombo.filter(trait => !challengeTraits.includes(trait));
  const strengthTraits = [
    ...byWeight(free.filter(trait => !leansChallenge(trait, combo[trait]))),
    ...byWeight(free.filter(trait => GAP_COMBOS.includes(combo[trait]))),
    ...byWeight(free.filter(trait => combo[trait] === 'both_low' && OVERLAP_RISKS.includes(trait))),
  ].slice(0, 3);
  const strengths = strengthTraits.map(trait => ({ kind: 'trait', trait, combo: combo[trait] }));
  const used = [...challengeTraits, ...strengthTraits];
  // Fewer than 2: the "similar" text of the closest unused traits.
  const closest = rank(TRAITS, trait => Math.abs(gap(trait)), 'asc').map(item => item.key);
  for (const trait of closest) {
    if (strengths.length >= 2) break;
    if (used.includes(trait)) continue;
    strengths.push({ kind: 'similar', trait });
    used.push(trait);
  }

  // 4. Cross-trait complement: optional 3rd strength, on two traits not used yet.
  if (strengths.length === 2) {
    let best = null;
    const clear = (hi, lo) => hi >= high && lo < high && hi - lo >= RULES.crossGap * 10;
    for (const [a, b] of CROSS_PAIRS) {
      if (used.includes(a) || used.includes(b)) continue;
      let direction = null;
      let value = 0;
      if (clear(T(a), M(a)) && clear(M(b), T(b))) {
        direction = 'they_first';
        value = T(a) - M(a) + M(b) - T(b);
      } else if (clear(M(a), T(a)) && clear(T(b), M(b))) {
        direction = 'you_first';
        value = M(a) - T(a) + T(b) - M(b);
      }
      if (direction && (!best || value > best.value)) best = { pair: `${a}+${b}`, direction, value };
    }
    if (best) strengths.push({ kind: 'cross', pair: best.pair, direction: best.direction });
  }

  // 5. Tips (about them): their top trait, the biggest gap, then by stand-out; never a challenge trait
  // unless fewer than 3 traits are left.
  const standOut = trait => Math.abs(T(trait) - 500);
  const ordered = rank(TRAITS, standOut, 'desc').map(item => item.key);
  const byGap = rank(TRAITS, trait => Math.abs(gap(trait)), 'desc').map(item => item.key);
  const tips = [];
  const isOpen = trait => !challengeTraits.includes(trait) && !tips.includes(trait);
  const addTip = trait => {
    if (trait && !tips.includes(trait) && tips.length < 3) tips.push(trait);
  };
  addTip(ordered.find(isOpen));
  addTip(byGap.find(isOpen));
  ordered.filter(isOpen).forEach(addTip);
  ordered.forEach(addTip);

  // 6. The two cards: 1-2 traits that stand out most (theirs / yours).
  const card = scoreOf => {
    const order = rank(TRAITS, trait => Math.abs(scoreOf(trait) - 500), 'desc');
    if (order[0].value < RULES.distinctive * 10) return [];
    return order.slice(0, 2).filter(item => item.value >= RULES.distinctive * 10).map(item => item.key);
  };

  return { combo, weight, challenges, strengths, tips, them: card(T), you: card(M) };
}

/**
 * Builds the finished texts for one match, from the viewer's point of view.
 * Returns the texts plus `picks` (which library entries were used) for the docs.
 */
function buildInsights(lib, { name, type, me, them, areas }) {
  const plan = planInsights(lib, { me, them, areas });
  const fill = text => capitalize(fillName(text, name));
  const theirLevel = trait => levelOf(them[trait], lib);
  const myLevel = trait => levelOf(me[trait], lib);

  const label = fill(lib.labels[type]);
  let theirWho;
  if (!plan.them.length) theirWho = `${label} ${lib.balanced[type]}.`;
  else {
    theirWho = `${label} ${lib.traits[plan.them[0]][theirLevel(plan.them[0])][type].who}.`;
    if (plan.them[1]) theirWho += ` ${lib.traits[plan.them[1]][theirLevel(plan.them[1])][type].who_they}.`;
  }
  let yourWho;
  if (!plan.you.length) yourWho = lib.you_balanced[type];
  else {
    yourWho = lib.traits[plan.you[0]][myLevel(plan.you[0])][type].you;
    if (plan.you[1]) yourWho += ` ${lib.traits[plan.you[1]][myLevel(plan.you[1])][type].you_also}`;
  }

  const strengthText = item => {
    if (item.kind === 'trait') return fill(lib.pairs[item.trait][item.combo][type].strength);
    if (item.kind === 'similar') return fill(lib.similar[item.trait]);
    return fill(lib.cross[item.pair][item.direction][type]);
  };
  const challengeText = item => {
    if (item.kind === 'trait') return fill(lib.pairs[item.trait][item.combo][type].challenge);
    if (item.kind === 'area') return lib.areas[item.area].weak[type];
    return lib.generic.challenge[type];
  };

  const describe = item => (item.kind === 'trait' ? `${item.trait} ${item.combo}` : item.kind === 'similar' ? `similar ${item.trait}` : item.kind === 'cross' ? `cross ${item.pair} ${item.direction}` : item.kind === 'area' ? `area ${item.area} weak` : 'generic');
  const picks = {
    them: plan.them.length ? plan.them.map(trait => `${trait} ${theirLevel(trait)}`) : ['balanced'],
    you: plan.you.length ? plan.you.map(trait => `${trait} ${myLevel(trait)}`) : ['balanced'],
    strengths: plan.strengths.map(describe),
    challenges: plan.challenges.map(describe),
    tips: plan.tips.map(trait => `${trait} ${theirLevel(trait)}`),
    combos: TRAITS.map(trait => (plan.combo[trait] ? `${trait} ${plan.combo[trait]} (${plan.weight[trait] / 10})` : `${trait} none`)),
  };

  return {
    version: lib.version,
    them: { name, who: theirWho },
    you: { who: yourWho },
    strengths: plan.strengths.map(strengthText),
    challenges: plan.challenges.map(challengeText),
    tips: plan.tips.map(trait => fill(lib.traits[trait][theirLevel(trait)][type].tip)),
    picks,
    plan,
  };
}

/** The other person's plan, seen from our side (they_higher <-> you_higher, they_first <-> you_first). */
function mirrorItem(item) {
  const swap = { they_higher: 'you_higher', you_higher: 'they_higher', they_first: 'you_first', you_first: 'they_first' };
  if (item.kind === 'trait') return { ...item, combo: swap[item.combo] ?? item.combo };
  if (item.kind === 'cross') return { ...item, direction: swap[item.direction] };
  return item;
}

function isSymmetric(lib, a, b, areas) {
  const ab = planInsights(lib, { me: a, them: b, areas });
  const ba = planInsights(lib, { me: b, them: a, areas });
  const key = plan => JSON.stringify([plan.strengths, plan.challenges]);
  return key(ab) === key({ strengths: ba.strengths.map(mirrorItem), challenges: ba.challenges.map(mirrorItem) });
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
  { title: 'Lover: you are a Wolf, Bibo is a Unicorn', name: 'Bibo', type: 'lover', meAnimal: 'wolf', themAnimal: 'unicorn' },
  { title: 'Lover, the other side: you are the Unicorn, Sam is the Wolf', name: 'Sam', type: 'lover', meAnimal: 'unicorn', themAnimal: 'wolf' },
  { title: 'Business partner: you are a Lion, Alex is a Parrot', name: 'Alex', type: 'business_partner', meAnimal: 'lion', themAnimal: 'parrot' },
  { title: 'Family: you are a Bear, Noor is a Parrot', name: 'Noor', type: 'family', meAnimal: 'bear', themAnimal: 'parrot' },
  { title: 'Family, with a cross-trait strength: you are a Fox, Kai is an Elephant', name: 'Kai', type: 'family', meAnimal: 'fox', themAnimal: 'elephant' },
];

function traitLine(traits) {
  return TRAITS.map(trait => `${TRAIT_LABELS[trait]} ${Math.round(traits[trait] * 10) / 10}`).join(' · ');
}

function renderInsights(result) {
  let out = '**The two of you**\n\n';
  out += `> **${result.them.name}**  \n> ${result.them.who}\n\n`;
  out += `> **You**  \n> ${result.you.who}\n\n`;
  out += `**Strengths**\n${result.strengths.map(text => `- ${text}`).join('\n')}\n\n`;
  out += `**Challenges**\n${result.challenges.map(text => `- ${text}`).join('\n')}\n\n`;
  out += `**Tips**\n${result.tips.map((text, index) => `${index + 1}. ${text}`).join('\n')}\n`;
  return out;
}

function renderPicks(picks) {
  return `<sub>Combos: ${picks.combos.join(', ')}. Picked: them = ${picks.them.join(', ')}; you = ${picks.you.join(', ')}; strengths = ${picks.strengths.join(', ')}; challenges = ${picks.challenges.join(', ')}; tips = ${picks.tips.join(', ')}.</sub>\n`;
}

function renderExample(lib, pair) {
  const result = buildInsights(lib, pair);
  let out = `#### ${pair.title}\n\n`;
  out += `Input: you (${pair.meLabel}) ${traitLine(pair.me)}; ${pair.name} (${pair.themLabel}) ${traitLine(pair.them)}`;
  if (pair.areas) {
    out += `; areas ${AREAS.map(area => `${area} ${pair.areas[area]}`).join(', ')}.\n\n`;
  } else out += '; no stored areas (v1 result).\n\n';
  out += renderInsights(result);
  out += `\n*Area breakdown below (unchanged).*\n\n${renderPicks(result.picks)}`;
  return out;
}

const cell = text => text.replace(/\|/g, '\\|');

/** docs/personal-insights-proposal.md: the trait texts (v1 sections + the "You" card). */
function renderLibrary(lib) {
  let out = '';
  for (const trait of TRAITS) {
    out += `\n#### ${TRAIT_LABELS[trait]}\n`;
    for (const level of LEVELS) {
      out += `\n**${TRAIT_LABELS[trait]}: ${level}** (${level === 'high' ? `≥ ${lib.levels.high}` : level === 'low' ? `< ${lib.levels.low}` : `${lib.levels.low}-${lib.levels.high - 1}`})\n\n`;
      out += `| Type | Who they are, sentence 1 ("{Label} …") | Who they are, sentence 2 | Strength (unused) | Challenge (unused) | Tip |\n|---|---|---|---|---|---|\n`;
      for (const type of TYPES) {
        const entry = lib.traits[trait][level][type];
        out += `| ${TYPE_LABELS[type]} | ${['who', 'who_they', 'strength', 'challenge', 'tip'].map(section => cell(entry[section])).join(' | ')} |\n`;
      }
    }
  }
  out += `\n#### Balanced (no trait stands out)\n\n| Type | Who they are ("{Label} …") |\n|---|---|\n`;
  for (const type of TYPES) out += `| ${TYPE_LABELS[type]} | ${cell(lib.balanced[type])} |\n`;

  out += `\n#### Differences (unused since library v2, "Your pair" was removed)\n\n`;
  out += `| Trait | Direction | Lover | Business partner | Family |\n|---|---|---|---|---|\n`;
  for (const trait of TRAITS) {
    for (const direction of GAP_COMBOS) {
      out += `| ${TRAIT_LABELS[trait]} | ${direction === 'they_higher' ? 'They score higher' : 'You score higher'} | ${TYPES.map(type => cell(lib.difference[trait][direction][type])).join(' | ')} |\n`;
    }
  }
  out += `\n#### Similar (strength fallback)\n\n| Trait | Text (all types) |\n|---|---|\n`;
  for (const trait of TRAITS) out += `| ${TRAIT_LABELS[trait]} | ${cell(lib.similar[trait])} |\n`;

  out += `\n#### Areas (weak = challenge fallback; strong unused)\n\n| Area | Case | Lover | Business partner | Family |\n|---|---|---|---|---|\n`;
  for (const area of AREAS) {
    for (const strength of ['strong', 'weak']) {
      out += `| ${area} | ${strength} | ${TYPES.map(type => cell(lib.areas[area][strength][type])).join(' | ')} |\n`;
    }
  }
  return out;
}

const COMBO_LABELS = {
  they_higher: 'They score higher (gap ≥ 20)',
  you_higher: 'You score higher (gap ≥ 20)',
  both_high: 'Both high',
  both_low: 'Both low',
};
const CROSS_LABELS = {
  they_first: (a, b) => `They're high on ${a}, you on ${b}`,
  you_first: (a, b) => `You're high on ${a}, they on ${b}`,
};

/** docs/pair-insights-review.md: every text the v2 screen can show that's new or reworded. */
function renderReview(lib, counts) {
  let out = `# Pair insights: copy review

GENERATED by \`node scripts/personal-insights-preview.js\` from \`supabase/content/personal-insights/library.json\` (version ${lib.version}). Don't edit this file: edit the JSON and re-run the script.

Every new text of library v2 (${counts.total} texts), grouped by section and relationship type, plus the 12 texts reworded to drop "together". "You" is the viewer, {name} is the other person (first name). Design and rules: \`docs/pair-insights-proposal.md\`.

| Group | Texts |
|---|---|
| "You" card (sentence 1 + 2) | ${counts.you} |
| "You" card, balanced | ${counts.youBalanced} |
| Pair strengths | ${counts.pairStrength} |
| Pair challenges | ${counts.pairChallenge} |
| Cross-trait strengths | ${counts.cross} |
| Generic challenge (v1 rows, no challenge found) | ${counts.generic} |
| **New total** | **${counts.total}** |
| Reworded ("together") | 12 |

Only challenge-leaning combos have a challenge text (gaps, and both low on organization / kindness / chill): the others can never show one.
`;

  out += `\n## 1. "You" card\n\nSentence 1 is used for your trait that stands out most, sentence 2 for the next one (if it also stands out, |score − 50| ≥ ${RULES.distinctive}).\n`;
  for (const type of TYPES) {
    out += `\n### ${TYPE_LABELS[type]}\n\n| Trait | Level | Sentence 1 | Sentence 2 |\n|---|---|---|---|\n`;
    for (const trait of TRAITS) {
      for (const level of LEVELS) {
        const entry = lib.traits[trait][level][type];
        out += `| ${TRAIT_LABELS[trait]} | ${level} | ${cell(entry.you)} | ${cell(entry.you_also)} |\n`;
      }
    }
    out += `| Balanced | (no trait stands out) | ${cell(lib.you_balanced[type])} | |\n`;
  }

  for (const [section, title] of [['strength', '2. Pair strengths'], ['challenge', '3. Pair challenges']]) {
    out += `\n## ${title}\n`;
    for (const type of TYPES) {
      out += `\n### ${TYPE_LABELS[type]}\n\n| Trait | Combo | Text |\n|---|---|---|\n`;
      for (const trait of TRAITS) {
        for (const combo of COMBOS) {
          const text = lib.pairs[trait][combo][type][section];
          if (text) out += `| ${TRAIT_LABELS[trait]} | ${COMBO_LABELS[combo]} | ${cell(text)} |\n`;
        }
      }
    }
  }

  out += `\n## 4. Cross-trait strengths\n\nOptional 3rd strength, only when the screen has exactly 2 strengths and both traits are still unused. Condition: the first person is high (≥ ${lib.levels.high}) on trait A and the other isn't, the second person is high on trait B and the other isn't, with at least ${RULES.crossGap} points of difference on each.\n`;
  for (const type of TYPES) {
    out += `\n### ${TYPE_LABELS[type]}\n\n| Traits | Who is high on what | Text |\n|---|---|---|\n`;
    for (const [a, b] of CROSS_PAIRS) {
      for (const direction of CROSS_DIRECTIONS) {
        out += `| ${TRAIT_LABELS[a]} + ${TRAIT_LABELS[b]} | ${CROSS_LABELS[direction](a, b)} | ${cell(lib.cross[`${a}+${b}`][direction][type])} |\n`;
      }
    }
  }

  out += `\n## 5. Generic challenge\n\nUsed only when no challenge is found and the match has no area scores (v1 rows).\n\n| Type | Text |\n|---|---|\n`;
  for (const type of TYPES) out += `| ${TYPE_LABELS[type]} | ${cell(lib.generic.challenge[type])} |\n`;

  out += `\n## 6. Reworded texts ("together" removed)\n\n| Where | New text |\n|---|---|\n`;
  for (const [where, text] of REWORDED.map(keys => [keys.join('.'), keys.reduce((node, key) => node[key], lib)])) {
    out += `| \`${where}\` | ${cell(text)} |\n`;
  }
  return out;
}

const REWORDED = [
  ['traits', 'social', 'high', 'lover', 'strength'],
  ['traits', 'social', 'high', 'family', 'who'],
  ['traits', 'social', 'high', 'family', 'who_they'],
  ['traits', 'social', 'low', 'lover', 'tip'],
  ['traits', 'curiosity', 'high', 'lover', 'tip'],
  ['traits', 'curiosity', 'high', 'family', 'tip'],
  ['traits', 'organization', 'high', 'lover', 'strength'],
  ['traits', 'organization', 'high', 'family', 'challenge'],
  ['traits', 'chill', 'low', 'business_partner', 'tip'],
  ['areas', 'energy', 'strong', 'lover'],
  ['areas', 'energy', 'strong', 'family'],
  ['areas', 'energy', 'weak', 'family'],
];

function textCounts(lib) {
  const you = TRAITS.length * LEVELS.length * TYPES.length * 2;
  let pairStrength = 0;
  let pairChallenge = 0;
  for (const trait of TRAITS) {
    for (const combo of COMBOS) {
      for (const type of TYPES) {
        pairStrength += lib.pairs[trait][combo][type].strength ? 1 : 0;
        pairChallenge += lib.pairs[trait][combo][type].challenge ? 1 : 0;
      }
    }
  }
  const cross = CROSS_PAIRS.length * CROSS_DIRECTIONS.length * TYPES.length;
  const counts = { you, youBalanced: TYPES.length, pairStrength, pairChallenge, cross, generic: TYPES.length };
  counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return counts;
}

function seededRandom(start) {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Section 4 of the pair doc: how often each case happens, symmetry and no-repeat checks. */
function renderStats(lib) {
  const random = seededRandom(7);
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const animals = Object.keys(PROFILES);
  const noisy = () => {
    const base = profile(animals[Math.floor(random() * animals.length)]);
    return Object.fromEntries(TRAITS.map(trait => [trait, Math.round(Math.min(100, Math.max(0, base[trait] + gaussian() * 12)) * 10) / 10]));
  };
  const runSet = pairs => {
    const stats = { runs: 0, strengths: {}, challenges: {}, area: 0, generic: 0, similar: 0, cross: 0, asymmetric: 0, screens: new Set(), texts: new Set(), combos: new Set() };
    pairs.forEach(([me, them, withAreas], index) => {
      const type = TYPES[index % 3];
      const areas = withAreas ? areaScores(me, them) : null;
      const result = buildInsights(lib, { name: 'Sam', type, me, them, areas });
      const all = [result.them.who, result.you.who, ...result.strengths, ...result.challenges, ...result.tips];
      if (new Set(all).size !== all.length) throw new Error('A screen repeated a text');
      const traitsUsed = [...result.plan.strengths, ...result.plan.challenges].flatMap(item => (item.kind === 'cross' ? item.pair.split('+') : item.trait ? [item.trait] : []));
      if (new Set(traitsUsed).size !== traitsUsed.length) throw new Error('A trait was used twice in strengths / challenges');
      if (result.challenges.length > result.strengths.length) throw new Error('More challenges than strengths');
      if (!isSymmetric(lib, me, them, areas)) stats.asymmetric += 1;
      stats.runs += 1;
      stats.strengths[result.strengths.length] = (stats.strengths[result.strengths.length] ?? 0) + 1;
      stats.challenges[result.challenges.length] = (stats.challenges[result.challenges.length] ?? 0) + 1;
      if (result.plan.challenges[0].kind === 'area') stats.area += 1;
      if (result.plan.challenges[0].kind === 'generic') stats.generic += 1;
      if (result.plan.strengths.some(item => item.kind === 'similar')) stats.similar += 1;
      if (result.plan.strengths.some(item => item.kind === 'cross')) stats.cross += 1;
      for (const item of [...result.plan.strengths, ...result.plan.challenges]) {
        if (item.kind === 'trait') stats.combos.add(`${item.trait} ${item.combo}`);
      }
      for (const text of [...result.strengths, ...result.challenges]) stats.texts.add(`${type}|${text}`);
      stats.screens.add(all.join('|'));
    });
    return stats;
  };
  const profilePairs = animals.flatMap(a => animals.map(b => [profile(a), profile(b), true]));
  const noisyPairs = Array.from({ length: 5000 }, (_, index) => [noisy(), noisy(), index % 10 !== 9]);
  const sets = [['Profiles (225)', runSet(profilePairs)], ['Noisy (5,000)', runSet(noisyPairs)]];
  const pct = (stats, value) => `${Math.round(((value ?? 0) / stats.runs) * 100)}%`;
  const row = (label, valueOf) => `| ${label} | ${sets.map(([, stats]) => valueOf(stats)).join(' | ')} |\n`;
  let out = `All 225 animal-profile pairs (areas from the profiles), and 5,000 noisy pairs (profile + noise, sd 12 per trait, 1 decimal; 1 in 10 without areas, like v1 rows). Types in rotation.\n\n`;
  out += `| | ${sets.map(([label]) => label).join(' | ')} |\n|---|${sets.map(() => '---').join('|')}|\n`;
  out += row('2 / 3 strengths', s => `${pct(s, s.strengths[2])} / ${pct(s, s.strengths[3])}`);
  out += row('1 / 2 / 3 challenges', s => `${pct(s, s.challenges[1])} / ${pct(s, s.challenges[2])} / ${pct(s, s.challenges[3])}`);
  out += row('Challenge fallback: weakest area / generic', s => `${pct(s, s.area)} / ${pct(s, s.generic)}`);
  out += row('At least one "similar" strength', s => pct(s, s.similar));
  out += row('Cross-trait 3rd strength', s => pct(s, s.cross));
  out += row('Pair combos shown at least once', s => `${s.combos.size}`);
  out += row('Different strength / challenge texts shown', s => `${s.texts.size}`);
  out += row('Different screens', s => `${s.screens.size}`);
  out += row('Asymmetric pairs (the two people get different traits)', s => `${s.asymmetric}`);
  out += `\nChecked on every screen: no repeated text, no trait used twice across Strengths and Challenges (cross-trait counts both traits), never more challenges than strengths.\n`;
  return out;
}

function replaceGenerated(doc, part, content, file) {
  const start = `<!-- generated:${part} -->`;
  const end = `<!-- /generated:${part} -->`;
  const from = doc.indexOf(start);
  const to = doc.indexOf(end);
  if (from === -1 || to === -1) throw new Error(`Markers for "${part}" not found in ${path.relative(ROOT, file)}`);
  return `${doc.slice(0, from + start.length)}\n${content.trim()}\n${doc.slice(to)}`;
}

// ---------------------------------------------------------------------------
// Generated files: fixture (Jest + SQL), content seed, SQL check
// ---------------------------------------------------------------------------

function traits(social, curiosity, organization, kindness, chill) {
  return { social, curiosity, organization, kindness, chill };
}

/** Deterministic cases: profiles, noisy users (1 decimal), and every threshold and tie. */
function fixtureCases(lib) {
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
  // Both sides of the preview pairs.
  for (const [a, b, type] of [['wolf', 'unicorn', 'lover'], ['lion', 'parrot', 'business_partner'], ['bear', 'parrot', 'family'], ['fox', 'elephant', 'family']]) {
    add(`${capitalize(b)} seen by ${capitalize(a)} (${type}, preview)`, { type, person: 'Bibo', me: profile(a), them: profile(b), areas: areaScores(profile(a), profile(b)) });
    add(`${capitalize(a)} seen by ${capitalize(b)} (${type}, preview mirror)`, { type, person: 'Sam', me: profile(b), them: profile(a), areas: areaScores(profile(a), profile(b)) });
  }

  // Noisy users with 1-decimal scores, like real v2 results.
  const random = seededRandom(2026);
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
  const someAreas = { communication: 70, energy: 60, conflict: 65, values: 80 };
  add('everyone at 50: balanced cards, generic challenge, 2 similar strengths', { type: 'lover', person: 'Sam', me: mid, them: mid, areas: null });
  add('everyone at 50 with areas: weakest area challenge', { type: 'family', person: 'Noor', me: mid, them: mid, areas: someAreas });
  add('levels at the limits (60 high, 59.9 medium, 40 medium, 39.9 low)', { type: 'business_partner', person: 'Alex', me: traits(60, 59.9, 40, 39.9, 50), them: traits(60, 59.9, 40, 39.9, 50), areas: null });
  add('stand-out exactly 10 vs 9.9', { type: 'family', person: 'Noor', me: traits(60, 40.1, 50, 50, 50), them: traits(60, 40.1, 50, 50, 50), areas: null });
  add('gap exactly 20: they_higher challenge', { type: 'lover', person: 'Sam', me: mid, them: traits(70, 50, 50, 50, 50), areas: null });
  add('gap 19.9: no combo', { type: 'lover', person: 'Sam', me: traits(50.1, 50, 50, 50, 50), them: traits(70, 50, 50, 50, 50), areas: null });
  add('gap exactly 20 the other way: you_higher', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 50, 50, 70), them: mid, areas: null });
  add('both high at 60 / 60', { type: 'family', person: 'Noor', me: traits(60, 50, 50, 50, 50), them: traits(60, 50, 50, 50, 50), areas: someAreas });
  add('both high 60 / 59.9: no combo', { type: 'family', person: 'Noor', me: traits(60, 50, 50, 50, 50), them: traits(59.9, 50, 50, 50, 50), areas: someAreas });
  add('both low 39.9 / 39.9 on organization: overlap risk challenge', { type: 'lover', person: 'Sam', me: traits(50, 50, 39.9, 50, 50), them: traits(50, 50, 39.9, 50, 50), areas: null });
  add('both low 40 / 39.9: no combo', { type: 'lover', person: 'Sam', me: traits(50, 50, 40, 50, 50), them: traits(50, 50, 39.9, 50, 50), areas: null });
  add('both low on social: strength, not a challenge', { type: 'business_partner', person: 'Alex', me: traits(30, 50, 50, 50, 50), them: traits(30, 50, 50, 50, 50), areas: null });
  add('2nd challenge weight exactly 30', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 50, 70, 70), them: traits(90, 80, 50, 70, 70), areas: null });
  add('2nd challenge weight 29.9', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 50, 70, 70), them: traits(90, 79.9, 50, 70, 70), areas: null });
  add('2nd challenge blocked: only 1 combo trait left for strengths', { type: 'lover', person: 'Sam', me: traits(50, 10, 90, 50, 50), them: traits(50, 90, 10, 50, 50), areas: null });
  add('three big gaps: 1 challenge, 2 complementary strengths', { type: 'family', person: 'Noor', me: traits(10, 10, 10, 50, 50), them: traits(90, 90, 90, 50, 50), areas: null });
  add('five big gaps: 2 challenges, 3 strengths, 3rd challenge blocked', { type: 'lover', person: 'Sam', me: traits(10, 10, 10, 10, 10), them: traits(90, 85, 80, 75, 70), areas: null });
  add('overlap risk beats a smaller gap', { type: 'family', person: 'Noor', me: traits(50, 50, 30, 50, 50), them: traits(50, 50, 30, 50, 75), areas: null });
  add('challenge tie (first in trait order wins)', { type: 'business_partner', person: 'Alex', me: traits(50, 50, 30, 50, 70), them: traits(50, 50, 68, 50, 32), areas: null });
  add('cross-trait at the exact thresholds (60, difference 10)', { type: 'lover', person: 'Sam', me: traits(50, 50, 60, 50, 50), them: traits(60, 50, 50, 50, 50), areas: null });
  add('cross-trait difference 9.9: none', { type: 'lover', person: 'Sam', me: traits(50.1, 50, 60, 50, 50), them: traits(60, 50, 50, 50, 50), areas: null });
  add('cross-trait you_first', { type: 'business_partner', person: 'Alex', me: traits(65, 50, 50, 50, 50), them: traits(50, 50, 50, 50, 66), areas: null });
  add('cross-trait blocked: already 3 strengths', { type: 'family', person: 'Noor', me: traits(50, 70, 60, 70, 70), them: traits(60, 70, 50, 70, 70), areas: null });
  add('cross-trait: best of two matching pairs', { type: 'lover', person: 'Sam', me: traits(50, 50, 65, 50, 68), them: traits(62, 64, 50, 50, 50), areas: null });
  add('area ties (first in area order wins)', { type: 'lover', person: 'Sam', me: profile('bear'), them: profile('bear'), areas: { communication: 40, energy: 40, conflict: 40, values: 40 } });
  add('trait ties (first in trait order wins)', { type: 'family', person: 'Noor', me: mid, them: traits(80, 20, 80, 20, 50), areas: null });
  add('extremes 0 and 100', { type: 'lover', person: 'Sam', me: traits(0, 0, 0, 0, 0), them: traits(100, 100, 100, 100, 100), areas: { communication: 0, energy: 0, conflict: 100, values: 100 } });
  add("name with an apostrophe", { type: 'family', person: "D'Arcy", me: profile('deer'), them: profile('lion'), areas: null });
  add('name with $& (inserted literally)', { type: 'lover', person: 'Jo$&n', me: profile('deer'), them: profile('lion'), areas: null });
  add('lowercase name (sentences still start with a capital)', { type: 'family', person: 'sam', me: profile('owl'), them: profile('otter'), areas: null });

  return cases.map(testCase => {
    const { picks, plan, ...expected } = buildInsights(lib, { name: testCase.person, type: testCase.type, me: testCase.me, them: testCase.them, areas: testCase.areas });
    return { name: testCase.name, relationshipType: testCase.type, person: testCase.person, me: testCase.me, them: testCase.them, areas: testCase.areas, picks, expected };
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
  for (const type of TYPES) pairRows.push(['you_balanced', '', '', type, lib.you_balanced[type]]);
  for (const type of TYPES) pairRows.push(['generic', 'challenge', '', type, lib.generic.challenge[type]]);
  for (const trait of TRAITS) {
    for (const direction of GAP_COMBOS) {
      for (const type of TYPES) pairRows.push(['difference', trait, direction, type, lib.difference[trait][direction][type]]);
    }
    pairRows.push(['similar', trait, '', '', lib.similar[trait]]);
    for (const combo of COMBOS) {
      for (const type of TYPES) {
        const entry = lib.pairs[trait][combo][type];
        pairRows.push(['pair_strength', trait, combo, type, entry.strength]);
        if (entry.challenge) pairRows.push(['pair_challenge', trait, combo, type, entry.challenge]);
      }
    }
  }
  for (const [a, b] of CROSS_PAIRS) {
    for (const direction of CROSS_DIRECTIONS) {
      for (const type of TYPES) pairRows.push(['cross', `${a}+${b}`, direction, type, lib.cross[`${a}+${b}`][direction][type]]);
    }
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
  const sql = `-- Personal + pair insights content (library version ${lib.version}): ${traitRows.length} trait texts + ${pairRows.length} pair texts.
-- GENERATED by node scripts/personal-insights-preview.js from supabase/content/personal-insights/library.json.
-- Edit the JSON and re-run the script; don't edit this file by hand.
--
-- Replaces the whole library in one transaction (only personal_insights_build() reads it).
-- Run in the Supabase SQL editor right after 20261123100000_pair_insights.sql.

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
  console.log(`Wrote ${path.relative(ROOT, SEED_MIGRATION)} (${traitRows.length} + ${pairRows.length} rows)`);
}

function writeCheck(cases) {
  const rows = cases
    .map(c => `    (${[sqlString(c.name), sqlString(c.relationshipType), sqlString(c.person), sqlJson(c.me), sqlJson(c.them), sqlJson(c.areas), sqlJson(c.expected)].join(', ')})`)
    .join(',\n');
  const sql = `-- Pair insights: checks personal_insights_build() against the shared fixture.
-- GENERATED by node scripts/personal-insights-preview.js (same cases as
-- lib/__tests__/fixtures/personalInsights-fixture.json, which Jest checks against
-- lib/personalInsights.ts). Don't edit by hand.
--
-- Read-only: raises an exception (and changes nothing) if any case returns different texts.
-- Run in the Supabase SQL editor after 20261123100100_pair_insights_seed.sql.

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
    raise exception E'pair insights check: % of % cases differ:\\n%', cardinality(failures), checked, array_to_string(failures[1:5], E'\\n');
  end if;
  raise notice 'pair insights check: all % cases match', checked;
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
      // v1 rows have no stored areas: the area fallback is skipped, like in the app.
      const areas = pair.areas && AREAS.every(area => Number.isFinite(pair.areas[area])) ? pair.areas : null;
      console.log(
        renderExample(lib, {
          ...pair,
          type: pair.relationship_type,
          areas,
          title: `Pair ${index + 1}: ${TYPE_LABELS[pair.relationship_type]}, ${pair.name}`,
          themLabel: 'them',
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

  let personalDoc = fs.readFileSync(PERSONAL_DOC, 'utf8');
  personalDoc = replaceGenerated(personalDoc, 'library', renderLibrary(lib), PERSONAL_DOC);
  fs.writeFileSync(PERSONAL_DOC, personalDoc);
  console.log(`Updated ${path.relative(ROOT, PERSONAL_DOC)}`);

  let pairDoc = fs.readFileSync(PAIR_DOC, 'utf8');
  pairDoc = replaceGenerated(pairDoc, 'stats', renderStats(lib), PAIR_DOC);
  pairDoc = replaceGenerated(pairDoc, 'examples', examples, PAIR_DOC);
  fs.writeFileSync(PAIR_DOC, pairDoc);
  console.log(`Updated ${path.relative(ROOT, PAIR_DOC)}`);

  const counts = textCounts(lib);
  fs.writeFileSync(REVIEW_DOC, renderReview(lib, counts));
  console.log(`Wrote ${path.relative(ROOT, REVIEW_DOC)} (${counts.total} new texts)`);

  const cases = fixtureCases(lib);
  writeFixture(cases);
  writeSeed(lib);
  writeCheck(cases);
}

main();
