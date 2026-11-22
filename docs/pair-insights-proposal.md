# Pair insights: "The two of you" + pair strengths and challenges

Status: **phase 2 built** (migrations written, not run yet). Phase 1 decisions are in section 8.

Before this, the match detail (personal insights, `docs/personal-insights-proposal.md`) only talked about the **other** person. Library v2 puts both people in the picture:

- **The two of you**: two short cards, one for them (existing "Who they are" texts) and one for you (new "You" texts).
- **Strengths**: 2-3 bullets, each built from **both** people's scores on one trait, plus an optional cross-trait complement.
- **Challenges**: 1-2 bullets, each a clash or overlap on one trait **plus a practical tip**.
- **Tips** and the area breakdown stay. **"Your pair" is gone.**

Same rules as personal insights: a fixed, reviewed library, deterministic selection, no AI at runtime. Traits = latest quiz v2 result, else the animal's profile (`compatibility_v2_traits()`). Levels: **high ≥ 60, medium 40-59, low < 40**. Names: existing labels and the `lib/names.ts` rule. Clear first, witty second. No zodiac or fate words, no emojis, no he/she ("they" with plural verbs), and no "together" anywhere (the script rejects it). Raw scores never leave the database.

Sources:

- Content: `supabase/content/personal-insights/library.json` (version 2)
- Rules, validation, generated files: `scripts/personal-insights-preview.js`
- Every new text, for copy review: `docs/pair-insights-review.md` (generated)

```
node scripts/personal-insights-preview.js            # validate + regenerate docs, fixture, seed and SQL check
node scripts/personal-insights-preview.js --check    # validate only
node scripts/personal-insights-preview.js --pairs pairs.json   # real pairs, printed to stdout only
```

## 1. Screen

| # | Block | Content | Source |
|---|---|---|---|
| 1 | Header | Avatars, score, label, relationship type | unchanged |
| 2 | **The two of you** | Card 1: their first name + 1-2 sentences. Card 2: "You" + 1-2 sentences in the 2nd person | Card 1: `who` / `who_they`. Card 2: `you` / `you_also` |
| 3 | **Strengths** | 2-3 bullets about the pair | `pairs.*.strength`, `similar`, `cross` |
| 4 | **Challenges** | 1-2 bullets, each = clash + tip | `pairs.*.challenge`, weakest `areas`, `generic` |
| 5 | **Tips** | 3 numbered tips about them | `tip` (skips challenge traits) |
| 6 | Area breakdown | 4 bars + "Where you click" / "Where you clash" | unchanged |
| | Footer | "Based on both of your quiz results" | unchanged |

Gone from the screen: "Your pair", and the old Strengths / Challenges about the other person only. Their texts (90 `strength` / `challenge` trait texts, 30 `difference` texts) stay in the library and the table, unused. `similar` and the weak `areas` texts are now fallbacks.

## 2. Content model

| Group | Key | Texts |
|---|---|---|
| "You" card | trait × level × type × (`you`, `you_also`) | 90 |
| "You" card, balanced | type | 3 |
| Pair strength | trait × combo × type | 60 |
| Pair challenge | trait × challenge-leaning combo × type | 39 |
| Cross-trait strength | trait pair × direction × type | 60 |
| Generic challenge | type | 3 |
| **New in v2** | | **255** |
| Reworded ("together" removed) | | 12 |

**Combos.** Each trait of a pair falls into at most one combo, checked in this order (scores 0-100, compared in tenths of a point):

| Combo | Condition | Weight |
|---|---|---|
| `they_higher` | their score − yours ≥ 20 | the gap |
| `you_higher` | your score − theirs ≥ 20 | the gap |
| `both_high` | gap < 20 and both ≥ 60 | 2 × \|average − 50\| |
| `both_low` | gap < 20 and both < 40 | 2 × \|average − 50\| |
| none | anything else | |

**Lean.** Gap combos lean *challenge*. Three overlaps also lean challenge: `organization both_low` (nobody plans), `kindness both_low` (two blunt people) and `chill both_low` (two intense people). Every other shared combo leans *strength*. Only challenge-leaning combos have a challenge text (5 traits × 2 gaps × 3 types + 3 overlaps × 3 types = 39), because the others can never show one. Every combo has a strength text.

**Writing rules** on top of the general ones (checked by the script where possible):

