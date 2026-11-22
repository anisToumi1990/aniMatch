# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AniMatch ("animatchaura") is an Expo SDK 58 / React Native 0.88 (React 19.3) app using expo-router and TypeScript (strict), with Supabase as the backend. Users take a 15-question trait quiz (quiz v2) that matches them to one of 15 "Animal Auras", invite other users, and see how compatible they are for a chosen relationship type (Lover / Business Partner / Family), scored from both people's traits (compatibility v2).

## Commands

- **Run the app:** `npx expo start --offline`
- **iOS simulator:** Device Hub (Xcode 27), with Expo Go for SDK 58 installed manually on it. Don't expect `expo start --ios` to install or upgrade Expo Go for you.
- **Tests:** `npm test` (jest-expo, runs in `--watchAll` mode). Run once without watching: `npx jest --watchAll=false`, or one file: `npx jest lib/__tests__/quizV2Scoring-test.ts`. Unit tests live in `lib/__tests__/`. The template `ThemedText` snapshot test already fails on `develop` (the renderer returns `null`), and Jest 30 rewrites the `.snap` header when it runs; don't commit that file by accident.
- **Lint:** `npm run lint` (`expo lint`). The repo has no ESLint config, so the first run creates `eslint.config.js`; don't commit it unless that's the task.
- **Type-check:** `npx tsc --noEmit`. Two errors already exist on `develop` (`components/ExternalLink.tsx` href type, `lib/supabase/index.ts` client options); anything else is new.

## Environment

- `.env` needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `lib/supabase/index.ts` throws at import time if either one is missing.
- **Never commit `.env`.** Don't stage it, even if `git add -A` or `git status` shows it.

## Security (Supabase project settings)

- `supabase/migrations/20261121090000_security_hardening.sql` pins `search_path = public` on `handle_new_user()`, `mark_notification_read()`, `create_compatibility_results(integer)` and `update_user_compatibility_results(uuid, integer)`, and revokes execute from `public` / `anon` / `authenticated` on the trigger functions (`handle_new_user`, `send_invite_notification`, `notify_invite_accepted`, `notify_match_ready`). Set `search_path` on any new function the same way.
- Email OTP expiry is set to 1 hour.
- Leaked password protection is off: it needs the Pro plan.
- Postgres upgrade is still pending.

## Architecture

**Routing and auth gate.** `app/_layout.tsx` nests the providers in this order: `SafeAreaProvider` → `AuthProvider` → `QuizProvider` → `NotificationsProvider`. Inside them, `AuthGuard` redirects based on `useSegments()`:
- no session → `(auth)/login`
- session but email not confirmed → `(verification)`
- confirmed → `(tabs)`

Any new top-level route group has to be accounted for in `AuthGuard`, or users will get bounced away from it. Sign-in with Google or Apple uses `expo-auth-session` / `WebBrowser` with the redirect `animatchaura://auth/callback` (`app/auth/callback.tsx`).

**Supabase JS is v1 (`^1.35`), not v2.** Use the v1 API: `supabase.auth.session()`, `supabase.auth.signIn({ provider })`, and `onAuthStateChange` returning `{ data: subscription }`. Most v2 examples online won't work here.

**Data access is split.** Quiz data lives in `lib/supabase/quiz.ts` (results, auras, compatibility sync) and `lib/supabase/quizV2.ts` (v2 questions, profiles, saving), notifications in `lib/supabase/notifications.ts`. Invites, profiles and compatibility are queried directly inside screens and components (`components/InviteForm.tsx`, `app/(tabs)/invites.tsx`, `app/(tabs)/compatibility.tsx`). A "no rows" result from `.single()` shows up as error code `PGRST116` and is treated as "not found".

