#!/usr/bin/env node
/**
 * Builds a seed migration and a review doc from the daily content files:
 *
 *   --kind=aura (default)  supabase/content/daily-aura/season-<n>/<animal>.json
 *                          JSON array of [message, do_text, dont_text] -> daily_aura_messages
 *   --kind=pair            supabase/content/daily-pair-tips/season-<n>/<animal>.json
 *                          JSON array of tip strings ("{name}" = the other person) -> daily_pair_tips
 *
 * The array position is the day_index (1-based).
 *
 * Usage:
 *   node scripts/build-daily-aura-seed.js                         # daily aura, season 1
 *   node scripts/build-daily-aura-seed.js --kind=pair             # pair tips, season 1
 *   node scripts/build-daily-aura-seed.js [--kind=…] 2 <file.sql> # season 2, custom migration name
 *   node scripts/build-daily-aura-seed.js [--kind=…] --check      # validate only
 *
 * Fails (exit 1) on: wrong count, too-long texts, repeats, banned topics, emojis,
 * and for pair tips: gendered pronouns or unknown {placeholders}.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ANIMALS = [
  'bear', 'cat', 'deer', 'dolphin', 'eagle', 'elephant', 'fox', 'lion',
  'otter', 'owl', 'parrot', 'peacock', 'snake', 'unicorn', 'wolf',
];

const KINDS = {
  aura: {
    contentDir: 'daily-aura',
    table: 'daily_aura_messages',
    title: 'Daily aura messages',
    fields: [
      { column: 'message', label: 'message', max: 110, header: 'Message' },
      { column: 'do_text', label: 'do', max: 40, header: 'Do' },
      { column: 'dont_text', label: 'dont', max: 40, header: "Don't" },
    ],
    perAnimal: 60,
    reviewCount: 5,
    noun: 'messages',
    defaultMigration: season => (season === 1 ? '20261117090100_daily_aura_season1_seed.sql' : null),
    reviewFile: season => (season === 1 ? 'daily-aura-review.md' : `daily-aura-review-season-${season}.md`),
    reviewTitle: season => `Daily aura review: season ${season}`,
  },
  pair: {
    contentDir: 'daily-pair-tips',
    table: 'daily_pair_tips',
    title: 'Daily pair tips',
    fields: [{ column: 'tip', label: 'tip', max: 110, header: 'Tip' }],
    perAnimal: 30,
    reviewCount: 3,
    noun: 'tips',
    defaultMigration: season => (season === 1 ? '20261118090100_daily_pair_tips_season1_seed.sql' : null),
    reviewFile: season => (season === 1 ? 'daily-pair-tips-review.md' : `daily-pair-tips-review-season-${season}.md`),
    reviewTitle: season => `Daily pair tips review: season ${season}`,
  },
};

// Topics the content must stay away from (health/medical, politics, religion, substances).
const BANNED = [
  /\b(doctor|medic\w*|medication|pill|therapy|therapist|diet|calorie|weight loss|workout|hydrat\w*|vitamin|sick|illness|disease|anxiety disorder|depress\w*)\b/i,
  /\b(politic\w*|election|vote|government|president|left-wing|right-wing)\b/i,
  /\b(god|gods|pray\w*|prayer|church|mosque|temple|bible|quran|religio\w*|karma|blessed|holy|sin)\b/i,
  /\b(alcohol|drunk|wine|beer|vodka|shots?|weed|drugs?|cigarette|smok\w*|hangover)\b/i,
];
const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|he's|she's|he'll|she'll|he'd|she'd)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
// Length is checked with a longish first name in place of {name}.
const SAMPLE_NAME = 'Alexandra';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const kindArg = (args.find(arg => arg.startsWith('--kind=')) ?? '--kind=aura').split('=')[1];
const kind = KINDS[kindArg];
if (!kind) {
  console.error(`Unknown --kind=${kindArg}. Use one of: ${Object.keys(KINDS).join(', ')}.`);
  process.exit(1);
}
const positional = args.filter(arg => !arg.startsWith('--'));
const season = Number(positional[0] ?? 1);
const migrationName = positional[1] ?? kind.defaultMigration(season);
if (!checkOnly && !migrationName) {
  console.error('Pass a migration file name for seasons after 1, e.g. 20270101090000_daily_aura_season2_seed.sql');
  process.exit(1);
}

const contentDir = path.join(ROOT, 'supabase', 'content', kind.contentDir, `season-${season}`);
const errors = [];
const seen = new Map();

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sqlString(text) {
  return `'${text.replace(/'/g, "''")}'`;
}

const content = {};
for (const animal of ANIMALS) {
  const file = path.join(contentDir, `${animal}.json`);
  if (!fs.existsSync(file)) {
    errors.push(`${animal}: missing ${path.relative(ROOT, file)}`);
    continue;
  }
  // Single-field kinds store plain strings; normalize every row to an array of fields.
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')).map(row => (typeof row === 'string' ? [row] : row));
  content[animal] = rows;
  if (rows.length !== kind.perAnimal) {
    errors.push(`${animal}: ${rows.length} rows, expected ${kind.perAnimal}`);
  }
  rows.forEach((row, index) => {
    const where = `${animal} #${index + 1}`;
    if (!Array.isArray(row) || row.length !== kind.fields.length || row.some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(`${where}: must have ${kind.fields.length} non-empty string(s)`);
      return;
    }
    row.forEach((text, fieldIndex) => {
      const field = kind.fields[fieldIndex];
      const measured = text.replace(/\{name\}/g, SAMPLE_NAME);
      if (measured.length > field.max) errors.push(`${where}: ${field.label} is ${measured.length} chars (max ${field.max}): ${text}`);
      if (EMOJI.test(text)) errors.push(`${where}: ${field.label} contains an emoji: ${text}`);
      BANNED.forEach(pattern => {
        const match = text.match(pattern);
        if (match) errors.push(`${where}: ${field.label} mentions "${match[0]}": ${text}`);
      });
      if (kindArg === 'pair') {
        const gendered = text.match(GENDERED);
        if (gendered) errors.push(`${where}: ${field.label} uses "${gendered[0]}" (use {name} or they): ${text}`);
        const placeholder = text.replace(/\{name\}/g, '').match(/[{}]/);
        if (placeholder) errors.push(`${where}: ${field.label} has an unknown placeholder (only {name}): ${text}`);
      }
    });
    const key = normalize(row[0]);
    if (seen.has(key)) errors.push(`${where}: ${kind.fields[0].label} repeats ${seen.get(key)}: ${row[0]}`);
    else seen.set(key, where);
  });
}

if (errors.length > 0) {
  console.error(`Found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const total = Object.values(content).reduce((sum, rows) => sum + rows.length, 0);
console.log(`OK: ${total} ${kind.noun} for season ${season} (${ANIMALS.length} animals).`);
if (checkOnly) process.exit(0);

// Seed migration: look up aura_id by name, idempotent.
const columns = kind.fields.map(field => field.column);
const values = [];
for (const animal of ANIMALS) {
  content[animal].forEach((row, index) => {
    values.push(`  (${sqlString(animal)}, ${index + 1}, ${row.map(sqlString).join(', ')})`);
  });
}
const sql = `-- ${kind.title}, season ${season}: ${total} rows (${kind.perAnimal} per animal).
-- GENERATED by scripts/build-daily-aura-seed.js from supabase/content/${kind.contentDir}/season-${season}/.
-- Edit the JSON files and re-run the script; don't edit this file by hand.
--
-- aura_id is looked up by animal name (case-insensitive). Idempotent: re-running
-- skips rows that already exist for (aura_id, season, day_index).

begin;

insert into public.${kind.table} (aura_id, season, day_index, ${columns.join(', ')})
select a.id, ${season}, v.day_index, ${columns.map(column => `v.${column}`).join(', ')}
from (values
${values.join(',\n')}
) as v (animal, day_index, ${columns.join(', ')})
join public.animal_auras a on lower(btrim(a.name)) = v.animal
on conflict (aura_id, season, day_index) do nothing;

-- Every animal must be found, or the seed silently skips its rows.
do $$
declare
  v_missing text;
begin
  select string_agg(v.animal, ', ') into v_missing
  from unnest(array[${ANIMALS.map(sqlString).join(', ')}]) as v (animal)
  where not exists (select 1 from public.animal_auras a where lower(btrim(a.name)) = v.animal);
  if v_missing is not null then
    raise exception '${kindArg === 'aura' ? 'daily aura' : 'daily pair tips'} seed: animals not found in animal_auras: %', v_missing;
  end if;
end $$;

commit;
`;
const migrationPath = path.join(ROOT, 'supabase', 'migrations', migrationName);
fs.writeFileSync(migrationPath, sql);
console.log(`Wrote ${path.relative(ROOT, migrationPath)}`);

// Review doc: first rows of each animal.
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const cell = text => text.replace(/\|/g, '\\|');
let review = `# ${kind.reviewTitle(season)}\n\n`;
review += `The first ${kind.reviewCount} of ${kind.perAnimal} ${kind.noun} for each animal, in the order users see them (day 1 = #1).\n`;
if (kindArg === 'pair') review += 'The animal is the other person\'s; `{name}` is replaced by their first name in the app.\n';
review += `Source: \`supabase/content/${kind.contentDir}/season-${season}/\`. Generated by \`scripts/build-daily-aura-seed.js\`.\n`;
for (const animal of ANIMALS) {
  review += `\n## ${capitalize(animal)}\n\n| # | ${kind.fields.map(field => field.header).join(' | ')} |\n|---|${kind.fields.map(() => '---').join('|')}|\n`;
  content[animal].slice(0, kind.reviewCount).forEach((row, index) => {
    review += `| ${index + 1} | ${row.map(cell).join(' | ')} |\n`;
  });
}
const reviewPath = path.join(ROOT, 'docs', kind.reviewFile(season));
fs.writeFileSync(reviewPath, review);
console.log(`Wrote ${path.relative(ROOT, reviewPath)}`);