- Gap texts are relative ("faster than you do"), because a 20-point gap can be 45 vs 65 or 72 vs 92. They mention `{name}`.
- Shared texts say "both" or "neither" (checked).
- A challenge is the clash, then one concrete thing to do: 2 sentences (checked), max 170 chars. A strength is one sentence, max 135. A "You" sentence starts with "You" (checked), max 100.
- Mirror cells (`they_higher` ↔ `you_higher`, `they_first` ↔ `you_first`) describe the same dynamic from each side, because both people see the same traits.
- Lengths are measured with a 9-letter name.

The "You" card can't reuse the `who_they` texts with "You" swapped in: many of them already mention "you". So each one was rewritten from its `who_they` counterpart.

## 3. Selection rules

Inputs: your traits **M**, their traits **T**, relationship type, stored area scores (null for v1 rows), their first name. All comparisons are in tenths of a point. Ties go in trait order (social, curiosity, organization, kindness, chill) and area order (communication, energy, conflict, values).

1. **Combos and weights** per trait (section 2).
2. **Challenges.** Candidates are the challenge-leaning combos, sorted by weight.
   - Challenge 1 is the top candidate.
   - Challenge 2 needs a weight ≥ 30, and a challenge 3 would need ≥ 40.
   - An extra challenge is only taken if at least as many combo traits as there are challenges are still free for strengths, so a screen never has more challenges than strengths. With 5 traits this means **at most 2 challenges**: 3 would need 3 free traits, so 6 in all (section 8, note on decision 5).
   - With no candidate at all, the weakest area's `weak` text is used. A v1 row has no areas, so it gets the generic challenge for its type.
3. **Strengths** come from the combo traits not used by a challenge, max 3, in this order:
   - strength-leaning shared combos, by weight
   - gap combos (their strength text is the upside of the difference), by weight
   - overlap risks, with their strength text

   If that gives fewer than 2, the `similar` text of the closest unused traits fills the gap (smallest |gap| first). This is always possible: at most 3 traits are used by then.
4. **Cross-trait complement** (optional 3rd strength).
   - Only checked when the screen has **exactly 2** strengths, so it never replaces a same-trait strength.
   - It uses **2 traits not used anywhere** in Strengths or Challenges.
   - For trait pair (A, B), direction `they_first` means: they're high on A (≥ 60) and you aren't, you're high on B and they aren't, with at least **10 points** between you on each. `you_first` is the same with the roles swapped.
   - If several pairs match, the one with the biggest sum of the two differences wins (ties go to the pair order in the library).
   - In practice both traits have no combo of their own: a gap of 10-19.9 points with one person high and the other not. It's the "Bibo brings new ideas and you make them happen" case, where neither trait on its own is a big enough difference.
5. **Tips** stay about them, in this order: their top stand-out trait, then the biggest gap not used yet, then by stand-out. **Challenge traits are skipped** (a challenge already has a tip). Only if fewer than 3 traits are left would challenge traits fill in, and with at most 2 challenges that can't happen.
6. **Cards.** Card 1: the 1-2 traits where |T − 50| ≥ 10, with the `who` text and then the `who_they` text, else the balanced text. Card 2: the same rule on your scores with `you` / `you_also`, else `you_balanced`.

**No trait twice.** A trait appears at most once across Strengths and Challenges (a cross-trait strength counts both of its traits). Tips are about them and can repeat a strength trait, as before.

**Both people see the same picture.** Weights don't depend on who's looking, and combos and cross directions flip for the other person. So both members of a pair get the same traits in the same sections, each from their own side. The script checks this on every simulated pair (section 4), and the Jest test checks it on every fixture case.

**RPC response (v2).** `get_personal_insights(result_id)` keeps its signature and its caller check, and returns finished texts only:

```json
{ "version": 2, "them": { "name": "Bibo", "who": "…" }, "you": { "who": "…" },
  "strengths": ["…", "…"], "challenges": ["…"], "tips": ["…", "…", "…"] }
```

No scores, levels, combos or trait names. `name` is the same first name the texts use (`notification_first_name()`). There's no `pair` field (decision 6).

## 4. How often each case happens

<!-- generated:stats -->
All 225 animal-profile pairs (areas from the profiles), and 5,000 noisy pairs (profile + noise, sd 12 per trait, 1 decimal; 1 in 10 without areas, like v1 rows). Types in rotation.

