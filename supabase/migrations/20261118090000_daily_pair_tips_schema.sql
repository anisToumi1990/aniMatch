-- Daily pair tips ("Today with your matches" on Home), content stored in Supabase.
--
-- Same pattern as daily_aura_messages: one row per (aura, season, day), where
-- aura_id is the OTHER person's animal. The tip text may contain {name}, which
-- the app replaces with that person's first name.
--
-- Seasons reuse public.daily_aura_settings (current_season, season_start_date):
-- a content drop for season N should include pair tips for season N too.
--
-- Run in the Supabase SQL editor, before 20261118090100_daily_pair_tips_season1_seed.sql.
-- Requires 20261117090000_daily_aura_schema.sql (daily_aura_settings).

begin;

create table if not exists public.daily_pair_tips (
  id bigint generated always as identity primary key,
  aura_id bigint not null references public.animal_auras (id) on delete cascade,
  season integer not null default 1 check (season >= 1),
  day_index integer not null check (day_index >= 1),
  tip text not null check (char_length(btrim(tip)) between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint daily_pair_tips_aura_season_day_key unique (aura_id, season, day_index)
);

comment on table public.daily_pair_tips is
  'Daily tip for dealing with someone of this animal (aura_id = the other person''s aura). {name} = their first name. Day N of a season shows the Nth active row by day_index (lib/dailyAuraSchedule.ts).';

-- The unique constraint's index (aura_id, season, day_index) also serves the app's
-- lookup: where aura_id in (...) and season = ? and is_active order by aura_id, day_index.

alter table public.daily_pair_tips enable row level security;

drop policy if exists "Authenticated users can read active daily pair tips" on public.daily_pair_tips;
create policy "Authenticated users can read active daily pair tips"
  on public.daily_pair_tips for select
  to authenticated
  using (is_active);

revoke all on public.daily_pair_tips from anon, authenticated;
grant select on public.daily_pair_tips to authenticated;

commit;
