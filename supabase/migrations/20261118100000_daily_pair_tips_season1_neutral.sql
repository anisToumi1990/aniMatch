-- Season 1 pair tips: reword 14 tips that only fit a romantic partner or a shared
-- home (hugs, holding hands, evenings at home, comments on looks) so they suit
-- any relationship (family, partner, friend, business).
-- The seed uses "on conflict do nothing", so already seeded rows need this update.
-- Source of truth: supabase/content/daily-pair-tips/season-1/*.json.
--
-- Run in the Supabase SQL editor after 20261118090100_daily_pair_tips_season1_seed.sql.

begin;

update public.daily_pair_tips t
set tip = v.tip
from (values
  ('cat', 21, '{name} won''t be the first to reach out. Be the one who does.'),
  ('cat', 26, 'Notice when {name} sticks around. That''s the compliment.'),
  ('dolphin', 14, 'Keep up with {name}''s pace for once. Then suggest a slower one.'),
  ('dolphin', 19, '{name} feels things big today. Skip the teasing, keep it kind.'),
  ('dolphin', 27, '{name} needs warmth more than advice today. Lead with kindness.'),
  ('eagle', 13, 'Help {name} land after a big push. Give them room to recharge.'),
  ('elephant', 28, '{name} is wise but also tired. Don''t add one more thing to their list.'),
  ('lion', 21, '{name} needs rest but won''t admit it. Suggest a slower pace today.'),
  ('otter', 14, 'Laugh with {name} today. It''s the shortest way to their good side.'),
  ('otter', 29, '{name} needs freedom. Keep plans loose and the door open.'),
  ('peacock', 1, '{name} put real effort into something today. Notice it out loud.'),
  ('peacock', 8, 'Plan something with flair for {name}. They''ll turn it into an event.'),
  ('peacock', 12, 'Tell {name} what you like about who they are, not just what they do.'),
  ('wolf', 17, '{name} is resilient but tired. Keep today''s asks light.')
) as v (animal, day_index, tip)
join public.animal_auras a on lower(btrim(a.name)) = v.animal
where t.aura_id = a.id
  and t.season = 1
  and t.day_index = v.day_index;

commit;
