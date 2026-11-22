import { supabase } from '@/lib/supabase';
import { PersonalInsights, parsePersonalInsights } from '@/lib/personalInsights';

/**
 * Personal insights for one of the signed-in user's matches, via the RPC
 * get_personal_insights (supabase/migrations/20261122120000_personal_insights.sql;
 * v2 response since 20261123100000_pair_insights.sql).
 * The database picks and fills the texts; the app never sees trait scores.
 * Resolves to null when either person has no quiz result (or the shape is unexpected).
 */
export async function fetchPersonalInsights(resultId: number | string): Promise<PersonalInsights | null> {
  const { data, error } = await supabase.rpc('get_personal_insights', { p_result_id: Number(resultId) });
  if (error) throw error;
  return parsePersonalInsights(data);
}