**Quiz (v2, trait-based).** Full design and tuning: `docs/quiz-v2-proposal.md`; profile simulation: `node scripts/quiz-v2-simulation.js [users] [seed] [--realistic]`.
- 5 traits: `social`, `curiosity`, `organization`, `kindness`, `chill` (easygoing 100 vs intense 0). 15 main questions (3 per trait) + 5 tie-breakers (1 per trait) in `quiz_v2_questions`; 4 answers each in `quiz_v2_options` worth `points` 0-3 on the question's trait. Each aura's ideal 0-100 profile is in `animal_trait_profiles`.
- Scoring is pure, in `lib/quizV2Scoring.ts` (`evaluateQuizV2`): trait score = points / (answers × 3) × 100, aura = closest profile by Euclidean distance. If 2nd − 1st distance < 2, ask a tie-breaker on the trait where the two closest auras (after the main questions) differ most, then the next, max 3; the closest wins after that.
- `lib/quizV2Session.ts` is the session reducer used by `QuizContext` (`useReducer`): main questions and their answers are shuffled on load (A-D labels follow display order), tie-breakers are appended only when needed, and changing an earlier answer drops the tie-breakers that depended on it. Data access: `lib/supabase/quizV2.ts`.
- Results go into `user_quiz_results` with `quiz_version = 2`, `trait_scores` (jsonb, 1 decimal) and `answer_data` = `[{ question_id, option_id }]`. Then the usual `updateUserCompatibilityResults` runs.
- **v1:** older rows have `quiz_version = 1` (the default) and keep their animal. The v1 tables (`quiz_questions`, `quiz_answer_options`, `answer_animal_mapping`) are still in the database but no longer used by the app. Users whose latest result is v1 see Home's "New, more accurate quiz" banner (`components/home/QuizV2Banner.tsx`), which opens `/retake`; it's hidden after a v2 result or once dismissed (AsyncStorage, per user and device: `lib/quizV2Banner.ts`).
- Changing questions or profiles: edit the doc, re-run the simulation, regenerate/update the seed in `supabase/migrations/20261121100100_quiz_v2_seed.sql` (upserts by id) and keep `scripts/quiz-v2-simulation.js` in sync.

**Invite → compatibility flow** (some of it lives in the database, not in this repo):
1. `AccountModal` inserts a row into `invites` with `recipient_email`, plus `recipient_user_id` if a profile with that email already exists.
2. The app never inserts `notifications` rows; database triggers create them (see Notifications below). Nothing sends an email to invitees who don't have an account.
3. In `app/(tabs)/invites.tsx` (the Invites tab), accepting an invite sets its `status` and `relationship_type`, then calls the RPC `create_compatibility_results(invite_id)`.
4. After every quiz, `updateUserCompatibilityResults` runs the RPC `update_user_compatibility_results` if the user already has results, then calls `create_compatibility_results` for each accepted invite that has no `compatibility_results` row yet (matched by user pair in either order plus `relationship_type`). This also covers invites accepted before the other person took the quiz, since `create_compatibility_results` only inserts once both users have a result. Errors are logged, not thrown.
5. `compatibility.tsx` reads `compatibility_results`; the match detail shows personal insights (see below). v2 rows also show the 4 area bars and "Where you click" / "Where you clash" (`components/compatibility/AreaBreakdown.tsx`, texts in `constants/compatibilityCopy.ts`).

