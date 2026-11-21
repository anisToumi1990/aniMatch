-- Quiz v2 (trait-based), seed. Generated from docs/quiz-v2-proposal.md (final version).
--
-- Question ids: 1-15 = Q1-Q15, 16-20 = tie-breakers TB-S, TB-C, TB-O, TB-K, TB-Ch.
-- Option ids: question id * 10 + 1..4 (1 = 3 points … 4 = 0 points). The app shuffles both.
-- Profiles: the final tuned table (section 2), matched to animal_auras by name.
--
-- Re-runnable (upserts). Run in the Supabase SQL editor, after 20261121100000_quiz_v2_schema.sql.

begin;

insert into public.quiz_v2_questions (id, trait, text, is_tiebreaker, sort_order)
values
  (1, 'social', 'A friend texts: "Surprise party tonight. You in?"', false, 1),
  (2, 'social', 'Long train ride. The stranger next to you is very chatty.', false, 2),
  (3, 'social', 'Your perfect Saturday night recharge:', false, 3),
  (4, 'curiosity', 'Day one in a city you''ve never been to:', false, 4),
  (5, 'curiosity', 'The menu has a dish you''ve never heard of.', false, 5),
  (6, 'curiosity', 'A free afternoon, phone on silent:', false, 6),
  (7, 'organization', 'Moving day is next week.', false, 7),
  (8, 'organization', 'Your phone''s home screen is…', false, 8),
  (9, 'organization', 'A group trip with friends needs planning.', false, 9),
  (10, 'kindness', 'A friend shows you their new business idea. It has a big flaw.', false, 10),
  (11, 'kindness', 'Group project, and one person keeps falling behind.', false, 11),
  (12, 'kindness', 'The last slice of pizza, and a friend is eyeing it.', false, 12),
  (13, 'chill', 'Your flight is delayed 4 hours.', false, 13),
  (14, 'chill', 'Ten minutes before a big presentation:', false, 14),
  (15, 'chill', 'Someone cuts in front of you in a long queue.', false, 15),
  (16, 'social', 'You win a weekend trip. You bring…', true, 16),
  (17, 'curiosity', 'A mystery box arrives with no label.', true, 17),
  (18, 'organization', 'Your desk right now:', true, 18),
  (19, 'kindness', 'A friend cancels on you last minute. Again.', true, 19),
  (20, 'chill', 'The wifi dies in the middle of your show.', true, 20)
on conflict (id) do update set
  trait = excluded.trait,
  text = excluded.text,
  is_tiebreaker = excluded.is_tiebreaker,
  sort_order = excluded.sort_order;

