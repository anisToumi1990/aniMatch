-- Hide a match, only for me.
--
-- One row per (user, compatibility result) the user has hidden. The other person
-- in the pair still sees the match; nothing is notified. Hiding is undone by
-- deleting the row ("Show again"). Existing notifications are left as they are.
--
-- Run in the Supabase SQL editor after 20261123100200_pair_insights_check.sql.

begin;

create table if not exists public.hidden_matches (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compatibility_result_id bigint not null references public.compatibility_results (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, compatibility_result_id)
);

comment on table public.hidden_matches is
  'Matches (compatibility_results rows) a user has hidden from their own lists. Per user; the other person is not affected.';

create index if not exists hidden_matches_result_idx on public.hidden_matches (compatibility_result_id);

alter table public.hidden_matches enable row level security;

drop policy if exists "Users can read their own hidden matches" on public.hidden_matches;
drop policy if exists "Users can hide their own matches" on public.hidden_matches;
drop policy if exists "Users can unhide their own matches" on public.hidden_matches;

create policy "Users can read their own hidden matches"
  on public.hidden_matches for select
  to authenticated
  using (auth.uid() = user_id);

-- Only results the user is part of (compatibility_results RLS already limits the subquery to them).
create policy "Users can hide their own matches"
  on public.hidden_matches for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.compatibility_results cr
      where cr.id = hidden_matches.compatibility_result_id
        and (cr.user_a_id = auth.uid() or cr.user_b_id = auth.uid())
    )
  );

create policy "Users can unhide their own matches"
  on public.hidden_matches for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.hidden_matches from public, anon;
revoke update, truncate on public.hidden_matches from authenticated;
grant select, insert, delete on public.hidden_matches to authenticated;

commit;
