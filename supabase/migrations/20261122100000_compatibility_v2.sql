-- Compatibility v2 (trait-based), part 1: schema, settings and the internal functions.
-- See docs/compatibility-v2-proposal.md. Reference implementation: lib/compatibilityV2.ts.
--
-- Only additions here: nothing the app uses changes yet, so this is safe to run on its own.
--   compatibility_results:      + 4 area scores and compatibility_version (1 = old, 2 = v2)
--   compatibility_v2_settings:  weights and calibration per relationship type (no client access)
--   compatibility_v2_traits():  a user's 5 traits (v2 result, else their animal's profile)
--   compatibility_v2_scores():  area and overall scores for two trait sets
-- Both functions are internal: no execute for public / anon / authenticated.
--
-- Run in the Supabase SQL editor, then 20261122100100_compatibility_v2_check.sql,
-- then 20261122100200_compatibility_v2_rollout.sql.

begin;

-------------------------------------------------------------------------------
-- 1. compatibility_results: area scores and version
-------------------------------------------------------------------------------

alter table public.compatibility_results
  add column if not exists communication_score smallint check (communication_score between 0 and 100),
  add column if not exists energy_score smallint check (energy_score between 0 and 100),
  add column if not exists conflict_score smallint check (conflict_score between 0 and 100),
  add column if not exists values_score smallint check (values_score between 0 and 100),
  add column if not exists compatibility_version smallint not null default 1;

alter table public.compatibility_results
  drop constraint if exists compatibility_results_compatibility_version_check;
alter table public.compatibility_results
  add constraint compatibility_results_compatibility_version_check check (compatibility_version in (1, 2));

comment on column public.compatibility_results.compatibility_version is
  '1 = animal_compatibility table, 2 = trait-based (compatibility_v2_scores). compatibility_score is the overall score in both.';
comment on column public.compatibility_results.conflict_score is
  'Compatibility v2: how well the pair handles conflict (high = good).';

-------------------------------------------------------------------------------
-- 2. compatibility_v2_settings: one row per relationship type
-------------------------------------------------------------------------------

create table if not exists public.compatibility_v2_settings (
  relationship_type text primary key check (relationship_type in ('lover', 'business_partner', 'family')),
  -- Area weights in the overall score (sum to 1).
  weight_communication double precision not null,
  weight_energy double precision not null,
  weight_conflict double precision not null,
  weight_values double precision not null,
  -- Area calibration: area = clamp(area_target + (raw - center) * stretch, 0, 100).
  area_target double precision not null,
  communication_center double precision not null,
  communication_stretch double precision not null,
  energy_center double precision not null,
  energy_stretch double precision not null,
  conflict_center double precision not null,
  conflict_stretch double precision not null,
  values_center double precision not null,
  values_stretch double precision not null,
  -- Overall S-curve: 100 / (1 + exp(-(mid + slope * (weighted average - center)))),
  -- mid = (logit(p5 / 100) + logit(p95 / 100)) / 2.
  overall_center double precision not null,
  overall_slope double precision not null,
  overall_p5 double precision not null check (overall_p5 > 0 and overall_p5 < 100),
  overall_p95 double precision not null check (overall_p95 > 0 and overall_p95 < 100),
  updated_at timestamptz not null default now(),
  constraint compatibility_v2_settings_weights_sum check (
    abs(weight_communication + weight_energy + weight_conflict + weight_values - 1) < 0.0001
  )
);

comment on table public.compatibility_v2_settings is
  'Compatibility v2 tuning (scripts/compatibility-v2-simulation.js --calibrate). Read only by compatibility_v2_scores(). Keep lib/compatibilityV2.ts defaults in sync.';

alter table public.compatibility_v2_settings enable row level security;
-- No policies: clients can't read or write it.
revoke all on public.compatibility_v2_settings from anon, authenticated;