| | Profiles (225) | Noisy (5,000) |
|---|---|---|
| 2 / 3 strengths | 67% / 33% | 73% / 27% |
| 1 / 2 / 3 challenges | 74% / 26% / 0% | 63% / 37% / 0% |
| Challenge fallback: weakest area / generic | 3% / 0% | 2% / 0% |
| At least one "similar" strength | 14% | 15% |
| Cross-trait 3rd strength | 2% | 2% |
| Pair combos shown at least once | 20 | 20 |
| Different strength / challenge texts shown | 116 | 176 |
| Different screens | 224 | 4999 |
| Asymmetric pairs (the two people get different traits) | 0 | 0 |

Checked on every screen: no repeated text, no trait used twice across Strengths and Challenges (cross-trait counts both traits), never more challenges than strengths.
<!-- /generated:stats -->

## 5. Texts

All 255 new texts and the 12 reworded ones are in `docs/pair-insights-review.md`, grouped by section and relationship type. The phase 1 examples were kept, with a few changes:

- "both love a full house, so the family actually gets in one room" became "…so family events actually happen", because "gets the whole family in one room" is now the reworded Family "who" text.
- Two organization challenges now say whose late changes sting.

## 6. Screen previews

Animal profiles with made-up names (what two v1 users would see), with the area scores they'd get. Generated from the library.

<!-- generated:examples -->
#### Lover: you are a Wolf, Bibo is a Unicorn

Input: you (Wolf) Social 54 · Curiosity 30 · Organization 62 · Kindness 70 · Chill 34; Bibo (Unicorn) Social 46 · Curiosity 76 · Organization 32 · Kindness 66 · Chill 50; areas communication 76, energy 60, conflict 66, values 51.

**The two of you**

> **Bibo**  
> Your partner Bibo always wants to learn, try and explore something new. They're also spontaneous and happy to see where the day goes.

> **You**  
> You're grounded, practical and happy with the simple things. You're also warm and quick to notice how people feel.

**Strengths**
- You both care a lot, so you look out for each other without being asked.
- You keep the plans on track, and Bibo makes room for the fun ones.

**Challenges**
- Bibo gets bored with routine faster than you do. Agree on one new thing a month and keep the rest steady.

**Tips**
1. Put important dates in a shared calendar with reminders. It's not about trust: it frees Bibo to be spontaneous without missing what matters.
2. When Bibo gets heated, it usually means this topic really matters to them. Slow down and listen first.
3. Ask Bibo what they need, and mean it. They're so used to caring for others that a simple "How are you, really?" goes a long way.

*Area breakdown below (unchanged).*

<sub>Combos: social none, curiosity they_higher (46), organization you_higher (30), kindness both_high (36), chill none. Picked: them = curiosity high, organization low; you = curiosity low, kindness high; strengths = kindness both_high, organization you_higher; challenges = curiosity they_higher; tips = organization low, chill medium, kindness high.</sub>

#### Lover, the other side: you are the Unicorn, Sam is the Wolf

Input: you (Unicorn) Social 46 · Curiosity 76 · Organization 32 · Kindness 66 · Chill 50; Sam (Wolf) Social 54 · Curiosity 30 · Organization 62 · Kindness 70 · Chill 34; areas communication 76, energy 60, conflict 66, values 51.

**The two of you**

> **Sam**  
> Your partner Sam is grounded, practical and happy with the simple things. They're also warm, caring and quick to notice how you feel.

> **You**  
> You always want to learn, try and explore something new. You're also spontaneous and happy to see where the day goes.

**Strengths**
- You both care a lot, so you look out for each other without being asked.
- Sam keeps the plans on track, and you make room for the fun ones.

**Challenges**
- You want more new things than Sam does. Pitch one idea at a time, a few days ahead, not on the spot.

**Tips**
1. Ask Sam what they need, and mean it. They're so used to caring for others that a simple "How are you, really?" goes a long way.
2. If plans change, tell Sam as early as you can and suggest a new plan, not just a cancellation. They relax once there's a plan B.
3. When things heat up with Sam, suggest a short break and come back to it. They calm down fast once they've had a moment.

*Area breakdown below (unchanged).*

<sub>Combos: social none, curiosity you_higher (46), organization they_higher (30), kindness both_high (36), chill none. Picked: them = curiosity low, kindness high; you = curiosity high, organization low; strengths = kindness both_high, organization they_higher; challenges = curiosity you_higher; tips = kindness high, organization high, chill low.</sub>

#### Business partner: you are a Lion, Alex is a Parrot

