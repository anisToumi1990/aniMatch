-- Compatibility v2 (trait-based), part 3: switch the RPCs to v2, lock down RLS, backfill.
--
-- Run in the Supabase SQL editor after 20261122100000_compatibility_v2.sql and after
-- 20261122100100_compatibility_v2_check.sql has passed. One transaction: all or nothing.
--
-- 1. compatibility_v2_refresh_pair(): internal helper, recomputes one pair's rows.
-- 2. create_compatibility_results(invite_id) and update_user_compatibility_results(user_id, new_aura_id):
--    same signatures (the app's calls don't change), now SECURITY DEFINER with search_path = public,
--    v2 scores, and a caller check. Before, they ran as the caller (SECURITY INVOKER), which only
--    worked because clients could insert/update compatibility_results and read the inviter's results.
-- 3. RLS: compatibility_results is select-only for clients (no insert/update/delete);
--    user_quiz_results is readable only by its owner (the "accepted invite" read access is removed).
-- (relationship_type is compared as text, so this works whether the column is text or an enum.)
-- 4. Backfill: every existing compatibility_results row is recomputed with v2. Updates only,
--    so notify_match_ready (on insert) sends no notifications.

begin;

-------------------------------------------------------------------------------
-- 1. compatibility_v2_refresh_pair (internal)
-------------------------------------------------------------------------------

