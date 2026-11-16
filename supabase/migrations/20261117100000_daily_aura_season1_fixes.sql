-- Season 1 content fixes (the seed uses "on conflict do nothing", so already
-- seeded rows need an explicit update). Source of truth:
-- supabase/content/daily-aura/season-1/{cat,lion}.json.
--
-- Run in the Supabase SQL editor after 20261117090100_daily_aura_season1_seed.sql.

begin;

-- Cat #13: no mention of a parent.
update public.daily_aura_messages m
set message = 'You don''t need everyone to like you. You do need to call them back.'
from public.animal_auras a
where m.aura_id = a.id
  and lower(btrim(a.name)) = 'cat'
  and m.season = 1
  and m.day_index = 13;

-- Lion #49: clearer Do text.
update public.daily_aura_messages m
set do_text = 'Ask for exactly what you want.'
from public.animal_auras a
where m.aura_id = a.id
  and lower(btrim(a.name)) = 'lion'
  and m.season = 1
  and m.day_index = 49;

commit;