Input: you (Lion) Social 70 · Curiosity 36 · Organization 68 · Kindness 44 · Chill 58; Alex (Parrot) Social 76 · Curiosity 66 · Organization 30 · Kindness 54 · Chill 32; areas communication 70, energy 68, conflict 48, values 53.

**The two of you**

> **Alex**  
> Your business partner Alex is at their best in front of people: clients, events, pitches. They're also flexible, quick and good at improvising.

> **You**  
> You're at your best in front of people: clients, events, pitches. You also run on lists, deadlines and clear processes.

**Strengths**
- You're both at ease with people, so clients get two strong faces instead of one.
- You stay steady under pressure and Alex brings the urgency, so deals move without panic.

**Challenges**
- You want more structure than Alex does, and their loose ends can land on your desk. Give each task one owner and a date.
- Alex starts new ideas faster than you can check them. Agree that a new project starts only when another one is finished.

**Tips**
1. Put Alex on the calls and meetings where people decide. Agree beforehand on what they can promise, so their energy closes deals you can deliver.
2. Alex gives their best with ambitious goals. Share the big target with them, then agree on the steps as a team.
3. Make feedback a regular habit with Alex, in both directions. Small notes often beat one big talk.

*Area breakdown below (unchanged).*

<sub>Combos: social both_high (46), curiosity they_higher (30), organization you_higher (38), kindness none, chill you_higher (26). Picked: them = social high, organization low; you = social high, organization high; strengths = social both_high, chill you_higher; challenges = organization you_higher, curiosity they_higher; tips = social high, chill low, kindness medium.</sub>

#### Family: you are a Bear, Noor is a Parrot

Input: you (Bear) Social 26 · Curiosity 32 · Organization 68 · Kindness 56 · Chill 70; Noor (Parrot) Social 76 · Curiosity 66 · Organization 30 · Kindness 54 · Chill 32; areas communication 45, energy 27, conflict 56, values 54.

**The two of you**

> **Noor**  
> Noor is the one who gets the whole family in one room. They're also relaxed about plans and happy to improvise.

> **You**  
> You show love quietly rather than loudly. You're also the calm one when family life gets busy.

**Strengths**
- You stay calm when family life gets loud, and Noor gets things moving when something needs fixing.
- Noor brings new places and ideas to family time, and you keep the traditions that matter.

**Challenges**
- Noor wants more family gatherings than you do. Agree on the big ones each year and skip the rest without guilt.
- You like plans settled earlier than Noor does. Fix the date a month ahead, and let them pick the place.

**Tips**
1. Don't take Noor's first reaction as their final word. Give them a little time, then talk it through.
2. Let Noor plan part of the next family gathering. They'll bring something new, and they'll feel their ideas count.
3. When Noor raises a concern, take it seriously. They speak up because they care, not to start a fight.

*Area breakdown below (unchanged).*

<sub>Combos: social they_higher (50), curiosity they_higher (34), organization you_higher (38), kindness none, chill you_higher (38). Picked: them = social high, organization low; you = social low, chill high; strengths = chill you_higher, curiosity they_higher; challenges = social they_higher, organization you_higher; tips = chill low, curiosity high, kindness medium.</sub>

#### Family, with a cross-trait strength: you are a Fox, Kai is an Elephant

Input: you (Fox) Social 60 · Curiosity 74 · Organization 36 · Kindness 34 · Chill 52; Kai (Elephant) Social 50 · Curiosity 40 · Organization 62 · Kindness 76 · Chill 70; areas communication 64, energy 66, conflict 68, values 45.

**The two of you**

> **Kai**  
> Kai is the caring heart of the family. They're also the calm one when family life gets busy.

> **You**  
> You love new ideas, places and conversations. You're also the honest one who says what others only think.

**Strengths**
- You bring new places and ideas to family time, and Kai keeps the traditions that matter.
- Kai keeps the family plans on track, and you stay relaxed when they change.
- You bring the noise to family gatherings and Kai brings the calm.

**Challenges**
- Kai softens things and you say them straight. Start with what you appreciate, then say the hard part.

**Tips**
1. Ask Kai directly what they think when the family disagrees. Their calm view helps, but they rarely offer it unprompted.
2. Ask Kai for their opinion when the family disagrees about plans. They often find the middle ground.
3. Take one organizing task off Kai's plate, and say thank you for the rest. Being noticed matters to them.

*Area breakdown below (unchanged).*

