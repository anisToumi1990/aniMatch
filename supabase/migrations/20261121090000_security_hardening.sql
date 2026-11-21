-- Security hardening (Supabase advisor fixes).
-- Already applied on Supabase via the SQL editor; kept here for history. Do not re-run.

-- Pin search_path so these functions can't be hijacked through a mutable search_path.
alter function public.handle_new_user() set search_path = public;
alter function public.mark_notification_read() set search_path = public;
alter function public.create_compatibility_results(integer) set search_path = public;
alter function public.update_user_compatibility_results(uuid, integer) set search_path = public;

-- Trigger-only functions: nobody should call them directly through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.send_invite_notification() from public, anon, authenticated;
revoke execute on function public.notify_invite_accepted() from public, anon, authenticated;
revoke execute on function public.notify_match_ready() from public, anon, authenticated;