insert into public.compatibility_v2_settings (
  relationship_type,
  weight_communication, weight_energy, weight_conflict, weight_values,
  area_target,
  communication_center, communication_stretch,
  energy_center, energy_stretch,
  conflict_center, conflict_stretch,
  values_center, values_stretch,
  overall_center, overall_slope, overall_p5, overall_p95
)
values
  ('lover',            0.30, 0.30, 0.25, 0.15, 62, 65, 1.88, 78, 1.77, 54, 2.08, 66, 2.08, 61.5, 0.072, 28, 90),
  ('business_partner', 0.25, 0.10, 0.20, 0.45, 62, 65, 1.88, 78, 1.77, 54, 2.08, 66, 2.08, 61.8, 0.073, 28, 90),
  ('family',           0.20, 0.05, 0.45, 0.30, 62, 65, 1.88, 78, 1.77, 54, 2.08, 66, 2.08, 62.0, 0.071, 28, 90)
on conflict (relationship_type) do update set
  weight_communication = excluded.weight_communication,
  weight_energy = excluded.weight_energy,
  weight_conflict = excluded.weight_conflict,
  weight_values = excluded.weight_values,
  area_target = excluded.area_target,
  communication_center = excluded.communication_center,
  communication_stretch = excluded.communication_stretch,
  energy_center = excluded.energy_center,
  energy_stretch = excluded.energy_stretch,
  conflict_center = excluded.conflict_center,
  conflict_stretch = excluded.conflict_stretch,
  values_center = excluded.values_center,
  values_stretch = excluded.values_stretch,
  overall_center = excluded.overall_center,
  overall_slope = excluded.overall_slope,
  overall_p5 = excluded.overall_p5,
  overall_p95 = excluded.overall_p95,
  updated_at = now();

-------------------------------------------------------------------------------
-- 3. compatibility_v2_traits(user): latest v2 trait_scores, else the animal's profile
-------------------------------------------------------------------------------