create or replace function public.compatibility_v2_refresh_pair(p_user_a uuid, p_user_b uuid, p_relationship_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traits_a jsonb;
  v_traits_b jsonb;
  v_scores record;
  v_aura_a integer;
  v_aura_b integer;
  v_updated integer := 0;
  v_count integer;
begin
  if p_user_a is null or p_user_b is null or p_relationship_type is null then
    return 0;
  end if;

  v_traits_a := public.compatibility_v2_traits(p_user_a);
  v_traits_b := public.compatibility_v2_traits(p_user_b);
  if v_traits_a is null or v_traits_b is null then
    return 0; -- someone has no quiz result (or no profile): leave the row as it is
  end if;

  select * into v_scores from public.compatibility_v2_scores(v_traits_a, v_traits_b, p_relationship_type);
  if not found or v_scores.out_overall is null then
    return 0; -- unknown relationship type or missing traits
  end if;

  select r.aura_id into v_aura_a from public.user_quiz_results r
  where r.user_id = p_user_a and r.aura_id is not null order by r.quiz_date desc limit 1;
  select r.aura_id into v_aura_b from public.user_quiz_results r
  where r.user_id = p_user_b and r.aura_id is not null order by r.quiz_date desc limit 1;

  -- Scores are symmetric; only the aura columns depend on the row's order.
  update public.compatibility_results cr
  set user_a_aura_id = coalesce(v_aura_a, cr.user_a_aura_id),
      user_b_aura_id = coalesce(v_aura_b, cr.user_b_aura_id),
      compatibility_score = round(v_scores.out_overall::numeric),
      communication_score = round(v_scores.out_communication::numeric),
      energy_score = round(v_scores.out_energy::numeric),
      conflict_score = round(v_scores.out_conflict::numeric),
      values_score = round(v_scores.out_values::numeric),
      compatibility_version = 2
  where cr.user_a_id = p_user_a and cr.user_b_id = p_user_b and cr.relationship_type::text = p_relationship_type;
  get diagnostics v_count = row_count;
  v_updated := v_updated + v_count;

  if p_user_a <> p_user_b then
    update public.compatibility_results cr
    set user_a_aura_id = coalesce(v_aura_b, cr.user_a_aura_id),
        user_b_aura_id = coalesce(v_aura_a, cr.user_b_aura_id),
        compatibility_score = round(v_scores.out_overall::numeric),
        communication_score = round(v_scores.out_communication::numeric),
        energy_score = round(v_scores.out_energy::numeric),
        conflict_score = round(v_scores.out_conflict::numeric),
        values_score = round(v_scores.out_values::numeric),
        compatibility_version = 2
    where cr.user_a_id = p_user_b and cr.user_b_id = p_user_a and cr.relationship_type::text = p_relationship_type;
    get diagnostics v_count = row_count;
    v_updated := v_updated + v_count;
  end if;

  return v_updated;
end;
$$;

comment on function public.compatibility_v2_refresh_pair(uuid, uuid, text) is
  'Internal (no client execute): recomputes the compatibility_results rows of one pair + relationship type with v2. Returns the number of rows updated.';

revoke execute on function public.compatibility_v2_refresh_pair(uuid, uuid, text) from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 2a. create_compatibility_results(invite_id): called when an invite is answered
--     and after a quiz for accepted invites without a result.
-------------------------------------------------------------------------------

create or replace function public.create_compatibility_results(invite_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_traits_a jsonb;
  v_traits_b jsonb;
  v_scores record;
  v_aura_a integer;
  v_aura_b integer;
begin
  select i.id, i.inviter_user_id, i.recipient_user_id, i.relationship_type, i.status
  into v_invite
  from public.invites i
  where i.id = create_compatibility_results.invite_id;

  if not found then
    return;
  end if;

  -- Only the two people in the invite (auth.uid() is null for the service role / SQL editor).
  if auth.uid() is not null
    and auth.uid() is distinct from v_invite.inviter_user_id
    and auth.uid() is distinct from v_invite.recipient_user_id
  then
    raise exception 'Not allowed to create compatibility results for invite %', v_invite.id
      using errcode = '42501';
  end if;

  -- The app also calls this after a rejection: nothing to do then.
  if v_invite.status is distinct from 'accepted'
    or v_invite.inviter_user_id is null
    or v_invite.recipient_user_id is null
    or v_invite.relationship_type is null
  then
    return;
  end if;

  -- Already have a row for this pair + type (either order): just recompute it.
  if exists (
    select 1 from public.compatibility_results cr
    where cr.relationship_type::text = v_invite.relationship_type::text
      and (
        (cr.user_a_id = v_invite.inviter_user_id and cr.user_b_id = v_invite.recipient_user_id)
        or (cr.user_a_id = v_invite.recipient_user_id and cr.user_b_id = v_invite.inviter_user_id)
      )
  ) then
    perform public.compatibility_v2_refresh_pair(v_invite.inviter_user_id, v_invite.recipient_user_id, v_invite.relationship_type::text);
    return;
  end if;

  -- Both need a quiz result; otherwise this runs again after the other person's quiz.
  v_traits_a := public.compatibility_v2_traits(v_invite.inviter_user_id);
  v_traits_b := public.compatibility_v2_traits(v_invite.recipient_user_id);
  if v_traits_a is null or v_traits_b is null then
    return;
  end if;

  select * into v_scores from public.compatibility_v2_scores(v_traits_a, v_traits_b, v_invite.relationship_type::text);
  if not found or v_scores.out_overall is null then
    return;
  end if;

  select r.aura_id into v_aura_a from public.user_quiz_results r
  where r.user_id = v_invite.inviter_user_id and r.aura_id is not null order by r.quiz_date desc limit 1;
  select r.aura_id into v_aura_b from public.user_quiz_results r
  where r.user_id = v_invite.recipient_user_id and r.aura_id is not null order by r.quiz_date desc limit 1;

  -- notify_match_ready (after insert) sends the match_ready notifications.
  insert into public.compatibility_results (
    invite_id, user_a_id, user_b_id, user_a_aura_id, user_b_aura_id, relationship_type,
    compatibility_score, communication_score, energy_score, conflict_score, values_score, compatibility_version
  )
  values (
    v_invite.id, v_invite.inviter_user_id, v_invite.recipient_user_id, v_aura_a, v_aura_b, v_invite.relationship_type,
    round(v_scores.out_overall::numeric),
    round(v_scores.out_communication::numeric),
    round(v_scores.out_energy::numeric),
    round(v_scores.out_conflict::numeric),
    round(v_scores.out_values::numeric),
    2
  );
end;
$$;

comment on function public.create_compatibility_results(integer) is
  'RPC: creates (or recomputes) the v2 compatibility result of an accepted invite. Caller must be the inviter or the recipient.';

revoke execute on function public.create_compatibility_results(integer) from public, anon;
grant execute on function public.create_compatibility_results(integer) to authenticated;

-------------------------------------------------------------------------------
-- 2b. update_user_compatibility_results(user_id, new_aura_id): called after every quiz
-------------------------------------------------------------------------------

create or replace function public.update_user_compatibility_results(user_id uuid, new_aura_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair record;
begin
  -- Only for yourself (auth.uid() is null for the service role / SQL editor).
  if auth.uid() is not null and auth.uid() is distinct from update_user_compatibility_results.user_id then
    raise exception 'Not allowed to update compatibility results for another user'
      using errcode = '42501';
  end if;

  -- new_aura_id is kept for the app's call; traits and auras are read from the latest results.
  for v_pair in
    select distinct cr.user_a_id, cr.user_b_id, cr.relationship_type
    from public.compatibility_results cr
    where cr.user_a_id = update_user_compatibility_results.user_id
       or cr.user_b_id = update_user_compatibility_results.user_id
  loop
    perform public.compatibility_v2_refresh_pair(v_pair.user_a_id, v_pair.user_b_id, v_pair.relationship_type::text);
  end loop;
end;
$$;

comment on function public.update_user_compatibility_results(uuid, integer) is
  'RPC: recomputes all of the caller''s compatibility results with v2 (after a quiz). Caller must be user_id.';

revoke execute on function public.update_user_compatibility_results(uuid, integer) from public, anon;
grant execute on function public.update_user_compatibility_results(uuid, integer) to authenticated;

-------------------------------------------------------------------------------
-- 3a. RLS: compatibility_results is select-only for clients
--     (the app never inserts, updates or deletes rows itself; the RPCs above do the writes)
-------------------------------------------------------------------------------

-- Drop every existing policy by its real name (the exported names may be truncated).
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'compatibility_results'
  loop
    execute format('drop policy %I on public.compatibility_results', v_policy.policyname);
  end loop;
end;
$$;

alter table public.compatibility_results enable row level security;

create policy "Users can read their own compatibility results"
  on public.compatibility_results for select
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

revoke all on public.compatibility_results from anon;
revoke insert, update, delete, truncate on public.compatibility_results from authenticated;
grant select on public.compatibility_results to authenticated;

-------------------------------------------------------------------------------
-- 3b. RLS: user_quiz_results is readable only by its owner
--     (the app only reads the signed-in user's own results; other people's animals come
--      from compatibility_results.user_*_aura_id). Insert/update policies are unchanged.
-------------------------------------------------------------------------------

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_quiz_results' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.user_quiz_results', v_policy.policyname);
  end loop;
end;
$$;

create policy "Users can read their own quiz results"
  on public.user_quiz_results for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.user_quiz_results from anon;

-------------------------------------------------------------------------------
-- 4. Backfill: recompute every existing row with v2
-------------------------------------------------------------------------------

do $$
declare
  v_pair record;
  v_updated integer := 0;
  v_total integer;
  v_still_v1 integer;
begin
  for v_pair in
    select distinct least(cr.user_a_id, cr.user_b_id) as user_x, greatest(cr.user_a_id, cr.user_b_id) as user_y, cr.relationship_type
    from public.compatibility_results cr
    where cr.relationship_type is not null
  loop
    v_updated := v_updated + public.compatibility_v2_refresh_pair(v_pair.user_x, v_pair.user_y, v_pair.relationship_type::text);
  end loop;

  select count(*) into v_total from public.compatibility_results;
  select count(*) into v_still_v1 from public.compatibility_results where compatibility_version = 1;
  raise notice 'Compatibility v2 backfill: % of % rows updated, % still v1 (missing quiz result, profile or relationship type).',
    v_updated, v_total, v_still_v1;
end;
$$;

commit;
