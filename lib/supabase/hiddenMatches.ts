import { supabase } from '@/lib/supabase';

/** Listeners called after the user hides or shows a match (e.g. to refresh Home's matches). */
const listeners = new Set<() => void>();

/** Subscribes to hide / show changes. Returns the unsubscribe function. */
export function onHiddenMatchesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange() {
  listeners.forEach(listener => listener());
}

/** Ids of the compatibility results the user has hidden (only for them). */
export async function fetchHiddenMatchIds(userId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('hidden_matches')
    .select('compatibility_result_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((row: { compatibility_result_id: number }) => Number(row.compatibility_result_id)));
}

/** Hides a match for the user. Hiding it twice is fine. */
export async function hideMatch(userId: string, resultId: number): Promise<void> {
  const { error } = await supabase
    .from('hidden_matches')
    .insert({ user_id: userId, compatibility_result_id: resultId }, { returning: 'minimal' });
  // 23505: already hidden.
  if (error && error.code !== '23505') throw error;
  notifyChange();
}

/** Shows a hidden match again. */
export async function unhideMatch(userId: string, resultId: number): Promise<void> {
  const { error } = await supabase
    .from('hidden_matches')
    .delete({ returning: 'minimal' })
    .eq('user_id', userId)
    .eq('compatibility_result_id', resultId);
  if (error) throw error;
  notifyChange();
}