**Compatibility v2** (design: `docs/compatibility-v2-proposal.md`; migrations `20261122100000_compatibility_v2.sql` → `…100100_compatibility_v2_check.sql` → `…100200_compatibility_v2_rollout.sql`):
- Computed only in the database, because it needs both people's traits. `compatibility_v2_traits(user)` returns the latest v2 `trait_scores`, else the animal's `animal_trait_profiles` row as-is. `compatibility_v2_scores(a, b, type)` returns 4 areas (communication, energy, conflict, values) and the overall score. Weights and calibration are in `compatibility_v2_settings` (one row per relationship type).
- These internal functions and `compatibility_v2_refresh_pair()` have no client execute. Only the two RPCs call them; both are SECURITY DEFINER, check the caller (part of the invite / is `user_id`) and keep their old signatures. `create_compatibility_results` ignores invites that aren't `accepted`.
- `compatibility_results` stores the overall in `compatibility_score` (whole number), plus `communication_score`, `energy_score`, `conflict_score`, `values_score` and `compatibility_version` (2; v1 rows have null areas). "Conflict" is shown as "Handling conflict": high is always good.
- `lib/compatibilityV2.ts` is the pure reference implementation with the same default settings. It's also used for the UI's levels and click/clash.
- **Changing a formula or setting:** update `scripts/compatibility-v2-simulation.js`, `lib/compatibilityV2.ts` and the SQL function / settings together. Then run `node scripts/compatibility-v2-simulation.js --fixture`, which regenerates `lib/__tests__/fixtures/compatibilityV2-fixture.json` and the SQL check file, and run both checks.
- **RLS:** clients can only `select` their own `compatibility_results` rows and their own `user_quiz_results` rows. Never add a policy, view or RPC that exposes another user's `trait_scores`.

**Personal insights** (design + rules: `docs/personal-insights-proposal.md`): the match detail shows texts about the other person from the viewer's point of view (Who they are / Strengths / Challenges / 3 Tips / Your pair), via the RPC `get_personal_insights(result_id)` (`components/compatibility/PersonalInsights.tsx`, `lib/supabase/personalInsights.ts`). It replaced `compatibility_insight_templates`, which the app no longer reads.
- The RPC is SECURITY DEFINER, checks the caller is in the pair and returns finished texts only. Content tables `personal_insight_trait_texts` / `personal_insight_pair_texts` and `personal_insights_build()` have no client access.
- Content lives in `supabase/content/personal-insights/library.json`. After changing it (or the rules in `scripts/personal-insights-preview.js`, `lib/personalInsights.ts` and `personal_insights_build()`, always together), run `node scripts/personal-insights-preview.js`: it regenerates the doc's generated parts, `lib/__tests__/fixtures/personalInsights-fixture.json`, the seed and the SQL check. Then run Jest and the seed + check SQL.
- Never commit real users' insights: `--pairs` prints them to the terminal only.

The Invites tab only lists invite notifications (`invite_id` set) whose invite is still `pending`; its tab badge counts the same.

**Names:** show people through `lib/names.ts` (`getDisplayName` / `getFirstName`): full name, else the part of the email before "@", else "Someone". Select `email` alongside `full_name` when loading profiles.

**Imports:** `@/*` maps to the repo root (tsconfig paths plus babel `module-resolver`).

## Notifications