create or replace function public.compatibility_v2_traits(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result record;
  v_traits jsonb;
begin
  select r.aura_id, r.quiz_version, r.trait_scores
  into v_result
  from public.user_quiz_results r
  where r.user_id = p_user_id and r.aura_id is not null
  order by r.quiz_date desc
  limit 1;

  if not found then
    return null; -- no quiz yet
  end if;

  if v_result.quiz_version = 2 and v_result.trait_scores is not null then
    return v_result.trait_scores;
  end if;

  -- v1 result: the animal's profile as-is.
  select jsonb_build_object(
    'social', p.social,
    'curiosity', p.curiosity,
    'organization', p.organization,
    'kindness', p.kindness,
    'chill', p.chill
  )
  into v_traits
  from public.animal_trait_profiles p
  where p.aura_id = v_result.aura_id;

  return v_traits; -- null if the aura has no profile
end;
$$;

comment on function public.compatibility_v2_traits(uuid) is
  'Internal (no client execute): a user''s 5 traits for compatibility v2. Latest v2 trait_scores, else their animal''s animal_trait_profiles row, else null.';

-------------------------------------------------------------------------------
-- 4. compatibility_v2_scores(a, b, type): area and overall scores (unrounded)
--    Same formulas as lib/compatibilityV2.ts:
--      sim(t)  = 100 - |a.t - b.t|
--      both(t) = 0.5 * (a.t + b.t) / 2 + 0.5 * least(a.t, b.t)
-------------------------------------------------------------------------------

create or replace function public.compatibility_v2_scores(p_a jsonb, p_b jsonb, p_relationship_type text)
returns table (
  out_communication double precision,
  out_energy double precision,
  out_conflict double precision,
  out_values double precision,
  out_overall double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.compatibility_v2_settings%rowtype;
  a_social double precision := (p_a ->> 'social')::double precision;
  a_curiosity double precision := (p_a ->> 'curiosity')::double precision;
  a_organization double precision := (p_a ->> 'organization')::double precision;
  a_kindness double precision := (p_a ->> 'kindness')::double precision;
  a_chill double precision := (p_a ->> 'chill')::double precision;
  b_social double precision := (p_b ->> 'social')::double precision;
  b_curiosity double precision := (p_b ->> 'curiosity')::double precision;
  b_organization double precision := (p_b ->> 'organization')::double precision;
  b_kindness double precision := (p_b ->> 'kindness')::double precision;
  b_chill double precision := (p_b ->> 'chill')::double precision;
  sim_social double precision;
  sim_curiosity double precision;
  sim_organization double precision;
  sim_kindness double precision;
  sim_chill double precision;
  both_organization double precision;
  both_kindness double precision;
  both_chill double precision;
  raw_communication double precision;
  raw_energy double precision;
  raw_conflict double precision;
  raw_values double precision;
  v_average double precision;
  v_mid double precision;
begin
  -- Unknown relationship type: no score (callers keep the row as it is), never an error,
  -- so one odd row can't abort a backfill.
  select * into s from public.compatibility_v2_settings where relationship_type = p_relationship_type;
  if not found then
    return;
  end if;

  -- Missing traits: no score (callers keep the row as it is).
  if a_social is null or a_curiosity is null or a_organization is null or a_kindness is null or a_chill is null
    or b_social is null or b_curiosity is null or b_organization is null or b_kindness is null or b_chill is null
  then
    return;
  end if;

  sim_social := 100 - abs(a_social - b_social);
  sim_curiosity := 100 - abs(a_curiosity - b_curiosity);
  sim_organization := 100 - abs(a_organization - b_organization);
  sim_kindness := 100 - abs(a_kindness - b_kindness);
  sim_chill := 100 - abs(a_chill - b_chill);
  both_organization := 0.5 * ((a_organization + b_organization) / 2) + 0.5 * least(a_organization, b_organization);
  both_kindness := 0.5 * ((a_kindness + b_kindness) / 2) + 0.5 * least(a_kindness, b_kindness);
  both_chill := 0.5 * ((a_chill + b_chill) / 2) + 0.5 * least(a_chill, b_chill);

  -- Same term order as AREA_TERMS in lib/compatibilityV2.ts (keeps float results identical).
  raw_communication := 0 + 0.35 * sim_social + 0.25 * sim_curiosity + 0.4 * both_kindness;
  raw_energy := 0 + 0.45 * sim_social + 0.35 * sim_curiosity + 0.2 * sim_chill;
  raw_conflict := 0 + 0.4 * both_chill + 0.35 * both_kindness + 0.25 * sim_organization;
  raw_values := 0 + 0.35 * both_organization + 0.2 * sim_organization + 0.25 * sim_curiosity + 0.2 * sim_kindness;

  out_communication := greatest(0, least(100, s.area_target + (raw_communication - s.communication_center) * s.communication_stretch));
  out_energy := greatest(0, least(100, s.area_target + (raw_energy - s.energy_center) * s.energy_stretch));
  out_conflict := greatest(0, least(100, s.area_target + (raw_conflict - s.conflict_center) * s.conflict_stretch));
  out_values := greatest(0, least(100, s.area_target + (raw_values - s.values_center) * s.values_stretch));

  v_average := 0 + s.weight_communication * out_communication + s.weight_energy * out_energy
    + s.weight_conflict * out_conflict + s.weight_values * out_values;
  v_mid := (ln((s.overall_p5 / 100) / (1 - s.overall_p5 / 100)) + ln((s.overall_p95 / 100) / (1 - s.overall_p95 / 100))) / 2;
  out_overall := 100 / (1 + exp(-(v_mid + s.overall_slope * (v_average - s.overall_center))));

  return next;
end;
$$;

comment on function public.compatibility_v2_scores(jsonb, jsonb, text) is
  'Internal (no client execute): compatibility v2 area and overall scores, unrounded. Store with round(x::numeric). Mirrors lib/compatibilityV2.ts.';

-- Internal only: the RPCs (part 3) call these as their owner.
revoke execute on function public.compatibility_v2_traits(uuid) from public, anon, authenticated;
revoke execute on function public.compatibility_v2_scores(jsonb, jsonb, text) from public, anon, authenticated;

commit;
