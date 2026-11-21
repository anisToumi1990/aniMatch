# Compatibility v2 proposal: trait-based matching

Status: **built (phase 2)**. Decision: users without a v2 result use their animal's profile as-is (no expected-score table). Implementation notes are at the end.
Simulation: `scripts/compatibility-v2-simulation.js`. Builds on quiz v2 (`docs/quiz-v2-proposal.md`).

## 1. Inputs

- Each person's 5 trait scores (0–100): **social**, **curiosity**, **organization**, **kindness**, **chill**.
- With a v2 result: `user_quiz_results.trait_scores` from their latest result.
- Without one (v1 users): their animal's row in `animal_trait_profiles`.
- The relationship type of the invite: `lover`, `business_partner` or `family`.

Two building blocks, both 0–100:

| Name | Formula | Use it when… |
|---|---|---|
| `sim(t)` | `100 − |a.t − b.t|` | Being alike matters (pace, interests, how you plan). |
| `both(t)` | `0.5 × mean(a.t, b.t) + 0.5 × min(a.t, b.t)` | It matters that **both** people are high. The lower person counts double, so one very kind person can't carry a very unkind one. |

Why `both()`: in relationship research, each partner's own agreeableness (kindness), emotional stability (chill) and conscientiousness (organization) predict relationship quality much better than how *similar* the two are on those traits. Similarity matters more for lifestyle things like energy, interests and pace. So kindness, chill and organization are mostly scored as "both high", and the other traits as "alike".

## 2. Areas

| Area | Formula (weights sum to 1) | Idea |
|---|---|---|
| **Communication** | 0.35 sim(social) + 0.25 sim(curiosity) + 0.40 both(kindness) | Same talk volume, same kind of topics, and both warm when it gets hard. |
| **Energy** | 0.45 sim(social) + 0.35 sim(curiosity) + 0.20 sim(chill) | Same battery, same appetite for new things, same pace. Pure similarity. |
| **Conflict** | 0.40 both(chill) + 0.35 both(kindness) + 0.25 sim(organization) | Two easygoing, kind people fight less, and fewer fights start over dishes and deadlines. |
| **Values** | 0.35 both(organization) + 0.20 sim(organization) + 0.25 sim(curiosity) + 0.20 sim(kindness) | Reliable together, planning the same way, wanting the same mix of new and familiar, and caring about people the same way. |

**Spreading the scores.** The raw formulas cluster (most pairs would land between 50 and 80). Each area is stretched linearly: `area = clamp(62 + (raw − center) × stretch)`.

| Area | center | stretch |
|---|---|---|
| Communication | 65 | 1.88 |
| Energy | 78 | 1.77 |
| Conflict | 54 | 2.08 |
| Values | 66 | 2.08 |

`center` is the median raw score of simulated pairs, and `stretch` makes the middle 90% of pairs span about 32–92. Both come from `node scripts/compatibility-v2-simulation.js --calibrate`.

## 3. Weights per relationship type

| Area | Lover | Business partner | Family |
|---|---|---|---|
| Communication | **0.30** | 0.25 | 0.20 |
| Energy | **0.30** | 0.10 | 0.05 |
| Conflict | 0.25 | 0.20 | **0.45** |
| Values | 0.15 | **0.45** | 0.30 |

- **Lover:** chemistry is talking and doing things together, so Communication and Energy lead.
- **Business partner:** shared standards and planning (Values) matter most; whether you like the same weekends barely matters.
- **Family:** you didn't choose each other, so the main thing is how you handle friction (Conflict).

**Overall** = the weighted average of the 4 areas, passed through an S-curve: `100 / (1 + e^−(0.63 + slope × (average − center)))`, with `center` ≈ 62 and `slope` ≈ 0.072 per type (see the script).
- Averaging 4 areas pulls everyone back to the middle; the curve spreads them out again.
- Unlike a straight stretch, it never hits 0 or 100. Two identical people get about 96, not a pile of 100s.
- Overall is still saved in `compatibility_results.compatibility_score`, so Strong (≥ 75), Good (50–74) and Needs effort (< 50), the insight templates and the notifications all keep working.

## 4. Area texts

Level per area: **high ≥ 70** (where you click), **medium 45–69**, **low < 45** (where you clash). In simulation about a third of pairs are high and a sixth to a fifth are low in each area (section 5).

The result screen shows the top area as **Where you click** and the lowest area as **Where you clash**. If no area is low, it shows the lowest medium area there instead.

Rewritten in phase 2 by the rule **clear first, witty second**: no idioms, nothing that needs a second read. The bar labels say what a high score means, so "Conflict" is shown as "Handling conflict" and "Values" as "Shared values".

