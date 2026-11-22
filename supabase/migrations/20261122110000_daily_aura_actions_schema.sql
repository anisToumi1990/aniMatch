-- Daily aura: "Today's action" replaces Do / Don't on Home.
--
-- Adds two columns to daily_aura_messages:
--   action_text: one concrete thing to do today (content limit 60 chars, DB allows 80)
--   action_why:  why it helps, 1-2 sentences (content limit 160 chars, DB allows 200)
-- do_text / dont_text stay (still required) but the app no longer shows them.
--
-- Run in the Supabase SQL editor, in this order:
--   1. this file
--   2. 20261122110100_daily_aura_season1_actions.sql (generated: fills the 900 season 1 rows)
--   3. 20261122110200_daily_aura_actions_required.sql (makes both columns not null)
-- The app reads both columns, so run 1-3 before releasing the app update.
--
-- No RLS or grant change: the existing select policy and table-level grant
-- (authenticated, active rows only) cover the new columns.

begin;

alter table public.daily_aura_messages
  add column if not exists action_text text,
  add column if not exists action_why text;

alter table public.daily_aura_messages
  drop constraint if exists daily_aura_messages_action_text_check,
  drop constraint if exists daily_aura_messages_action_why_check;

alter table public.daily_aura_messages
  add constraint daily_aura_messages_action_text_check
    check (action_text is null or char_length(btrim(action_text)) between 1 and 80),
  add constraint daily_aura_messages_action_why_check
    check (action_why is null or char_length(btrim(action_why)) between 1 and 200);

comment on column public.daily_aura_messages.action_text is
  'Home "Today''s action": one concrete thing to do today. Source: supabase/content/daily-aura/.';
comment on column public.daily_aura_messages.action_why is
  'Shown under the action: why it helps (1-2 practical sentences).';
comment on column public.daily_aura_messages.do_text is
  'Legacy (before Today''s action). Still required, no longer shown in the app.';
comment on column public.daily_aura_messages.dont_text is
  'Legacy (before Today''s action). Still required, no longer shown in the app.';

commit;
