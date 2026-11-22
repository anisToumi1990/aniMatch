-- Personal insights: "Who they are" no longer repeats the name in its 2nd sentence.
-- Sentence 2 now uses a plural "They …" form of the trait text (section 'who_they'),
-- e.g. "Your partner Sam recharges around people … They're also warm, caring …".
--
-- Replaces personal_insights_build() from 20261122120000_personal_insights.sql (only the
-- "Who they are" sentence 2 changes) and allows the new section in the content table.
--
-- Run in the Supabase SQL editor, in this order:
--   1. this file
--   2. 20261122130100_personal_insights_seed.sql  (generated: the library, now with who_they)
--   3. 20261122130200_personal_insights_check.sql (generated: read-only fixture check)
-- Between steps 1 and 2 the RPC fails for matches whose "Who they are" has 2 sentences
-- (the 'who_they' rows don't exist yet), so run 1 and 2 back to back.

begin;

alter table public.personal_insight_trait_texts
  drop constraint if exists personal_insight_trait_texts_section_check;
alter table public.personal_insight_trait_texts
  add constraint personal_insight_trait_texts_section_check
    check (section in ('who', 'who_they', 'strength', 'challenge', 'tip'));

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
  c_version constant integer := 1; -- library.json "version"
  c_traits constant text[] := array['social', 'curiosity', 'organization', 'kindness', 'chill'];
  c_areas constant text[] := array['communication', 'energy', 'conflict', 'values'];
  -- Thresholds in tenths of a point (library.json levels + PERSONAL_INSIGHTS_RULES).
  c_level_high constant integer := 600;
  c_level_low constant integer := 400;
  c_stand_out constant integer := 100;
  c_second_challenge constant integer := 500; -- doubled score: 2 x stand-out + |gap| >= 2 x 25
  c_big_gap constant integer := 200;
  c_weak_area constant integer := 550;
  c_strong_area constant integer := 700;

  v_levels jsonb;
  v_ordered text[];
  v_ordered_values integer[];
  v_by_gap text[];
  v_by_gap_values integer[];
  v_by_gap_signed integer[];
  v_challenge_order text[];
  v_challenge_values integer[];
  v_strength_traits text[];
  v_challenge_traits text[];
  v_tip_traits text[];
  v_trait text;
  v_label text;
  v_who text;
  v_strengths text[] := array[]::text[];
  v_challenges text[] := array[]::text[];
  v_tips text[] := array[]::text[];
  v_pair text;
  v_weak_area text;
  v_weak_value integer;
  v_strong_area text;
  v_strong_value integer;
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

  -- Their level per trait.
  select jsonb_object_agg(s.trait, case
           when s.them >= c_level_high then 'high'
           when s.them < c_level_low then 'low'
           else 'medium'
         end)
  into v_levels
  from (
    select u.trait, round((p_them ->> u.trait)::numeric * 10)::integer as them
    from unnest(c_traits) as u (trait)
  ) s;

  -- Traits by stand-out (|them - 50|), by gap (|them - me|) and by challenge score.
  select
    array_agg(s.trait order by s.stand_out desc, s.idx),
    array_agg(s.stand_out order by s.stand_out desc, s.idx),
    array_agg(s.trait order by abs(s.gap) desc, s.idx),
    array_agg(abs(s.gap) order by abs(s.gap) desc, s.idx),
    array_agg(s.gap order by abs(s.gap) desc, s.idx),
    array_agg(s.trait order by 2 * s.stand_out + abs(s.gap) desc, s.idx),
    array_agg(2 * s.stand_out + abs(s.gap) order by 2 * s.stand_out + abs(s.gap) desc, s.idx)
  into v_ordered, v_ordered_values, v_by_gap, v_by_gap_values, v_by_gap_signed, v_challenge_order, v_challenge_values
  from (
    select
      u.trait,
      u.idx,
      abs(round((p_them ->> u.trait)::numeric * 10)::integer - 500) as stand_out,
      round((p_them ->> u.trait)::numeric * 10)::integer - round((p_me ->> u.trait)::numeric * 10)::integer as gap
    from unnest(c_traits) with ordinality as u (trait, idx)
  ) s;

  v_label := public.personal_insights_capitalize(
    replace(public.personal_insights_pair_text('label', '', '', p_relationship_type), '{name}', p_name)
  );

  -- 1. Who they are.
  if v_ordered_values[1] < c_stand_out then
    v_who := v_label || ' ' || public.personal_insights_pair_text('balanced', '', '', p_relationship_type) || '.';
  else
    v_who := v_label || ' '
      || public.personal_insights_trait_text(v_ordered[1], v_levels ->> v_ordered[1], p_relationship_type, 'who') || '.';
    if v_ordered_values[2] >= c_stand_out then
      -- Sentence 2 starts with "They" (plural form), so the name isn't repeated.
      v_who := v_who || ' '
        || public.personal_insights_trait_text(v_ordered[2], v_levels ->> v_ordered[2], p_relationship_type, 'who_they') || '.';
    end if;
  end if;

  -- 2. Strengths: top 2 traits, plus the 3rd if it stands out.
  v_strength_traits := v_ordered[1:2];
  if v_ordered_values[3] >= c_stand_out then
    v_strength_traits := v_strength_traits || v_ordered[3];
  end if;
  foreach v_trait in array v_strength_traits loop
    v_strengths := v_strengths || public.personal_insights_capitalize(replace(
      public.personal_insights_trait_text(v_trait, v_levels ->> v_trait, p_relationship_type, 'strength'), '{name}', p_name));
  end loop;

  -- 3. Challenges: highest stand-out + 0.5 x |gap|, plus the 2nd if it scores >= 25.
  v_challenge_traits := array[v_challenge_order[1]];
  if v_challenge_values[2] >= c_second_challenge then
    v_challenge_traits := v_challenge_traits || v_challenge_order[2];
  end if;
  foreach v_trait in array v_challenge_traits loop
    v_challenges := v_challenges || public.personal_insights_capitalize(replace(
      public.personal_insights_trait_text(v_trait, v_levels ->> v_trait, p_relationship_type, 'challenge'), '{name}', p_name));
  end loop;

  -- 4. Tips: their top trait, then the biggest gap not used yet, then the first
  -- challenge not used yet, then the next traits by stand-out. Always 3 different traits.
  v_tip_traits := array[v_ordered[1]];
  foreach v_trait in array v_by_gap loop
    if not (v_trait = any (v_tip_traits)) then
      v_tip_traits := v_tip_traits || v_trait;
      exit;
    end if;
  end loop;
  if cardinality(v_tip_traits) < 3 then
    foreach v_trait in array v_challenge_traits loop
      if not (v_trait = any (v_tip_traits)) then
        v_tip_traits := v_tip_traits || v_trait;
        exit;
      end if;
    end loop;
  end if;
  foreach v_trait in array v_ordered loop
    exit when cardinality(v_tip_traits) >= 3;
    if not (v_trait = any (v_tip_traits)) then
      v_tip_traits := v_tip_traits || v_trait;
    end if;
  end loop;
  foreach v_trait in array v_tip_traits loop
    v_tips := v_tips || public.personal_insights_capitalize(replace(
      public.personal_insights_trait_text(v_trait, v_levels ->> v_trait, p_relationship_type, 'tip'), '{name}', p_name));
  end loop;

  -- 5. Your pair: biggest gap >= 20 -> difference text, else the closest trait's "similar" text.
  if v_by_gap_values[1] >= c_big_gap then
    v_pair := public.personal_insights_capitalize(replace(public.personal_insights_pair_text(
      'difference',
      v_by_gap[1],
      case when v_by_gap_signed[1] > 0 then 'they_higher' else 'you_higher' end,
      p_relationship_type
    ), '{name}', p_name));
  else
    v_pair := public.personal_insights_capitalize(replace(
      public.personal_insights_pair_text('similar', v_by_gap[cardinality(v_by_gap)], '', ''), '{name}', p_name));
  end if;

  -- Then: weakest area < 55 -> its advice; else strongest >= 70 -> its text; else nothing.
  if p_areas is not null and jsonb_typeof(p_areas) = 'object' and not exists (
    select 1 from unnest(c_areas) as u (area) where coalesce(jsonb_typeof(p_areas -> u.area), '') <> 'number'
  ) then
    select u.area, round((p_areas ->> u.area)::numeric * 10)::integer
    into v_weak_area, v_weak_value
    from unnest(c_areas) with ordinality as u (area, idx)
    order by round((p_areas ->> u.area)::numeric * 10) asc, u.idx
    limit 1;

    select u.area, round((p_areas ->> u.area)::numeric * 10)::integer
    into v_strong_area, v_strong_value
    from unnest(c_areas) with ordinality as u (area, idx)
    order by round((p_areas ->> u.area)::numeric * 10) desc, u.idx
    limit 1;

    if v_weak_value < c_weak_area then
      v_pair := v_pair || ' ' || public.personal_insights_pair_text('area', v_weak_area, 'weak', p_relationship_type);
    elsif v_strong_value >= c_strong_area then
      v_pair := v_pair || ' ' || public.personal_insights_pair_text('area', v_strong_area, 'strong', p_relationship_type);
    end if;
  end if;

  return jsonb_build_object(
    'version', c_version,
    'who', v_who,
    'strengths', to_jsonb(v_strengths),
    'challenges', to_jsonb(v_challenges),
    'tips', to_jsonb(v_tips),
    'pair', v_pair
  );
end;
$$;

-- create or replace keeps existing privileges; restated so this file stands on its own.
revoke execute on function public.personal_insights_build(jsonb, jsonb, text, text, jsonb) from public, anon, authenticated;

commit;
