/**
 * How people are named in the app, and in the notification triggers
 * (public.notification_first_name in supabase/migrations). Keep both in sync:
 * full name, else the part of the email before "@", else "Someone".
 */

export const FALLBACK_NAME = 'Someone';

/** "test4@example.com" -> "test4". Null when there's nothing before "@". */
export function getEmailName(email: string | null | undefined): string | null {
  const name = email?.split('@')[0]?.trim();
  return name ? name : null;
}

/** Full name for lists and cards: "Lina Ben Salah", else "test4", else "Someone". */
export function getDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  return fullName?.trim() || getEmailName(email) || FALLBACK_NAME;
}

/** First name for short texts: "Lina", else "test4", else "Someone". */
export function getFirstName(fullName: string | null | undefined, email: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || getEmailName(email) || FALLBACK_NAME;
}
