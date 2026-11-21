import { supabase } from './index';
import type { TraitScores } from '@/lib/quizV2Scoring';
import type { QuizV2AnswerRecord } from './quizV2';

// v1 quiz questions/scoring were removed with quiz v2 (lib/supabase/quizV2.ts); v1 results stay valid.

export interface AnimalAura {
  id: number;
  name: string;
  icon_url: string;
  category: string;
  description: string;
  strengths: string;
  challenges: string;
  traits: string;
}

/** answer_data of a v1 result. */
export interface UserAnswer {
  question_id: number;
  selected_option: string;
}

export interface QuizResult {
  user_id: string;
  aura_id: number;
  quiz_date: string;
  answer_data: UserAnswer[] | QuizV2AnswerRecord[];
  /** 1 = original quiz, 2 = trait quiz. Missing on rows read before the v2 migration. */
  quiz_version?: number;
  /** Quiz v2 only. */
  trait_scores?: TraitScores | null;
  animal_aura?: AnimalAura;
}

// Fetch animal aura details
export async function fetchAnimalAura(auraId: number): Promise<AnimalAura> {
  const { data, error } = await supabase.from('animal_auras').select('*').eq('id', auraId).single();

  if (error) {
    console.error('Error fetching animal aura:', error);
    throw error;
  }

  return data;
}

// Fetch an animal aura by its name (case-insensitive). Returns null if none matches.
export async function fetchAnimalAuraByName(name: string): Promise<AnimalAura | null> {
  const { data, error } = await supabase
    .from<AnimalAura>('animal_auras')
    .select('*')
    .ilike('name', name)
    .limit(1);

  if (error) {
    console.error(`Error fetching animal aura "${name}":`, error);
    throw error;
  }

  return data?.[0] ?? null;
}

// Fetch user's latest quiz result
export async function fetchLatestQuizResult(userId: string): Promise<QuizResult | null> {
  const { data, error } = await supabase
    .from('user_quiz_results')
    .select('*, animal_aura:animal_auras(*)')
    .eq('user_id', userId)
    .order('quiz_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No results found
      return null;
    }
    console.error('Error fetching latest quiz result:', error);
    throw error;
  }

  return data;
}

// Update all compatibility results for a user after quiz retake
interface AcceptedInviteRow {
  id: string;
  inviter_user_id: string;
  recipient_user_id: string | null;
  relationship_type: string | null;
  status: string;
}

interface CompatibilityPairRow {
  user_a_id: string;
  user_b_id: string;
  relationship_type: string | null;
}

function getPairKey(userIdA: string, userIdB: string, relationshipType: string | null): string {
  const [first, second] = [userIdA, userIdB].sort();
  return `${first}|${second}|${relationshipType ?? ''}`;
}

/**
 * Keeps the user's compatibility results in sync after they finish the quiz:
 * 1. Recomputes the results they already have with their new aura.
 * 2. Creates results for accepted invites that don't have one yet, e.g. an
 *    invite accepted before the other person had taken the quiz.
 *
 * The quiz result is already saved when this runs, so failures are logged
 * instead of thrown and the quiz flow can continue.
 */
export async function updateUserCompatibilityResults(userId: string, newAuraId: number): Promise<void> {
  const { data: existingResults, error: existingError } = await supabase
    .from<CompatibilityPairRow>('compatibility_results')
    .select('user_a_id, user_b_id, relationship_type')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (existingError) {
    console.error('Error fetching existing compatibility results:', existingError);
    return;
  }

  const existingRows = existingResults ?? [];

  if (existingRows.length > 0) {
    const { error: updateError } = await supabase.rpc('update_user_compatibility_results', {
      user_id: userId,
      new_aura_id: newAuraId,
    });
    if (updateError) {
      console.error('Error updating compatibility results:', updateError);
    }
  }

  const { data: acceptedInvites, error: invitesError } = await supabase
    .from<AcceptedInviteRow>('invites')
    .select('id, inviter_user_id, recipient_user_id, relationship_type')
    .or(`inviter_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (invitesError) {
    console.error('Error fetching accepted invites:', invitesError);
    return;
  }

  const existingPairKeys = new Set(
    existingRows.map(row => getPairKey(row.user_a_id, row.user_b_id, row.relationship_type))
  );

  const invitesMissingResults = (acceptedInvites ?? []).filter(invite => {
    if (!invite.recipient_user_id) return false;
    const key = getPairKey(invite.inviter_user_id, invite.recipient_user_id, invite.relationship_type);
    return !existingPairKeys.has(key);
  });

  for (const invite of invitesMissingResults) {
    const { error: createError } = await supabase.rpc('create_compatibility_results', {
      invite_id: invite.id,
    });
    if (createError) {
      console.error(`Error creating compatibility results for invite ${invite.id}:`, createError);
    }
  }
}