<sub>Combos: social none, curiosity you_higher (34), organization they_higher (26), kindness they_higher (42), chill none. Picked: them = kindness high, chill high; you = curiosity high, kindness low; strengths = curiosity you_higher, organization they_higher, cross social+chill you_first; challenges = kindness they_higher; tips = chill high, curiosity medium, organization high.</sub>
<!-- /generated:examples -->

## 7. Implementation

### Files

| What | Where |
|---|---|
| Content (source of truth) | `supabase/content/personal-insights/library.json` (version 2) |
| Generator / validator | `scripts/personal-insights-preview.js` |
| Reference implementation (pure) | `lib/personalInsights.ts` (`buildPersonalInsights`, `planPersonalInsights`, `parsePersonalInsights`) |
| Shared fixture | `lib/__tests__/fixtures/personalInsights-fixture.json` (profiles, both sides of the preview pairs, noisy 1-decimal users, every threshold and tie, odd names, v1 rows) |
| Jest | `lib/__tests__/personalInsights-test.ts` (fixture, screen rules, symmetry) |
| SQL | `supabase/migrations/20261123100000_pair_insights.sql` (constraints + `personal_insights_build()` v2), `…100100_pair_insights_seed.sql` (generated), `…100200_pair_insights_check.sql` (generated) |
| App | `components/compatibility/PersonalInsights.tsx` (renders v2), `lib/supabase/personalInsights.ts` (unchanged RPC call) |
| Copy review | `docs/pair-insights-review.md` (generated) |

**Changing texts or rules:** edit `library.json`, or change the rules in the script, `lib/personalInsights.ts` and `personal_insights_build()` all at once. Then run `node scripts/personal-insights-preview.js`, Jest, and the regenerated seed + check SQL.

### Database

- No new table. `personal_insight_trait_texts` gets the sections `you` / `you_also`. `personal_insight_pair_texts` gets the kinds `you_balanced`, `pair_strength` / `pair_challenge` (key = trait, variant = combo), `cross` (key = `a+b`, variant = `they_first` / `you_first`) and `generic` (key = `challenge`). The check constraints are widened, and RLS (no policies, no grants) is unchanged.
- `personal_insights_build()` is replaced (same signature) with the v2 rules. It stays SECURITY DEFINER with `search_path = public` and no client execute.
- `get_personal_insights()` is unchanged: it already passes both trait sets, the type, the first name and the v2 areas. Its comment is updated.
- The older seed / check files (`20261122130100…`, `20261122130200…`) are history. Run in order on a fresh database, each check matches the function that exists at that point.

### App

`PersonalInsights.tsx` renders "The two of you" as two cards (their first name, then "You"), then Strengths, Challenges and Tips, then the footer. `parsePersonalInsights` only accepts the v2 shape. An older response (v1 shape) shows the empty state until the SQL is live, so run the SQL before deploying the web app.

### Rollout

1. In the Supabase SQL editor, in order: `20261123100000_pair_insights.sql`, then right after it `20261123100100_pair_insights_seed.sql`, then `20261123100200_pair_insights_check.sql` (read-only, must end with "all N cases match"). Between steps 1 and 2 the RPC fails, because the function needs the new texts, so run them back to back.
2. Deploy the app (web).

## 8. Decisions

Phase 1 open questions, **decided**:

1. **Heading** for the two cards: "The two of you".
2. **"Your pair" removed.** The old strength / challenge / difference texts stay in the library and the table, unused.
3. **"You" card per relationship type**: 90 texts + 3 balanced.
4. **Cross-trait complements: yes**, all 10 trait pairs × 2 directions × 3 types = 60 texts. They're only ever an optional 3rd strength, under the rule in section 3, step 4.
5. **Thresholds as proposed**: gap ≥ 20, 2nd challenge ≥ 30, 3rd ≥ 40, never more challenges than strengths.
   - **Note:** these together cap challenges at 2. A 3rd challenge leaves only 2 traits for strengths, which breaks "never more challenges than strengths". The ≥ 40 threshold stays in the code, so allowing 3 later is one rule change: let an extra challenge through with 2 free traits. The phase 1 simulation showed 3 challenges on about 2% of screens with that looser rule.
6. **RPC switched to v2**, with no `pair` field (web only, old native builds don't matter).
7. **Tips skip challenge traits.**
8. **Only the 3 overlap risks** (organization, kindness, chill `both_low`) count as challenges.
