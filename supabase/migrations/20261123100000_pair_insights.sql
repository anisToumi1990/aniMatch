-- Pair insights, library v2 (docs/pair-insights-proposal.md): the match detail shows
-- "The two of you" (their card + a "You" card), pair Strengths / Challenges built from
-- both people's traits, and Tips. "Your pair" is gone.
--
-- Replaces personal_insights_build() (same signature, v2 rules and response) and widens
-- the content tables' check constraints for the new sections and kinds. No new table;
-- RLS (no policies, no grants) and get_personal_insights() are unchanged.
--
-- Run in the Supabase SQL editor, in this order:
--   1. this file
--   2. 20261123100100_pair_insights_seed.sql  (generated: library v2)
--   3. 20261123100200_pair_insights_check.sql (generated: read-only fixture check)
-- Between steps 1 and 2 the RPC fails (the v2 texts don't exist yet), so run 1 and 2
-- back to back. The web app only reads the v2 response, so deploy it after step 3.
--
-- v2 response (finished texts only, never scores, levels, combos or trait names):
--   { version, them: { name, who }, you: { who }, strengths[], challenges[], tips[] }

begin;

-------------------------------------------------------------------------------
-- 1. Content tables: new sections and kinds
-------------------------------------------------------------------------------

alter table public.personal_insight_trait_texts
  drop constraint if exists personal_insight_trait_texts_section_check;
alter table public.personal_insight_trait_texts
  add constraint personal_insight_trait_texts_section_check
    check (section in ('who', 'who_they', 'strength', 'challenge', 'tip', 'you', 'you_also'));

-- '' means "not applicable":
--   you_balanced    key ''         variant ''                       relationship_type = type
--   pair_strength   key trait      variant combo                    relationship_type = type
--   pair_challenge  key trait      variant combo                    relationship_type = type
--   cross           key 'a+b'      variant they_first | you_first   relationship_type = type
--   generic         key challenge  variant ''                       relationship_type = type
alter table public.personal_insight_pair_texts
  drop constraint if exists personal_insight_pair_texts_kind_check;
alter table public.personal_insight_pair_texts
  add constraint personal_insight_pair_texts_kind_check
    check (kind in ('label', 'balanced', 'difference', 'similar', 'area',
                    'you_balanced', 'pair_strength', 'pair_challenge', 'cross', 'generic'));

comment on table public.personal_insight_pair_texts is
  'Personal + pair insights: labels, fallbacks, pair strength / challenge, cross-trait and area texts. Source: supabase/content/personal-insights/library.json.';

-------------------------------------------------------------------------------
-- 2. personal_insights_build(): the v2 selection rules (doc section 3)
--
-- Same rules as buildPersonalInsights() in lib/personalInsights.ts and buildInsights()
-- in scripts/personal-insights-preview.js; 20261123100200_pair_insights_check.sql
-- compares this function with the shared fixture.
--
-- All scores are compared in tenths of a point (integers). Ties: trait order
-- social, curiosity, organization, kindness, chill; area order communication,
-- energy, conflict, values; cross pairs in c_cross_a / c_cross_b order.
-- Returns null if an input is missing.
-------------------------------------------------------------------------------

create or replace function public.personal_insights_build(
  p_me jsonb,
  p_them jsonb,
  p_relationship_type text,
  p_name text,
  p_areas jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_version constant integer := 2; -- library.json "version"
  c_traits constant text[] := array['social', 'curiosity', 'organization', 'kindness', 'chill'];
  c_areas constant text[] := array['communication', 'energy', 'conflict', 'values'];
  -- Overlaps that lean challenge when both are low.
  c_overlap_risks constant text[] := array['organization', 'kindness', 'chill'];
  -- Cross-trait pairs (a + b), in tie-break order.
  c_cross_a constant integer[] := array[1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
  c_cross_b constant integer[] := array[2, 3, 4, 5, 3, 4, 5, 4, 5, 5];
  -- Thresholds in tenths of a point (library.json levels + PERSONAL_INSIGHTS_RULES).
  c_level_high constant integer := 600;
  c_level_low constant integer := 400;
  c_stand_out constant integer := 100;
  c_big_gap constant integer := 200;
  c_extra_challenge constant integer[] := array[300, 400]; -- 2nd, 3rd challenge
  c_cross_gap constant integer := 100;

  v_me integer[] := array[]::integer[];
  v_them integer[] := array[]::integer[];
  v_combo text[] := array[null, null, null, null, null]::text[];
  v_weight integer[] := array[0, 0, 0, 0, 0];
  v_lean text[] := array[null, null, null, null, null]::text[];
  v_gap integer;
  i integer;
  k integer;
  t integer;
  v_free integer;

  v_candidates integer[];
  v_challenge_traits integer[] := array[]::integer[];
  v_strength_traits integer[];
  v_similar_traits integer[] := array[]::integer[];
  v_used integer[];
  v_tip_traits integer[] := array[]::integer[];
  v_ordered integer[];
  v_by_gap integer[];
  v_closest integer[];
  v_card integer[];

  v_cross_key text;
  v_cross_direction text;
  v_cross_value integer;
  v_best_key text;
  v_best_direction text;
  v_best_value integer;
  a integer;
  b integer;

  v_level text;
  v_label text;
  v_their_who text;
  v_your_who text;
  v_strengths text[] := array[]::text[];
  v_challenges text[] := array[]::text[];
  v_tips text[] := array[]::text[];
  v_weak_area text;
begin
  if p_me is null or p_them is null or p_name is null
    or p_relationship_type is null or p_relationship_type not in ('lover', 'business_partner', 'family') then
    return null;
  end if;
  if exists (
    select 1 from unnest(c_traits) as u (trait)
    where coalesce(jsonb_typeof(p_me -> u.trait), '') <> 'number'
       or coalesce(jsonb_typeof(p_them -> u.trait), '') <> 'number'
  ) then
    return null;
  end if;

  -- Scores in tenths, by trait index 1..5.
  for i in 1..5 loop
    v_me := v_me || round((p_me ->> c_traits[i])::numeric * 10)::integer;
    v_them := v_them || round((p_them ->> c_traits[i])::numeric * 10)::integer;
  end loop;

  -- 1. Combo, weight and lean per trait.
  for i in 1..5 loop
    v_gap := v_them[i] - v_me[i];
    if abs(v_gap) >= c_big_gap then
      v_combo[i] := case when v_gap > 0 then 'they_higher' else 'you_higher' end;
      v_weight[i] := abs(v_gap);
    elsif v_me[i] >= c_level_high and v_them[i] >= c_level_high then
      v_combo[i] := 'both_high';
      v_weight[i] := abs(v_me[i] + v_them[i] - 1000);
    elsif v_me[i] < c_level_low and v_them[i] < c_level_low then
      v_combo[i] := 'both_low';
      v_weight[i] := abs(v_me[i] + v_them[i] - 1000);
    end if;
    if v_combo[i] in ('they_higher', 'you_higher')
      or (v_combo[i] = 'both_low' and c_traits[i] = any (c_overlap_risks)) then
      v_lean[i] := 'challenge';
    elsif v_combo[i] is not null then
      v_lean[i] := 'strength';
    end if;
  end loop;

  -- 2. Challenges: challenge-leaning combos by weight. An extra one needs its threshold and
  -- as many combo traits still free for strengths as there are challenges.
  select coalesce(array_agg(g.i order by v_weight[g.i] desc, g.i), array[]::integer[])
  into v_candidates
  from generate_series(1, 5) as g (i)
  where v_lean[g.i] = 'challenge';

  if cardinality(v_candidates) >= 1 then
    v_challenge_traits := array[v_candidates[1]];
  end if;
  for k in 2..3 loop
    exit when k > cardinality(v_candidates);
    t := v_candidates[k];
    exit when v_weight[t] < c_extra_challenge[k - 1];
    select count(*) into v_free
    from generate_series(1, 5) as g (i)
    where v_combo[g.i] is not null and g.i <> t and not (g.i = any (v_challenge_traits));
    exit when v_free < cardinality(v_challenge_traits) + 1;
    v_challenge_traits := v_challenge_traits || t;
  end loop;

  if cardinality(v_challenge_traits) > 0 then
    foreach t in array v_challenge_traits loop
      v_challenges := v_challenges || public.personal_insights_capitalize(replace(
        public.personal_insights_pair_text('pair_challenge', c_traits[t], v_combo[t], p_relationship_type), '{name}', p_name));
    end loop;
  elsif p_areas is not null and jsonb_typeof(p_areas) = 'object' and not exists (
    select 1 from unnest(c_areas) as u (area) where coalesce(jsonb_typeof(p_areas -> u.area), '') <> 'number'
  ) then
    -- No challenge found: the weakest area's advice.
    select u.area into v_weak_area
    from unnest(c_areas) with ordinality as u (area, idx)
    order by round((p_areas ->> u.area)::numeric * 10) asc, u.idx
    limit 1;
    v_challenges := array[public.personal_insights_pair_text('area', v_weak_area, 'weak', p_relationship_type)];
  else
    -- v1 row (no areas): the generic challenge.
    v_challenges := array[public.personal_insights_pair_text('generic', 'challenge', '', p_relationship_type)];
  end if;

  -- 3. Strengths: strength-leaning shared combos, then gap combos, then overlap risks; max 3.
  select coalesce(array_agg(s.i order by s.grp, s.w desc, s.i), array[]::integer[])
  into v_strength_traits
  from (
    select g.i, v_weight[g.i] as w,
           case when v_lean[g.i] = 'strength' then 1
                when v_combo[g.i] in ('they_higher', 'you_higher') then 2
                else 3 end as grp
    from generate_series(1, 5) as g (i)
    where v_combo[g.i] is not null and not (g.i = any (v_challenge_traits))
  ) s;
  v_strength_traits := coalesce(v_strength_traits[1:3], array[]::integer[]);
  v_used := v_challenge_traits || v_strength_traits;

  if cardinality(v_strength_traits) > 0 then
    foreach t in array v_strength_traits loop
      v_strengths := v_strengths || public.personal_insights_capitalize(replace(
        public.personal_insights_pair_text('pair_strength', c_traits[t], v_combo[t], p_relationship_type), '{name}', p_name));
    end loop;
  end if;

  -- Fewer than 2: the "similar" text of the closest unused traits.
  select array_agg(g.i order by abs(v_them[g.i] - v_me[g.i]), g.i) into v_closest
  from generate_series(1, 5) as g (i);
  foreach t in array v_closest loop
    exit when cardinality(v_strengths) >= 2;
    if not (t = any (v_used)) then
      v_strengths := v_strengths || public.personal_insights_capitalize(replace(
        public.personal_insights_pair_text('similar', c_traits[t], '', ''), '{name}', p_name));
      v_used := v_used || t;
    end if;
  end loop;

  -- 4. Cross-trait complement: optional 3rd strength, on two traits not used yet.
  if cardinality(v_strengths) = 2 then
    for k in 1..cardinality(c_cross_a) loop
      a := c_cross_a[k];
      b := c_cross_b[k];
      continue when a = any (v_used) or b = any (v_used);
      v_cross_direction := null;
      if v_them[a] >= c_level_high and v_me[a] < c_level_high and v_them[a] - v_me[a] >= c_cross_gap
        and v_me[b] >= c_level_high and v_them[b] < c_level_high and v_me[b] - v_them[b] >= c_cross_gap then
        v_cross_direction := 'they_first';
        v_cross_value := v_them[a] - v_me[a] + v_me[b] - v_them[b];
      elsif v_me[a] >= c_level_high and v_them[a] < c_level_high and v_me[a] - v_them[a] >= c_cross_gap
        and v_them[b] >= c_level_high and v_me[b] < c_level_high and v_them[b] - v_me[b] >= c_cross_gap then
        v_cross_direction := 'you_first';
        v_cross_value := v_me[a] - v_them[a] + v_them[b] - v_me[b];
      end if;
      if v_cross_direction is not null and (v_best_key is null or v_cross_value > v_best_value) then
        v_best_key := c_traits[a] || '+' || c_traits[b];
        v_best_direction := v_cross_direction;
        v_best_value := v_cross_value;
      end if;
    end loop;
    if v_best_key is not null then
      v_strengths := v_strengths || public.personal_insights_capitalize(replace(
        public.personal_insights_pair_text('cross', v_best_key, v_best_direction, p_relationship_type), '{name}', p_name));
    end if;
  end if;

  -- 5. Tips (about them): top trait, biggest gap, then by stand-out; challenge traits skipped
  -- unless fewer than 3 traits are left.
  select array_agg(g.i order by abs(v_them[g.i] - 500) desc, g.i) into v_ordered
  from generate_series(1, 5) as g (i);
  select array_agg(g.i order by abs(v_them[g.i] - v_me[g.i]) desc, g.i) into v_by_gap
  from generate_series(1, 5) as g (i);

  foreach t in array v_ordered loop
    if not (t = any (v_challenge_traits)) then
      v_tip_traits := v_tip_traits || t;
      exit;
    end if;
  end loop;
  foreach t in array v_by_gap loop
    if not (t = any (v_challenge_traits)) and not (t = any (v_tip_traits)) then
      v_tip_traits := v_tip_traits || t;
      exit;
    end if;
  end loop;
  foreach t in array v_ordered loop
    exit when cardinality(v_tip_traits) >= 3;
    if not (t = any (v_challenge_traits)) and not (t = any (v_tip_traits)) then
      v_tip_traits := v_tip_traits || t;
    end if;
  end loop;
  foreach t in array v_ordered loop
    exit when cardinality(v_tip_traits) >= 3;
    if not (t = any (v_tip_traits)) then
      v_tip_traits := v_tip_traits || t;
    end if;
  end loop;
  foreach t in array v_tip_traits loop
    v_level := case when v_them[t] >= c_level_high then 'high' when v_them[t] < c_level_low then 'low' else 'medium' end;
    v_tips := v_tips || public.personal_insights_capitalize(replace(
      public.personal_insights_trait_text(c_traits[t], v_level, p_relationship_type, 'tip'), '{name}', p_name));
  end loop;

  -- 6. Card 1 (them): their 1-2 stand-out traits.
  v_label := public.personal_insights_capitalize(
    replace(public.personal_insights_pair_text('label', '', '', p_relationship_type), '{name}', p_name)
  );
  select array_agg(s.i order by s.n) into v_card
  from (
    select g.i, row_number() over (order by abs(v_them[g.i] - 500) desc, g.i) as n
    from generate_series(1, 5) as g (i)
  ) s
  where s.n <= 2 and abs(v_them[s.i] - 500) >= c_stand_out;

  if v_card is null then
    v_their_who := v_label || ' ' || public.personal_insights_pair_text('balanced', '', '', p_relationship_type) || '.';
  else
    t := v_card[1];
    v_level := case when v_them[t] >= c_level_high then 'high' when v_them[t] < c_level_low then 'low' else 'medium' end;
    v_their_who := v_label || ' ' || public.personal_insights_trait_text(c_traits[t], v_level, p_relationship_type, 'who') || '.';
    if cardinality(v_card) > 1 then
      t := v_card[2];
      v_level := case when v_them[t] >= c_level_high then 'high' when v_them[t] < c_level_low then 'low' else 'medium' end;
      -- Sentence 2 starts with "They" (plural form), so the name isn't repeated.
      v_their_who := v_their_who || ' ' || public.personal_insights_trait_text(c_traits[t], v_level, p_relationship_type, 'who_they') || '.';
    end if;
  end if;

  -- 7. Card 2 (you): your 1-2 stand-out traits.
  select array_agg(s.i order by s.n) into v_card
  from (
    select g.i, row_number() over (order by abs(v_me[g.i] - 500) desc, g.i) as n
    from generate_series(1, 5) as g (i)
  ) s
  where s.n <= 2 and abs(v_me[s.i] - 500) >= c_stand_out;

  if v_card is null then
    v_your_who := public.personal_insights_pair_text('you_balanced', '', '', p_relationship_type);
  else
    t := v_card[1];
    v_level := case when v_me[t] >= c_level_high then 'high' when v_me[t] < c_level_low then 'low' else 'medium' end;
    v_your_who := public.personal_insights_trait_text(c_traits[t], v_level, p_relationship_type, 'you');
    if cardinality(v_card) > 1 then
      t := v_card[2];
      v_level := case when v_me[t] >= c_level_high then 'high' when v_me[t] < c_level_low then 'low' else 'medium' end;
      v_your_who := v_your_who || ' ' || public.personal_insights_trait_text(c_traits[t], v_level, p_relationship_type, 'you_also');
    end if;
  end if;

  return jsonb_build_object(
    'version', c_version,
    'them', jsonb_build_object('name', p_name, 'who', v_their_who),
    'you', jsonb_build_object('who', v_your_who),
    'strengths', to_jsonb(v_strengths),
    'challenges', to_jsonb(v_challenges),
    'tips', to_jsonb(v_tips)
  );
end;
$$;

comment on function public.get_personal_insights(bigint) is
  'Personal + pair insights for one of the caller''s matches: finished texts only (them { name, who }, you { who }, strengths, challenges, tips). Null if either person has no quiz result.';

-------------------------------------------------------------------------------
-- 3. Execute rights (create or replace keeps them; restated so this file is safe alone)
-------------------------------------------------------------------------------

revoke execute on function public.personal_insights_build(jsonb, jsonb, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_personal_insights(bigint) from public, anon;
grant execute on function public.get_personal_insights(bigint) to authenticated;

commit;
