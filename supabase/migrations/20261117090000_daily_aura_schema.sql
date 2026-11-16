-- Daily aura messages (Home card), content stored in Supabase.
--
-- daily_aura_messages: one row per (aura, season, day). The app shows the
--   Nth active message of the current season on day N (see lib/dailyAuraSchedule.ts).
-- daily_aura_settings: one row with the current season and its start date.
--
-- Content drop (no app release): insert the new season's rows, then
--   update public.daily_aura_settings set current_season = 2, season_start_date = '<launch date>';
--
-- Run in the Supabase SQL editor, before 20261117090100_daily_aura_season1_seed.sql.

begin;

-------------------------------------------------------------------------------
-- 1. daily_aura_messages
-------------------------------------------------------------------------------

create table if not exists public.daily_aura_messages (
  id bigint generated always as identity primary key,
  aura_id bigint not null references public.animal_auras (id) on delete cascade,
  season integer not null default 1 check (season >= 1),
  day_index integer not null check (day_index >= 1),
  message text not null check (char_length(btrim(message)) between 1 and 200),
  do_text text not null check (char_length(btrim(do_text)) between 1 and 80),
  dont_text text not null check (char_length(btrim(dont_text)) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint daily_aura_messages_aura_season_day_key unique (aura_id, season, day_index)
);

comment on table public.daily_aura_messages is
  'Daily aura message per animal. Day N of a season shows the Nth active row by day_index (lib/dailyAuraSchedule.ts).';

-- The unique constraint's index (aura_id, season, day_index) also serves the app's
-- lookup: where aura_id = ? and season = ? and is_active order by day_index.

alter table public.daily_aura_messages enable row level security;

drop policy if exists "Authenticated users can read active daily aura messages" on public.daily_aura_messages;
create policy "Authenticated users can read active daily aura messages"
  on public.daily_aura_messages for select
  to authenticated
  using (is_active);

revoke all on public.daily_aura_messages from anon, authenticated;
grant select on public.daily_aura_messages to authenticated;

-------------------------------------------------------------------------------
-- 2. daily_aura_settings (exactly one row)
-------------------------------------------------------------------------------

create table if not exists public.daily_aura_settings (
  id boolean primary key default true check (id), -- only one row can exist
  current_season integer not null default 1 check (current_season >= 1),
  season_start_date date not null default current_date,
  updated_at timestamptz not null default now()
);

comment on table public.daily_aura_settings is
  'Single row: the live season and the date its day 1 falls on. Update both together for a content drop.';

alter table public.daily_aura_settings enable row level security;

drop policy if exists "Authenticated users can read daily aura settings" on public.daily_aura_settings;
create policy "Authenticated users can read daily aura settings"
  on public.daily_aura_settings for select
  to authenticated
  using (true);

revoke all on public.daily_aura_settings from anon, authenticated;
grant select on public.daily_aura_settings to authenticated;

-- Season 1 starts today (database date, UTC).
insert into public.daily_aura_settings (id, current_season, season_start_date)
values (true, 1, current_date)
on conflict (id) do nothing;

commit;
