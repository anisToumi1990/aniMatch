-- Friend notifications (in-app, witty tone).
--
-- Extends the EXISTING public.notifications table (id bigint, user_id, type,
-- title, message, data, is_read, read_at, invite_id, created_at) instead of
-- creating a new one: the Invites tab still reads title / message / is_read /
-- invite_id, so those stay and keep being filled.
--
-- Channel-agnostic: `data` holds the values the texts are built from, and
-- push_sent_at / email_sent_at let a future sender (Expo push, Resend) pick up
-- rows it hasn't delivered yet, without schema changes.
--
-- Texts: constants/notificationCopy.ts is the source of truth (the app renders
-- from type + data). The functions below write the same texts into
-- title / body / message as a fallback. Keep both in sync.
--
-- Run in the Supabase SQL editor. Everything is in one transaction.

begin;

-------------------------------------------------------------------------------
-- 1. New columns (type, title, message, data, read_at, created_at already exist)
-------------------------------------------------------------------------------

alter table public.notifications
  add column if not exists body text,
  add column if not exists link text,
  add column if not exists actor_id uuid references auth.users (id) on delete set null,
  add column if not exists push_sent_at timestamptz,
  add column if not exists email_sent_at timestamptz;

alter table public.notifications
  alter column data set default '{}'::jsonb;

-------------------------------------------------------------------------------
-- 2. Helpers (used by the trigger functions only)
-------------------------------------------------------------------------------

-- First name from profiles.full_name, or 'Someone' so triggers never fail.
create or replace function public.notification_first_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(split_part(btrim(p.full_name), ' ', 1), '')
       from public.profiles p
      where p.id = p_user_id),
    'Someone'
  );
$$;

-- Name of the user's latest aura, or null.
create or replace function public.notification_aura_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.name
    from public.user_quiz_results r
    join public.animal_auras a on a.id = r.aura_id
   where r.user_id = p_user_id
     and r.aura_id is not null
   order by r.quiz_date desc nulls last
   limit 1;
$$;

-- Same emoji map as AURA_EMOJI in constants/notificationCopy.ts.
create or replace function public.notification_aura_emoji(p_animal text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(btrim(coalesce(p_animal, '')))
    when 'bear' then '🐻' when 'cat' then '🐱' when 'deer' then '🦌'
    when 'dolphin' then '🐬' when 'eagle' then '🦅' when 'elephant' then '🐘'
    when 'fox' then '🦊' when 'lion' then '🦁' when 'otter' then '🦦'
    when 'owl' then '🦉' when 'parrot' then '🦜' when 'peacock' then '🦚'
    when 'snake' then '🐍' when 'unicorn' then '🦄' when 'wolf' then '🐺'
    else '✨'
  end;
$$;

revoke execute on function public.notification_first_name(uuid) from public, anon, authenticated;
revoke execute on function public.notification_aura_name(uuid) from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 3. Backfill rows created by the old invite trigger (type 'invite')
-------------------------------------------------------------------------------

update public.notifications n
set type = 'invite_received',
    title = 'New invite 👀',
    body = public.notification_first_name(i.inviter_user_id) || ' wants to know how you two match. Brave. 👀',
    message = public.notification_first_name(i.inviter_user_id) || ' wants to know how you two match. Brave. 👀',
    link = '/invites',
    actor_id = i.inviter_user_id,
    data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
      'actor_name', public.notification_first_name(i.inviter_user_id),
      'actor_animal', public.notification_aura_name(i.inviter_user_id),
      'invite_id', i.id
    )
from public.invites i
where n.invite_id = i.id
  and n.type = 'invite';

update public.notifications
set data = '{}'::jsonb
where data is null;

update public.notifications
set read_at = coalesce(read_at, created_at)
where is_read is true and read_at is null;

-- Invites that were already answered shouldn't light up the new bell.
update public.notifications n
set is_read = true, read_at = coalesce(n.read_at, now())
from public.invites i
where n.invite_id = i.id
  and n.read_at is null
  and i.status is distinct from 'pending';

-------------------------------------------------------------------------------
-- 4. Index
-------------------------------------------------------------------------------

create index if not exists notifications_user_id_read_at_idx
  on public.notifications (user_id, read_at);

-------------------------------------------------------------------------------
-- 5. RLS: users can select and update their own notifications. No client insert.
-------------------------------------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;

create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Privileges are checked before RLS: clients can read, and only change read state.
-- (The existing mark_notification_read trigger still fills read_at from is_read.)
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at, is_read) on public.notifications to authenticated;

-------------------------------------------------------------------------------
-- 6. invite_received: replaces the body of the existing send_invite_notification()
--    (trigger send_invite_notification_trigger). The email_queue branch for
--    invitees without an account is kept exactly as it was.
-------------------------------------------------------------------------------

create or replace function public.send_invite_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter_email text;
  inviter_name text;
  invite_link text;
  v_first_name text;
  v_animal text;
  v_body text;
