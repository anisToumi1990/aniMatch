-- Quiz v2 (trait-based), schema. See docs/quiz-v2-proposal.md.
--
-- quiz_v2_questions:      15 main questions (3 per trait) + 5 tie-breakers (1 per trait).
-- quiz_v2_options:        4 answers per question, worth 0-3 points on the question's trait.
-- animal_trait_profiles:  each aura's ideal score (0-100) on the 5 traits.
-- user_quiz_results:      + quiz_version (1 = old quiz, 2 = trait quiz) and trait_scores.
--
-- Scoring runs in the app (lib/quizV2Scoring.ts), like v1. No new functions here.
--
-- Run in the Supabase SQL editor, before 20261121100100_quiz_v2_seed.sql.

begin;

-------------------------------------------------------------------------------
-- 1. quiz_v2_questions
-------------------------------------------------------------------------------

create table if not exists public.quiz_v2_questions (
  id bigint primary key,
  trait text not null check (trait in ('social', 'curiosity', 'organization', 'kindness', 'chill')),
  text text not null check (char_length(btrim(text)) between 1 and 200),
  is_tiebreaker boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.quiz_v2_questions is
  'Quiz v2 questions. The app shuffles the main questions; tie-breakers are only asked on a near tie.';

-- One tie-breaker per trait: the app picks tie-breakers by trait.
create unique index if not exists quiz_v2_questions_one_tiebreaker_per_trait
  on public.quiz_v2_questions (trait)
  where is_tiebreaker;

alter table public.quiz_v2_questions enable row level security;

drop policy if exists "Authenticated users can read quiz v2 questions" on public.quiz_v2_questions;
create policy "Authenticated users can read quiz v2 questions"
  on public.quiz_v2_questions for select
  to authenticated
  using (true);

revoke all on public.quiz_v2_questions from anon, authenticated;
grant select on public.quiz_v2_questions to authenticated;

-------------------------------------------------------------------------------
-- 2. quiz_v2_options
-------------------------------------------------------------------------------

create table if not exists public.quiz_v2_options (
  id bigint primary key,
  question_id bigint not null references public.quiz_v2_questions (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  points smallint not null check (points between 0 and 3),
  created_at timestamptz not null default now(),
  constraint quiz_v2_options_question_points_key unique (question_id, points)
);

comment on table public.quiz_v2_options is
  'Quiz v2 answers: points (0-3) on the question''s trait. The app shuffles them, never shows points.';

create index if not exists quiz_v2_options_question_id_idx
  on public.quiz_v2_options (question_id);

alter table public.quiz_v2_options enable row level security;

drop policy if exists "Authenticated users can read quiz v2 options" on public.quiz_v2_options;
create policy "Authenticated users can read quiz v2 options"
  on public.quiz_v2_options for select
  to authenticated
  using (true);

revoke all on public.quiz_v2_options from anon, authenticated;
grant select on public.quiz_v2_options to authenticated;

-------------------------------------------------------------------------------
-- 3. animal_trait_profiles
-------------------------------------------------------------------------------

create table if not exists public.animal_trait_profiles (
  aura_id bigint primary key references public.animal_auras (id) on delete cascade,
  social smallint not null check (social between 0 and 100),
  curiosity smallint not null check (curiosity between 0 and 100),
  organization smallint not null check (organization between 0 and 100),
  kindness smallint not null check (kindness between 0 and 100),
  chill smallint not null check (chill between 0 and 100),
  updated_at timestamptz not null default now()
);

comment on table public.animal_trait_profiles is
  'Ideal 0-100 trait profile per aura. Quiz v2 picks the closest profile (Euclidean distance). Tuned with scripts/quiz-v2-simulation.js.';

alter table public.animal_trait_profiles enable row level security;

drop policy if exists "Authenticated users can read animal trait profiles" on public.animal_trait_profiles;
create policy "Authenticated users can read animal trait profiles"
  on public.animal_trait_profiles for select
  to authenticated
  using (true);

revoke all on public.animal_trait_profiles from anon, authenticated;
grant select on public.animal_trait_profiles to authenticated;

-------------------------------------------------------------------------------
-- 4. user_quiz_results: quiz version and trait scores
-------------------------------------------------------------------------------

alter table public.user_quiz_results
  add column if not exists quiz_version smallint not null default 1,
  add column if not exists trait_scores jsonb;

alter table public.user_quiz_results
  drop constraint if exists user_quiz_results_quiz_version_check;
alter table public.user_quiz_results
  add constraint user_quiz_results_quiz_version_check check (quiz_version in (1, 2));

-- v2 rows carry {"social": 0-100, "curiosity": …, "organization": …, "kindness": …, "chill": …}.
alter table public.user_quiz_results
  drop constraint if exists user_quiz_results_trait_scores_check;
alter table public.user_quiz_results
  add constraint user_quiz_results_trait_scores_check check (
    trait_scores is null
    or (jsonb_typeof(trait_scores) = 'object'
        and trait_scores ?& array['social', 'curiosity', 'organization', 'kindness', 'chill'])
  );

comment on column public.user_quiz_results.quiz_version is '1 = original quiz, 2 = trait quiz (v2).';
comment on column public.user_quiz_results.trait_scores is 'Quiz v2 only: the user''s 0-100 score per trait.';

-- The app already inserts into user_quiz_results under its existing RLS policy. In case
-- insert is granted per column, also grant the two new ones (no-op with a table grant).
grant insert (quiz_version, trait_scores) on public.user_quiz_results to authenticated;

commit;