- **Table:** `public.notifications` (extended by `supabase/migrations/20261116120000_friend_notifications.sql`): `type`, `title`, `body`, `link`, `actor_id`, `data` (jsonb), `read_at`, `push_sent_at`, `email_sent_at`, plus the legacy `message`, `is_read` and `invite_id` that the Invites tab still uses. Migrations in `supabase/migrations` are run by hand in the Supabase SQL editor.
- **Created only by `SECURITY DEFINER` trigger functions:**
  - `invite_received` from `send_invite_notification()` (trigger `send_invite_notification_trigger` on `invites`). The same function still queues an `email_queue` row for invitees without an account; keep that branch when editing it.
  - `invite_accepted` from `notify_invite_accepted()` (to the inviter, when `invites.status` becomes `accepted`).
  - `match_ready` from `notify_match_ready()` (one row per user when a `compatibility_results` row is inserted; `update_user_compatibility_results` only updates rows, so retakes don't re-notify).
  - Names: first name, else the email before "@", else "Someone" (`notification_first_name()`, same rule as `lib/names.ts`). A missing score shows as `??%`. Clients can only select their own rows and update `read_at` / `is_read`; there is no client insert. IDs (`notifications.id`, `invite_id`) are `bigint`, so numbers in the app.
- **Texts** live in `constants/notificationCopy.ts`; the app renders from `type` + `data`. The triggers write the same texts into `title` / `body` as a fallback, so change both together.
- **UI:** `components/NotificationBell.tsx` sits in every tab header (unread badge, hidden at 0) and opens the hidden tab route `app/(tabs)/notifications.tsx`. Tapping a row marks it read and opens its `link` (`/compatibility` or `/invites`; anything else is ignored). There's no realtime: the list refreshes on focus, on pull and when the app returns to the foreground; `NotificationsContext` refreshes both badge counts on tab changes and on foreground.

**TODO (push and email):**
- Push: store Expo push tokens per user (e.g. a `push_tokens` table), then have an Edge Function or cron send rows `where push_sent_at is null` through the Expo push API and set `push_sent_at`.
- Email: same pattern with Resend for rows `where email_sent_at is null`, setting `email_sent_at`. Reuse `constants/notificationCopy.ts` for the texts.

## Daily aura

- Home (`app/(tabs)/index.tsx`, blocks in `components/home/`) reads `daily_aura_messages` / `daily_aura_settings`; day N of the current season shows the Nth active row by `day_index` (`lib/dailyAuraSchedule.ts`, pure, local date). Messages are cached per date in `lib/supabase/dailyAura.ts`. Home shows today only: the card (`components/home/DayMessage.tsx`) has the date on top, the witty `message` (big), then "Today's action" (`action_text`) and, smaller, why it helps (`action_why`). "Share my aura" renders `components/share/DailyAuraShareCard.tsx` with the same content. `do_text` / `dont_text` are still required columns but no longer shown. No zodiac / horoscope wording anywhere (the seed script rejects it).
- Content: each JSON row is `[message, do_text, dont_text, action_text, action_why]` (limits 110 / 40 / 40 / 60 / 160, gender-neutral; checked by the script). Season 1 is already seeded, so edits to it go through `node scripts/build-daily-aura-seed.js --update` (regenerates `supabase/migrations/20261122110100_daily_aura_season1_actions.sql` and `docs/daily-action-review.md`).
- Content drop, no app release: add `supabase/content/daily-aura/season-<n>/*.json`, run `node scripts/build-daily-aura-seed.js <n> <migration-file>.sql`, run that SQL, then `update daily_aura_settings set current_season = <n>, season_start_date = '<launch date>'`.
- Pair tips (`daily_pair_tips`, Home's matches row, "See all" = `app/(tabs)/pair-tips.tsx`) use the same rule on the other person's animal, shifted per match (`getPairTipOffsets`, hash of their user id) so same-animal matches differ. Both features fall back to the latest earlier season with content when the current `daily_aura_settings` season has none for an animal.

## Premium (design only)

No payments yet, and since the week strip was removed nothing opens `components/PaywallModal.tsx` any more (it's kept for a future entry point). The paywall's call to action inserts into `premium_interest` (insert-only RLS, so the insert uses `returning: 'minimal'`) via `lib/supabase/premium.ts` and shows a "coming soon" message. Prices are placeholders.

## Roadmap docs

`plan.md` covers auth, `plan2.md` the original (v1) quiz, `docs/quiz-v2-proposal.md` the current quiz, and `plan3.md` invites and compatibility. `plan3.md` describes invite emails and an invitee onboarding flow (sign up → pick relationship type → quiz) that isn't fully built yet.

## Conventions (from `.cursorrules`)

- Functional components only, no classes. Use the `function` keyword for pure functions. Prefer interfaces over types, and maps over enums.
- Use early returns for error cases. Name state with auxiliary verbs (`isLoading`, `hasError`).
- Use Context + `useReducer` for global state. Handle safe areas with `react-native-safe-area-context`, not hardcoded padding.
- Use reanimated / gesture-handler for animations.
- Where the rules and the code disagree, follow the code. Styling is done with `StyleSheet`, not Tailwind or styled-components, and navigation uses expo-router, not hand-built react-navigation stacks.
