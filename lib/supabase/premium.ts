import { supabase } from '@/lib/supabase';

export type PremiumPlan = 'yearly' | 'monthly';

/** Where the paywall was opened from (kept short; the DB checks the length). */
export type PremiumSource = 'week_strip';

/**
 * Records a tap on the paywall's call to action in premium_interest. No real
 * payment exists yet. Clients can insert their own rows but not read them, so
 * the insert must not ask for the row back (returning: 'minimal').
 */
export async function recordPremiumInterest(userId: string, source: PremiumSource, plan: PremiumPlan): Promise<void> {
  const { error } = await supabase
    .from('premium_interest')
    .insert({ user_id: userId, source, plan }, { returning: 'minimal' });
  if (error) throw error;
}
