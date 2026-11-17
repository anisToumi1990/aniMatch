-- Premium interest: one row each time a user taps the paywall's call to action
-- ("Start 7-day free trial" / "Continue with monthly"). There is no real payment
-- yet; this only measures demand.
--
-- RLS: authenticated users can insert their own rows only. Clients can't read,
-- update or delete anything (query it from the dashboard / service role).
-- The app inserts with returning: 'minimal' because it has no read access.
--
-- Run in the Supabase SQL editor.

begin;

create table if not exists public.premium_interest (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Where the paywall was opened from, e.g. 'week_strip'.
  source text not null check (char_length(btrim(source)) between 1 and 40),
  plan text not null check (plan in ('yearly', 'monthly')),
  created_at timestamptz not null default now()
);

comment on table public.premium_interest is
  'Taps on the premium paywall call to action (no payment yet). Insert-only for clients.';

create index if not exists premium_interest_created_at_idx
  on public.premium_interest (created_at);

alter table public.premium_interest enable row level security;

drop policy if exists "Users can record their own premium interest" on public.premium_interest;
create policy "Users can record their own premium interest"
  on public.premium_interest for insert
  to authenticated
  with check (user_id = auth.uid());

-- No select/update/delete policy: clients can't read or change rows.
revoke all on public.premium_interest from anon, authenticated;
grant insert (user_id, source, plan) on public.premium_interest to authenticated;

commit;