| Area (label) | High: where you click | Medium | Low: where you clash |
|---|---|---|---|
| Communication | You understand each other easily, even on hard topics. Rare, and very handy. | You mostly understand each other. When something sounds off, ask before assuming. | The same words often mean different things to you two. Check what the other meant. |
| Energy | You like the same pace and the same plans. Picking a weekend takes seconds. | One of you often wants more action than the other. Take turns choosing. | One of you wants to go out, the other wants to stay in. Plan some of each. |
| Handling conflict | You rarely fight, and when you do, you both calm down fast. | You argue sometimes and get past it. Try not to bring up old fights. | Small disagreements turn into fights quickly. Agree now on how to take a break. |
| Shared values | You want the same things from life, and you would plan them the same way. | You want similar things but go about them differently. Agree on the plan first. | What matters most to each of you is different. Talk about priorities early. |

These texts don't use names or pronouns, so they work for any pair and any relationship type. They live in `constants/compatibilityCopy.ts`. If every area is high, there's no "Where you clash".

## 5. Simulation

`node scripts/compatibility-v2-simulation.js [pairs] [seed] [--noise=12] [--current=file.json] [--calibrate]`

Each simulated person is a random animal's profile plus Gaussian noise (sd 12 per trait), which roughly mimics real users of the same animal. The script exits with an error if the overall spread goal is missed (p5 ≤ 40, p95 ≥ 85, sd ≥ 13).

**Distribution** (20,000 random pairs, seed 42, noise 12):

| Score | mean | sd | p5 | p25 | median | p75 | p95 | min–max |
|---|---|---|---|---|---|---|---|---|
| Communication (area) | 60 | 18.0 | 30 | 48 | 61 | 73 | 89 | 0–100 |
| Energy (area) | 60 | 18.4 | 27 | 48 | 61 | 74 | 87 | 0–100 |
| Conflict (area) | 63 | 17.9 | 33 | 50 | 63 | 75 | 93 | 0–100 |
| Values (area) | 62 | 18.0 | 32 | 50 | 62 | 75 | 92 | 0–100 |
| **Lover** | 62 | 19.5 | 26 | 49 | 65 | 78 | 89 | 6–96 |
| **Business partner** | 63 | 19.4 | 27 | 49 | 65 | 78 | 90 | 5–97 |
| **Family** | 63 | 19.1 | 28 | 50 | 65 | 78 | 90 | 6–96 |

| Overall | < 30 | 30–39 | 40–49 | 50–59 | 60–69 | 70–79 | 80–89 | 90+ |
|---|---|---|---|---|---|---|---|---|
| Lover | 7% | 8% | 11% | 14% | 18% | 20% | 17% | 5% |
| Business partner | 6% | 8% | 11% | 15% | 17% | 20% | 17% | 5% |
| Family | 6% | 8% | 11% | 15% | 18% | 19% | 17% | 6% |

- **Spread:** the middle 90% of pairs land at about **27–90**, which meets the goal of roughly 30–95 and avoids everyone sitting around 70. About a third are Strong (≥ 75) and a quarter are Needs effort (< 50).
- **Area levels:** high 31–35%, medium 46–49%, low 16–21% per area.
- **The type matters:** the same pair's Lover and Family scores differ by 8 points on average, and by 10 or more for 34% of pairs. Lover vs Business partner differs by 6.9 on average (27% ≥ 10). Business partner vs Family differs by 5.2 on average (16% ≥ 10).
- **Noise sensitivity:** with less noise (sd 6) scores move up (median 71, p5 39). With more (sd 18) they move down (median 56, p5 15). The calibration should be re-fitted once there are real `trait_scores` (see the follow-ups below).

### 15×15 animal table (Lover, animal profiles only, no noise)

The script prints the same table for Business partner and Family.