insert into public.quiz_v2_options (id, question_id, text, points)
values
  (11, 1, 'I''m bringing the playlist and three more people.', 3),
  (12, 1, 'Obviously. I''ll probably be the last one to leave.', 2),
  (13, 1, 'I''ll stop by for an hour and catch up with the host.', 1),
  (14, 1, 'I''ll send a gift and a voice note, then celebrate one-on-one next week.', 0),
  (21, 2, 'Best ride ever, we swap life stories.', 3),
  (22, 2, 'A good chat for a while, then headphones.', 2),
  (23, 2, 'Friendly but short, then back to the view.', 1),
  (24, 2, 'Window seat, headphones, a whole movie: my favorite kind of trip.', 0),
  (31, 3, 'A packed concert or a big night out.', 3),
  (32, 3, 'Dinner with a group of good friends.', 2),
  (33, 3, 'Movie night with one or two close people.', 1),
  (34, 3, 'A cozy solo night with a project, game or book.', 0),
  (41, 4, 'No map. I''ll see where I end up.', 3),
  (42, 4, 'Hunt down the hidden spots locals recommend.', 2),
  (43, 4, 'The famous sights. They''re famous for a reason.', 1),
  (44, 4, 'Find a café I love and make it my base for the week.', 0),
  (51, 5, 'Ordering it. The weirder the better.', 3),
  (52, 5, 'Ask the waiter about it, then probably try it.', 2),
  (53, 5, 'Steal a bite from a friend''s plate before I commit.', 1),
  (54, 5, 'My usual. I know exactly what I love.', 0),
  (61, 6, 'Fall down a rabbit hole on a random topic (octopus brains, anyone?).', 3),
  (62, 6, 'Try a new hobby I saw online.', 2),
  (63, 6, 'Get better at something I already do.', 1),
  (64, 6, 'Rewatch my comfort show.', 0),
  (71, 7, 'Spreadsheet, labeled boxes, color codes.', 3),
  (72, 7, 'A checklist and a few boxes every day.', 2),
  (73, 7, 'A rough plan and one big packing push the night before.', 1),
  (74, 7, 'Everything into boxes, I''ll figure it out at the new place.', 0),
  (81, 8, 'Folders by category. I could find anything with my eyes closed.', 3),
  (82, 8, 'Mostly tidy, with a few strays.', 2),
  (83, 8, 'Whatever I used last is up front.', 1),
  (84, 8, 'A beautiful chaos only I understand.', 0),
  (91, 9, 'I''m making the shared itinerary, backup options included.', 3),
  (92, 9, 'I''ll book the big stuff and keep the days open.', 2),
  (93, 9, 'I''ll go with whatever the group decides.', 1),
  (94, 9, 'Plans? We''ll pick the destination at the station.', 0),
  (101, 10, 'Cheer them on first, then help them fix it together.', 3),
  (102, 10, 'Point out the flaw gently, with a few ideas.', 2),
  (103, 10, 'Ask sharp questions until they spot it themselves.', 1),
  (104, 10, 'Tell them straight: better from me now than from the market later.', 0),
  (111, 11, 'Check in with them privately. Maybe something''s going on.', 3),
  (112, 11, 'Offer to take a piece of their work.', 2),
  (113, 11, 'Re-split the tasks so the deadline is safe.', 1),
  (114, 11, 'Raise it with the group. Fair is fair.', 0),
  (121, 12, 'It''s theirs before they even ask.', 3),
  (122, 12, 'Half for you, half for me.', 2),
  (123, 12, 'Rock-paper-scissors for it.', 1),
  (124, 12, 'Sorry, I''ve been thinking about this slice all day.', 0),
  (131, 13, 'A quiet corner and some bonus free time. Nice.', 3),
  (132, 13, 'One sigh, then snacks and a movie.', 2),
  (133, 13, 'Check every other flight option, just in case.', 1),
  (134, 13, 'Already at the desk, making things happen.', 0),
  (141, 14, 'Relaxed. It''ll go how it goes.', 3),
  (142, 14, 'A few deep breaths and I''m ready.', 2),
  (143, 14, 'My heart''s racing a bit, but I''ll use it.', 1),
  (144, 14, 'Buzzing with nerves, which is exactly my fuel.', 0),
  (151, 15, 'Not worth my energy. I let it go.', 3),
  (152, 15, 'A light joke about it, then I move on.', 2),
  (153, 15, 'A polite "Excuse me, the line starts back there."', 1),
  (154, 15, 'I call it out on the spot. Someone has to.', 0),
  (161, 16, 'Ten people. Let''s go.', 3),
  (162, 16, 'My four closest friends.', 2),
  (163, 16, 'One favorite person.', 1),
  (164, 16, 'Just me. Finally, a solo trip.', 0),
  (171, 17, 'Open it right now.', 3),
  (172, 17, 'Shake it, guess, then open it.', 2),
  (173, 17, 'Find out who sent it first.', 1),
  (174, 17, 'It waits until I know what it is.', 0),
  (181, 18, 'Everything has its place.', 3),
  (182, 18, 'Tidy enough.', 2),
  (183, 18, 'Organized piles.', 1),
  (184, 18, 'A creative explosion.', 0),
  (191, 19, '"No worries! Hope you''re okay."', 3),
  (192, 19, '"All good, let''s reschedule."', 2),
  (193, 19, '"Sure, but next time you pick the place and pay."', 1),
  (194, 19, 'I tell them honestly that it bugs me.', 0),
  (201, 20, 'Perfect excuse for a nap.', 3),
  (202, 20, 'I''ll read until it''s back.', 2),
  (203, 20, 'Restart the router. Twice.', 1),
  (204, 20, 'On the phone with the provider within a minute.', 0)
on conflict (id) do update set
  question_id = excluded.question_id,
  text = excluded.text,
  points = excluded.points;

insert into public.animal_trait_profiles (aura_id, social, curiosity, organization, kindness, chill)
select a.id, p.social, p.curiosity, p.organization, p.kindness, p.chill
from (values
  ('Dolphin', 78, 58, 42, 72, 48),
  ('Peacock', 74, 50, 60, 30, 34),
  ('Lion', 70, 36, 68, 44, 58),
  ('Fox', 60, 74, 36, 34, 52),
  ('Parrot', 76, 66, 30, 54, 32),
  ('Owl', 28, 66, 64, 50, 68),
  ('Wolf', 54, 30, 62, 70, 34),
  ('Bear', 26, 32, 68, 56, 70),
  ('Unicorn', 46, 76, 32, 66, 50),
  ('Elephant', 50, 40, 62, 76, 70),
  ('Snake', 28, 62, 54, 30, 64),
  ('Cat', 26, 70, 34, 38, 46),
  ('Eagle', 42, 50, 78, 30, 46),
  ('Deer', 28, 44, 40, 78, 38),
  ('Otter', 66, 58, 30, 58, 72)
) as p (name, social, curiosity, organization, kindness, chill)
join public.animal_auras a on lower(a.name) = lower(p.name)
on conflict (aura_id) do update set
  social = excluded.social,
  curiosity = excluded.curiosity,
  organization = excluded.organization,
  kindness = excluded.kindness,
  chill = excluded.chill,
  updated_at = now();

-- Fail (and roll back) if an animal name didn't match.
do $$
begin
  if (select count(*) from public.animal_trait_profiles) <> 15 then
    raise exception 'Expected 15 animal_trait_profiles rows, found %', (select count(*) from public.animal_trait_profiles);
  end if;
end;
$$;

commit;