begin
  -- In-app notification for a recipient who has an account, once per invite.
  -- On UPDATE this only runs when the recipient is set later.
  if new.recipient_user_id is not null
     and (tg_op = 'INSERT' or old.recipient_user_id is distinct from new.recipient_user_id)
     and not exists (
       select 1 from public.notifications
        where user_id = new.recipient_user_id
          and invite_id = new.id
          and type = 'invite_received'
     ) then
    v_first_name := public.notification_first_name(new.inviter_user_id);
    v_animal := public.notification_aura_name(new.inviter_user_id);
    v_body := v_first_name || ' wants to know how you two match. Brave. 👀';

    insert into public.notifications
      (user_id, type, title, body, message, link, actor_id, invite_id, data)
    values (
      new.recipient_user_id,
      'invite_received',
      'New invite 👀',
      v_body,
      v_body,
      '/invites',
      new.inviter_user_id,
      new.id,
      jsonb_build_object(
        'actor_name', v_first_name,
        'actor_animal', v_animal,
        'invite_id', new.id,
        'relationship_type', new.relationship_type
      )
    );
    return new;
  end if;

  -- Unchanged from the previous version: email invite for non-registered users.
  if tg_op = 'INSERT' and new.recipient_user_id is null then
    select email, full_name into inviter_email, inviter_name
      from public.profiles
     where id = new.inviter_user_id;

    invite_link := 'animatchaura://invite/' || new.id;

    insert into public.email_queue (to_email, subject, template, data)
    values (
      new.recipient_email,
      'You have been invited to take the AniMatch Quiz',
      'invite',
      jsonb_build_object(
        'inviter_name', inviter_name,
        'inviter_email', inviter_email,
        'invite_link', invite_link,
        'relationship_type', new.relationship_type
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists send_invite_notification_trigger on public.invites;
create trigger send_invite_notification_trigger
  after insert or update of recipient_user_id on public.invites
  for each row execute function public.send_invite_notification();

-------------------------------------------------------------------------------
-- 7. invite_accepted: someone accepts my invite (notifies the inviter)
-------------------------------------------------------------------------------

create or replace function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_animal text;
  v_body text;
begin
  if new.status is distinct from 'accepted'
     or old.status is not distinct from 'accepted'
     or new.recipient_user_id is null
     or new.inviter_user_id is null then
    return new;
  end if;

  v_name := public.notification_first_name(new.recipient_user_id);
  v_animal := public.notification_aura_name(new.recipient_user_id);
  v_body := v_name || ' said yes. Now the quiz decides your fate.';

  insert into public.notifications
    (user_id, type, title, body, message, link, actor_id, data)
  values (
    new.inviter_user_id,
    'invite_accepted',
    'Invite accepted ' || public.notification_aura_emoji(v_animal),
    v_body,
    v_body,
    '/compatibility',
    new.recipient_user_id,
    jsonb_build_object(
      'actor_name', v_name,
      'actor_animal', v_animal,
      'invite_id', new.id,
      'relationship_type', new.relationship_type
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_invite_accepted on public.invites;
create trigger notify_invite_accepted
  after update of status on public.invites
  for each row execute function public.notify_invite_accepted();

-------------------------------------------------------------------------------
-- 8. match_ready: a compatibility result is created (one row for each user).
--    update_user_compatibility_results only UPDATEs rows, so retakes don't re-fire this.
-------------------------------------------------------------------------------

create or replace function public.notify_match_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer := round(new.compatibility_score);
  v_score_text text := coalesce(round(new.compatibility_score)::text || '%', '??%');
  v_recipient uuid;
  v_actor uuid;
  v_actor_aura_id bigint;
  v_name text;
  v_animal text;
  v_animal_phrase text;
  v_body text;
begin
  for v_recipient, v_actor, v_actor_aura_id in
    select new.user_a_id, new.user_b_id, new.user_b_aura_id
    union all
    select new.user_b_id, new.user_a_id, new.user_a_aura_id
  loop
    continue when v_recipient is null;

    v_name := public.notification_first_name(v_actor);
    v_animal := null;
    select a.name into v_animal from public.animal_auras a where a.id = v_actor_aura_id;
    v_animal_phrase := case
      when v_animal is null then 'a mystery'
      when v_animal ~* '^[aeiou]' then 'an ' || v_animal
      else 'a ' || v_animal
    end;
    v_body := v_name || ' is ' || v_animal_phrase || '. You two? ' || v_score_text || '. Go see why 👀';

    insert into public.notifications
      (user_id, type, title, body, message, link, actor_id, data)
    values (
      v_recipient,
      'match_ready',
      'Your match is in ' || public.notification_aura_emoji(v_animal),
      v_body,
      v_body,
      '/compatibility',
      v_actor,
      jsonb_build_object(
        'actor_name', v_name,
        'actor_animal', v_animal,
        'score', v_score,
        'relationship_type', new.relationship_type,
        'compatibility_result_id', new.id
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_match_ready on public.compatibility_results;
create trigger notify_match_ready
  after insert on public.compatibility_results
  for each row execute function public.notify_match_ready();

commit;

-------------------------------------------------------------------------------
-- TODO (push / email, later; see CLAUDE.md):
--   rows where push_sent_at is null  -> send via Expo push, then set push_sent_at
--   rows where email_sent_at is null -> send via Resend, then set email_sent_at
-------------------------------------------------------------------------------