| | Dolp | Peac | Lion | Fox | Parr | Owl | Wolf | Bear | Unic | Elep | Snak | Cat | Eagl | Deer | Otte |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Dolp** | 96 | 80 | 80 | 77 | 89 | 65 | 77 | 54 | 81 | 84 | 59 | 57 | 60 | 76 | 91 |
| **Peac** | 80 | 88 | 80 | 59 | 72 | 50 | 72 | 46 | 48 | 73 | 51 | 36 | 69 | 54 | 71 |
| **Lion** | 80 | 80 | 94 | 61 | 65 | 64 | 85 | 79 | 54 | 89 | 53 | 37 | 71 | 62 | 79 |
| **Fox** | 77 | 59 | 61 | 90 | 75 | 66 | 56 | 39 | 85 | 67 | 63 | 72 | 57 | 55 | 81 |
| **Parr** | 89 | 72 | 65 | 75 | 92 | 58 | 60 | 34 | 77 | 61 | 46 | 57 | 42 | 57 | 86 |
| **Owl** | 65 | 50 | 64 | 66 | 58 | 96 | 67 | 89 | 80 | 85 | 91 | 84 | 76 | 83 | 75 |
| **Wolf** | 77 | 72 | 85 | 56 | 60 | 67 | 96 | 85 | 71 | 94 | 54 | 44 | 73 | 83 | 72 |
| **Bear** | 54 | 46 | 79 | 39 | 34 | 89 | 85 | 96 | 61 | 91 | 80 | 67 | 76 | 87 | 66 |
| **Unic** | 81 | 48 | 54 | 85 | 77 | 80 | 71 | 61 | 96 | 82 | 71 | 82 | 66 | 79 | 84 |
| **Elep** | 84 | 73 | 89 | 67 | 61 | 85 | 94 | 91 | 82 | 97 | 76 | 58 | 83 | 89 | 86 |
| **Snak** | 59 | 51 | 53 | 63 | 46 | 91 | 54 | 80 | 71 | 76 | 92 | 81 | 74 | 79 | 67 |
| **Cat** | 57 | 36 | 37 | 72 | 57 | 84 | 44 | 67 | 82 | 58 | 81 | 90 | 61 | 79 | 63 |
| **Eagl** | 60 | 69 | 71 | 57 | 42 | 76 | 73 | 76 | 66 | 83 | 74 | 61 | 90 | 73 | 60 |
| **Deer** | 76 | 54 | 62 | 55 | 57 | 83 | 83 | 87 | 79 | 89 | 79 | 79 | 73 | 96 | 71 |
| **Otte** | 91 | 71 | 79 | 81 | 86 | 75 | 72 | 66 | 84 | 86 | 67 | 63 | 60 | 71 | 96 |

- **Elephant** matches almost everyone well: it averages 80 with other animals, because kindness and chill score high in both directions. **Peacock**, **Cat** and **Parrot** are the pickiest, averaging about 62. The lowest pairs are Parrot + Bear (34), Cat + Peacock (36) and Cat + Lion (37).
- **Profile-only pairs score high.** Scored from profiles alone, animal pairs average about **73**, against 63 for simulated real users. An animal's profile is the "average" user of that animal, and averages match better than real, messier people do. Two v1 users would therefore get slightly inflated scores.
  - **Recommendation:** for a pair where either person has no v2 result, use the *expected* score for the two animals (the average over simulated users of both animals, a precomputed 15×15×3 table) instead of scoring the bare profiles. This keeps v1 and v2 pairs on the same scale. It's not in the script yet: decide before phase 2.

### Comparison with the current `animal_compatibility` scores

**Pending:** I couldn't read `animal_compatibility` (RLS blocks the anon key, and it isn't in the repo). To fill this in:
1. Export it in the Supabase SQL editor with `select json_agg(t) from public.animal_compatibility t;`.
2. Save the result as a JSON file.
3. Run `node scripts/compatibility-v2-simulation.js --current=<file>.json`.

For each relationship type, the script then prints "v2/now" in every cell, the mean and sd of both scores, their correlation, the mean difference and the 5 pairs that change the most.

## 6. Technical plan (phase 2)

### Where the score is computed and stored

- **In the database, not the app.** The score needs both people's traits, and clients must never read the other person's traits, so the app can't compute it.
- **New migration on `compatibility_results`:**
  - `communication_score`, `energy_score`, `conflict_score` and `values_score`: `smallint`, 0–100, nullable. v1 rows have none.
  - `compatibility_version` (`smallint not null default 1`; v2 rows = 2).
  - `compatibility_score` stays the overall score.
- **New table `compatibility_v2_settings`**, one row per relationship type: the 4 area weights, the overall `center` and `slope`, plus the area `center`/`stretch` values. Re-tuning is then an `update`, not a function redeploy. RLS is on with no client policies; only the functions below read it.
- **New functions**, all `security definer` with `set search_path = public`:
  - `compatibility_v2_traits(p_user_id uuid) returns jsonb`: the latest result's `trait_scores` if `quiz_version = 2`, else the animal's `animal_trait_profiles` row (or the expected-score fallback from section 5).
  - `compatibility_v2_scores(p_a jsonb, p_b jsonb, p_relationship_type text)` returns overall plus the 4 areas. It is `stable` and is a direct port of `compatibility()` in the script.
  - **Grants:** `revoke execute … from public, anon, authenticated` on both functions. Only the two RPCs below call them, so clients can't feed in someone's id and read traits back out.
