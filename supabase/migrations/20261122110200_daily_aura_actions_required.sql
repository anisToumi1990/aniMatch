-- Daily aura: make action_text / action_why required, once every row has them.
--
-- Run in the Supabase SQL editor after 20261122110100_daily_aura_season1_actions.sql.
-- Fails (and changes nothing) if any row, in any season, is still missing an action,
-- e.g. a season seeded before the action columns existed: fill it first.

begin;

do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from public.daily_aura_messages
  where action_text is null or action_why is null;
  if v_missing > 0 then
    raise exception 'daily aura: % row(s) have no action_text / action_why yet; fill them before making the columns required', v_missing;
  end if;
end $$;

alter table public.daily_aura_messages
  alter column action_text set not null,
  alter column action_why set not null;

commit;
