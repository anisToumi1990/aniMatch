/**
 * Each aura animal's emoji, keyed by lowercase name. Mirrored in SQL by
 * public.notification_aura_emoji() (supabase/migrations); keep both in sync.
 */
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

/** The animal's emoji (case-insensitive), or ✨ when unknown. */
export function getAuraEmoji(animalName: string | null | undefined): string {
  if (!animalName) return '✨';
  return AURA_EMOJI[animalName.trim().toLowerCase()] ?? '✨';
}
