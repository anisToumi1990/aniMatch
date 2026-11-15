# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AniMatch ("animatchaura") is an Expo SDK 53 / React Native 0.79 app using expo-router and TypeScript (strict), with Supabase as the backend. Users take a 10-question personality quiz that matches them to one of 15 "Animal Auras", invite other users, and see how compatible their auras are for a chosen relationship type (Lover / Business Partner / Family).

## Commands

- **Run the app:** `npx expo start --offline`
- **iOS simulator:** Device Hub (Xcode 27), with Expo Go for SDK 53 installed manually on it. Don't expect `expo start --ios` to install or upgrade Expo Go for you.
- **Lint:** `npm run lint` (`expo lint`)
- **Tests:** `npm test` (jest-expo, runs in `--watchAll` mode). Run one test file without watching: `npx jest components/__tests__/ThemedText-test.tsx`. The only test right now is the template snapshot test.
- **Type-check:** `npx tsc --noEmit`

## Environment

- `.env` needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `lib/supabase/index.ts` throws at import time if either one is missing.
- **Never commit `.env`.** Don't stage it, even if `git add -A` or `git status` shows it.

## Architecture

**Routing and auth gate.** `app/_layout.tsx` nests the providers in this order: `SafeAreaProvider` → `AuthProvider` → `QuizProvider` → `NotificationsProvider`. Inside them, `AuthGuard` redirects based on `useSegments()`:
- no session → `(auth)/login`
- session but email not confirmed → `(verification)`
- confirmed → `(tabs)`

Any new top-level route group has to be accounted for in `AuthGuard`, or users will get bounced away from it. Sign-in with Google or Apple uses `expo-auth-session` / `WebBrowser` with the redirect `animatchaura://auth/callback` (`app/auth/callback.tsx`).

**Supabase JS is v1 (`^1.35`), not v2.** Use the v1 API: `supabase.auth.session()`, `supabase.auth.signIn({ provider })`, and `onAuthStateChange` returning `{ data: subscription }`. Most v2 examples online won't work here.

**Data access is split.** Quiz logic lives in `lib/supabase/quiz.ts`. Invites, notifications, profiles and compatibility are queried directly inside screens and components (`components/AccountModal.tsx`, `app/(tabs)/notifications.tsx`, `app/(tabs)/compatibility.tsx`, `context/NotificationsContext.tsx`). A "no rows" result from `.single()` shows up as error code `PGRST116` and is treated as "not found".

**Quiz scoring** (`calculateQuizResult`): each answer is matched by `(question_id, option_key)` against `answer_animal_mapping` rows. Each matching row adds its `animal_weight` to that row's `animal_aura_id`, and the aura with the highest total wins. Results go into `user_quiz_results`; `answer_data` is stored as JSON. `QuizContext` (a `useReducer` store) drives the quiz flow and loads the user's latest result.

**Invite → compatibility flow** (some of it lives in the database, not in this repo):
1. `AccountModal` inserts a row into `invites` with `recipient_email`, plus `recipient_user_id` if a profile with that email already exists.
2. The app never inserts `notifications` rows; something on the database side (presumably a trigger) creates them. Nothing sends an email to invitees who don't have an account.
3. In `notifications.tsx`, accepting an invite sets its `status` and `relationship_type`, then calls the RPC `create_compatibility_results(invite_id)`.
4. After every quiz, `updateUserCompatibilityResults` runs the RPC `update_user_compatibility_results` if the user already has results, then calls `create_compatibility_results` for each accepted invite that has no `compatibility_results` row yet (matched by user pair in either order plus `relationship_type`). This also covers invites accepted before the other person took the quiz, since `create_compatibility_results` only inserts once both users have a result. Errors are logged, not thrown.
5. `compatibility.tsx` reads `compatibility_results` and matches up text from `compatibility_insight_templates` by score and relationship type.

The invite screens treat notifications for invites that are no longer `pending` as handled, and both the list and the unread badge hide them.

**Imports:** `@/*` maps to the repo root (tsconfig paths plus babel `module-resolver`).

## Roadmap docs

`plan.md` covers auth, `plan2.md` the quiz, and `plan3.md` invites and compatibility. `plan3.md` describes invite emails and an invitee onboarding flow (sign up → pick relationship type → quiz) that isn't fully built yet.

## Conventions (from `.cursorrules`)

- Functional components only, no classes. Use the `function` keyword for pure functions. Prefer interfaces over types, and maps over enums.
- Use early returns for error cases. Name state with auxiliary verbs (`isLoading`, `hasError`).
- Use Context + `useReducer` for global state. Handle safe areas with `react-native-safe-area-context`, not hardcoded padding.
- Use reanimated / gesture-handler for animations.
- Where the rules and the code disagree, follow the code. Styling is done with `StyleSheet`, not Tailwind or styled-components, and navigation uses expo-router, not hand-built react-navigation stacks.