- **Existing RPCs keep their signatures**, so the app's calls don't change:
  - `create_compatibility_results(invite_id)` and `update_user_compatibility_results(user_id, new_aura_id)` call the two functions above and write the overall plus area scores, with `compatibility_version = 2`.
  - Both should check the caller: `auth.uid()` must be the inviter or recipient of the invite, or equal `user_id`. Today any signed-in user may be able to call them for other people's rows.
  - These two function bodies aren't in the repo. Export them with `pg_get_functiondef` before editing.
- **A reference implementation in `lib/compatibilityV2.ts`** (pure, unit-tested) with the same constants. A test fixture generated by the script (some trait pairs and their expected scores) is checked in both Jest and a SQL `do $$ … $$` block in the migration. That catches drift between the SQL and JS versions.

### Updating on quiz retake

No new flow is needed:
- After every quiz, the app already calls `update_user_compatibility_results`, which recomputes all of that user's rows from their new traits (v2 retake or not).
- Missing rows are created through `create_compatibility_results`, as today.
- `match_ready` only fires on insert, so a retake still doesn't re-notify.
- **One-off backfill:** in the migration, recompute every existing row with v2, looping over `compatibility_results` and calling the internal functions. Notifications aren't affected because it's an update, not an insert.

### RLS: nobody reads someone else's raw traits

- **`user_quiz_results`:** clients may select **only their own rows** (`user_id = auth.uid()`). The current policy isn't in the repo, so check it first:
  - `select policyname, cmd, qual from pg_policies where tablename = 'user_quiz_results';`
  - If any policy lets users read other people's results, tighten it.
  - The app only reads its own rows today (`fetchLatestQuizResult`); other people's animals reach it through `compatibility_results.user_*_aura_id`.
- **Belt and braces:** keep `trait_scores` out of anything shared. The new `compatibility_results` columns hold only area scores, never traits, and there's no view or RPC that returns another user's `trait_scores`.
- **Area scores leak only a little:** a high Energy score tells you the other person's social and curiosity are close to yours, not what they are. That's acceptable for a compatibility feature.
- **The new table and functions:** no client access (above). `compatibility_results` keeps its current policy (only the two people in the pair can read a row).

### App changes (phase 2)

- `app/(tabs)/compatibility.tsx` shows the 4 areas as small bars, plus "Where you click" / "Where you clash" with the texts from section 4, when `compatibility_version = 2`. v1 rows keep today's view until the backfill has run.
- The insight templates (`compatibility_insight_templates`, picked by overall score) keep working unchanged.

### Follow-ups

- Re-fit the calibration (`--calibrate`) and possibly the area formulas with real `trait_scores` once enough v2 users exist. The current calibration assumes noise sd 12 around each animal.
- Decide on the v1 fallback: bare profile (as specified) or expected animal-pair score (recommended, section 5).
- Fill in the comparison with the current `animal_compatibility` (section 5).

## Phase 2: as built

- **SQL, in order** (run by hand in the SQL editor):
  1. `20261122100000_compatibility_v2.sql`: area columns, `compatibility_version`, `compatibility_v2_settings`, `compatibility_v2_traits()`, `compatibility_v2_scores()`. Additions only.
  2. `20261122100100_compatibility_v2_check.sql`: generated, read-only. Fails if the SQL scores differ from the shared fixture.
  3. `20261122100200_compatibility_v2_rollout.sql`: the internal helper `compatibility_v2_refresh_pair()`, the two RPCs, the RLS lock-down and the backfill, in one transaction.
- **The 3 implementations agree through one fixture:** the script (`--fixture`), `lib/compatibilityV2.ts` (Jest) and `compatibility_v2_scores()` (the check file).
  - Before: the RPCs were SECURITY INVOKER. They relied on client insert/update policies on `compatibility_results` and on the "accepted invite" read policy on `user_quiz_results` (`docs/compatibility-v2-db-snapshot.json`).
  - Now: both are SECURITY DEFINER and check the caller. Those client policies are gone.
- `create_compatibility_results` now does nothing for invites that aren't `accepted`. The app calls it after a rejection too.
- It also recomputes instead of inserting a second row when the pair already has one.
- **UI:** each Compatibility card shows the 4 bars plus "Where you click" / "Where you clash" (`components/compatibility/AreaBreakdown.tsx`) for v2 rows. v1 rows look as before.
