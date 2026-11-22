-- Personal insights (docs/personal-insights-proposal.md): texts about the other
-- person in a match, from the caller's point of view, built from both people's
-- traits, the relationship type and the stored area scores.
--
-- Replaces compatibility_insight_templates on the match detail screen
-- (that table stays in the database; the app no longer reads it).
--
-- Run in the Supabase SQL editor, in this order:
--   1. this file (tables + functions)
--   2. 20261122130000_personal_insights_who_they.sql (adds the "They" sentence-2 texts,
--      replaces personal_insights_build())
--   3. 20261122130100_personal_insights_seed.sql  (generated: the content library)
--   4. 20261122130200_personal_insights_check.sql (generated: read-only fixture check)
--
-- Security:
--   - Content tables: RLS on, no policies, no grants: clients can't read them.
--   - personal_insights_build() and the text helpers: no client execute.
--   - get_personal_insights(result_id): the only client entry point. SECURITY DEFINER,
--     search_path = public, caller must be user_a or user_b of the result, and it
--     returns finished texts only (never trait scores, levels or trait names).

begin;

-------------------------------------------------------------------------------
-- 1. Content tables (filled by the generated seed)
-------------------------------------------------------------------------------

create table if not exists public.personal_insight_trait_texts (
  trait text not null check (trait in ('social', 'curiosity', 'organization', 'kindness', 'chill')),
  level text not null check (level in ('high', 'medium', 'low')),
  relationship_type text not null check (relationship_type in ('lover', 'business_partner', 'family')),
  section text not null check (section in ('who', 'strength', 'challenge', 'tip')),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  primary key (trait, level, relationship_type, section)
);

comment on table public.personal_insight_trait_texts is
  'Personal insights: one text per trait x level x relationship type x section. Source: supabase/content/personal-insights/library.json.';

-- '' means "not applicable" (keeps the primary key simple):
--   label      key ''      variant ''                         relationship_type = type
--   balanced   key ''      variant ''                         relationship_type = type
--   difference key trait   variant they_higher | you_higher   relationship_type = type
--   similar    key trait   variant ''                         relationship_type ''
--   area       key area    variant strong | weak              relationship_type = type
create table if not exists public.personal_insight_pair_texts (
  kind text not null check (kind in ('label', 'balanced', 'difference', 'similar', 'area')),
  key text not null default '',
  variant text not null default '',
  relationship_type text not null default '' check (relationship_type in ('', 'lover', 'business_partner', 'family')),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  primary key (kind, key, variant, relationship_type)
);

comment on table public.personal_insight_pair_texts is
  'Personal insights: labels, fallbacks, difference / similar / area texts. Source: supabase/content/personal-insights/library.json.';

alter table public.personal_insight_trait_texts enable row level security;
alter table public.personal_insight_pair_texts enable row level security;
-- No policies on purpose: only the SECURITY DEFINER functions below read these tables.
revoke all on public.personal_insight_trait_texts from public, anon, authenticated;
revoke all on public.personal_insight_pair_texts from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 2. Internal helpers (no client execute)
-------------------------------------------------------------------------------

