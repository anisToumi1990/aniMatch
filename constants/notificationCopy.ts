/**
 * All notification texts, in one place so in-app, push and email can share
 * them. The app renders notifications from here using `type` + `data`.
 *
 * The database triggers (supabase/migrations/*_friend_notifications.sql) also
 * write the same texts into notifications.title / body, as a fallback for
 * other clients. If you change a text here, change it there too.
 */

export type NotificationType = 'invite_received' | 'invite_accepted' | 'match_ready';

/** Values the triggers store in notifications.data. All optional. */
export interface NotificationData {
  /** First name of the other person ("Someone" when unknown). */
  actor_name?: string | null;
  /** The other person's aura animal, e.g. "Fox", when known. */
  actor_animal?: string | null;
  /** Compatibility score 0-100 (match_ready). */
  score?: number | null;
  relationship_type?: string | null;
  invite_id?: number | null;
  compatibility_result_id?: number | null;
}

export interface NotificationText {
  title: string;
  body: string;
}

/** Each aura animal's emoji, keyed by lowercase name. */
export const AURA_EMOJI: Record<string, string> = {
  bear: '🐻',
  cat: '🐱',
  deer: '🦌',
  dolphin: '🐬',
  eagle: '🦅',
  elephant: '🐘',
  fox: '🦊',
  lion: '🦁',
  otter: '🦦',
  owl: '🦉',
  parrot: '🦜',
  peacock: '🦚',
  snake: '🐍',
  unicorn: '🦄',
  wolf: '🐺',
};

export const FALLBACK_NAME = 'Someone';

function getAuraEmoji(animal: string | null | undefined): string {
  if (!animal) return '✨';
  return AURA_EMOJI[animal.trim().toLowerCase()] ?? '✨';
}

/** "a Fox", "an Owl" */
function withArticle(animal: string): string {
  return /^[aeiou]/i.test(animal) ? `an ${animal}` : `a ${animal}`;
}

const COPY: Record<NotificationType, (data: NotificationData) => NotificationText> = {
  invite_received: data => ({
    title: 'New invite 👀',
    body: `${data.actor_name || FALLBACK_NAME} wants to know how you two match. Brave. 👀`,
  }),
  invite_accepted: data => ({
    title: `Invite accepted ${getAuraEmoji(data.actor_animal)}`,
    body: `${data.actor_name || FALLBACK_NAME} said yes. Now the quiz decides your fate.`,
  }),
  match_ready: data => {
    const animal = data.actor_animal?.trim();
    // Same as the SQL: a missing score shows as ??%.
    const score = typeof data.score === 'number' ? `${Math.round(data.score)}%` : '??%';
    return {
      title: `Your match is in ${getAuraEmoji(animal)}`,
      body: `${data.actor_name || FALLBACK_NAME} is ${animal ? withArticle(animal) : 'a mystery'}. You two? ${score}. Go see why 👀`,
    };
  },
};

export function isNotificationType(type: string | null | undefined): type is NotificationType {
  return type === 'invite_received' || type === 'invite_accepted' || type === 'match_ready';
}

/** Title and body for a notification type, filled in with its data. */
export function getNotificationText(type: NotificationType, data: NotificationData = {}): NotificationText {
  return COPY[type](data);
}
