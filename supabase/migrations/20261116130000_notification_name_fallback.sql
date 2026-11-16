-- Name fallback, same as lib/names.ts in the app:
-- first name from profiles.full_name, else the part of the email before "@",
-- else 'Someone'.
--
-- Run in the Supabase SQL editor after 20261116120000_friend_notifications.sql.

begin;

create or replace function public.notification_first_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(
              nullif(split_part(btrim(p.full_name), ' ', 1), ''),
              nullif(btrim(split_part(p.email, '@', 1)), '')
            )
       from public.profiles p
      where p.id = p_user_id),
    'Someone'
  );
$$;

revoke execute on function public.notification_first_name(uuid) from public, anon, authenticated;

-- Notifications already saved with 'Someone' get the email name when there is one.
-- All notification texts start with the name, so only that prefix is replaced.
with fixed as (
  select n.id, public.notification_first_name(n.actor_id) as name
    from public.notifications n
   where n.actor_id is not null
     and n.data ->> 'actor_name' = 'Someone'
)
update public.notifications n
set data = n.data || jsonb_build_object('actor_name', f.name),
    body = case when n.body like 'Someone%' then f.name || substr(n.body, 8) else n.body end,
    message = case when n.message like 'Someone%' then f.name || substr(n.message, 8) else n.message end
from fixed f
where n.id = f.id
  and f.name <> 'Someone';

commit;