-- First letter upper-cased, rest unchanged (same as capitalizeFirst in lib/personalInsights.ts).
create or replace function public.personal_insights_capitalize(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(left(p_text, 1)) || substr(p_text, 2);
$$;

create or replace function public.personal_insights_trait_text(p_trait text, p_level text, p_relationship_type text, p_section text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_text text;
begin
  select t.text into v_text
  from public.personal_insight_trait_texts t
  where t.trait = p_trait and t.level = p_level and t.relationship_type = p_relationship_type and t.section = p_section;
  if v_text is null then
    raise exception 'personal insights: missing text %/%/%/%', p_trait, p_level, p_relationship_type, p_section;
  end if;
  return v_text;
end;
$$;

create or replace function public.personal_insights_pair_text(p_kind text, p_key text, p_variant text, p_relationship_type text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_text text;
begin
  select t.text into v_text
  from public.personal_insight_pair_texts t
  where t.kind = p_kind and t.key = p_key and t.variant = p_variant and t.relationship_type = p_relationship_type;
  if v_text is null then
    raise exception 'personal insights: missing pair text %/%/%/%', p_kind, p_key, p_variant, p_relationship_type;
  end if;
  return v_text;
end;
$$;

-------------------------------------------------------------------------------
-- 3. personal_insights_build(): the selection rules (doc section 3)
--
-- Same rules as buildPersonalInsights() in lib/personalInsights.ts and buildInsights()
-- in scripts/personal-insights-preview.js; 20261122130200_personal_insights_check.sql
-- compares this function with the shared fixture.
--
-- All scores are compared in tenths of a point (integers). Ties: trait order
-- social, curiosity, organization, kindness, chill; area order communication,
-- energy, conflict, values. Returns null if an input is missing.
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
      v_who := v_who || ' ' || public.personal_insights_capitalize(
        p_name || ' ' || public.personal_insights_trait_text(v_ordered[2], v_levels ->> v_ordered[2], p_relationship_type, 'who')
      ) || '.';
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

-------------------------------------------------------------------------------
-- 4. get_personal_insights(result_id): the client RPC
-------------------------------------------------------------------------------

create or replace function public.get_personal_insights(p_result_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_other uuid;
  v_me jsonb;
  v_them jsonb;
  v_areas jsonb;
begin
  -- Signed-in callers only, and only for their own matches. A missing row gets the
  -- same error, so the RPC can't be used to probe which result ids exist.
  if v_uid is null then
    raise exception 'Not allowed to read personal insights' using errcode = '42501';
  end if;

  select r.user_a_id, r.user_b_id, r.relationship_type, r.compatibility_version,
         r.communication_score, r.energy_score, r.conflict_score, r.values_score
  into v_row
  from public.compatibility_results r
  where r.id = p_result_id;

  if not found or v_uid is distinct from v_row.user_a_id and v_uid is distinct from v_row.user_b_id then
    raise exception 'Not allowed to read personal insights' using errcode = '42501';
  end if;

  v_other := case when v_row.user_a_id = v_uid then v_row.user_b_id else v_row.user_a_id end;

  -- Latest v2 trait_scores, else the animal's profile (same rule as the scores).
  v_me := public.compatibility_v2_traits(v_uid);
  v_them := public.compatibility_v2_traits(v_other);
  if v_me is null or v_them is null then
    return null;
  end if;

  -- v1 rows have no area scores: the "Your pair" area sentence is skipped.
  if v_row.compatibility_version = 2
    and v_row.communication_score is not null and v_row.energy_score is not null
    and v_row.conflict_score is not null and v_row.values_score is not null then
    v_areas := jsonb_build_object(
      'communication', v_row.communication_score,
      'energy', v_row.energy_score,
      'conflict', v_row.conflict_score,
      'values', v_row.values_score
    );
  end if;

  -- Finished texts only: no scores, levels or trait names leave this function.
  return public.personal_insights_build(
    v_me, v_them, v_row.relationship_type, public.notification_first_name(v_other), v_areas
  );
end;
$$;

comment on function public.get_personal_insights(bigint) is
  'Personal insights for one of the caller''s matches: finished texts about the other person (who, strengths, challenges, tips, pair). Null if either person has no quiz result.';

-------------------------------------------------------------------------------
-- 5. Execute rights
-------------------------------------------------------------------------------

revoke execute on function public.personal_insights_capitalize(text) from public, anon, authenticated;
revoke execute on function public.personal_insights_trait_text(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.personal_insights_pair_text(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.personal_insights_build(jsonb, jsonb, text, text, jsonb) from public, anon, authenticated;

revoke execute on function public.get_personal_insights(bigint) from public, anon;
grant execute on function public.get_personal_insights(bigint) to authenticated;

commit;
