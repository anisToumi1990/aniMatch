import { supabase } from './index';

// Types for quiz data
export interface QuizQuestion {
  id: number;
  question_text: string;
  display_order: number;
}

export interface QuizAnswerOption {
  id: number;
  question_id: number;
  option_text: string;
  option_key: string;
}

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

export interface UserAnswer {
  question_id: number;
  selected_option: string;
}

export interface QuizResult {
  user_id: string;
  aura_id: number;
  quiz_date: string;
  answer_data: UserAnswer[];
  animal_aura?: AnimalAura;
}

// Fetch all quiz questions in display order
export async function fetchQuizQuestions(): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching quiz questions:', error);
    throw error;
  }

  return data || [];
}

// Fetch answer options for a specific question
export async function fetchAnswerOptions(questionId: number): Promise<QuizAnswerOption[]> {
  const { data, error } = await supabase
    .from('quiz_answer_options')
    .select('*')
    .eq('question_id', questionId)
    .order('option_key', { ascending: true });

  if (error) {
    console.error('Error fetching answer options:', error);
    throw error;
  }

  return data || [];
}

// Calculate the result based on user answers
export async function calculateQuizResult(userAnswers: UserAnswer[]): Promise<number> {
  // Get the mapping data to calculate scores for each animal directly
  const { data: mappings, error } = await supabase
    .from('answer_animal_mapping')
    .select('*')
    .in(
      'question_id',
      userAnswers.map((answer) => answer.question_id)
    );

  if (error) {
    console.error('Error fetching answer mappings:', error);
    throw error;
  }

  // Calculate scores for each animal
  const animalScores: Record<number, number> = {};

  // Initialize scores for all animals to zero
  const { data: allAnimals, error: animalsError } = await supabase
    .from('animal_auras')
    .select('id');
  
  if (animalsError) {
    console.error('Error fetching animals:', animalsError);
    throw animalsError;
  }
  
  allAnimals.forEach(animal => {
    animalScores[animal.id] = 0;
  });

  // Calculate the scores based on user answers
  userAnswers.forEach((answer) => {
    const matchingMappings = mappings.filter(
      (m) => m.question_id === answer.question_id && m.option_key === answer.selected_option
    );

    matchingMappings.forEach(mapping => {
      animalScores[mapping.animal_aura_id] += mapping.animal_weight;
    });
  });

  // Find the animal with the highest score
  let highestScore = 0;
  let dominantAnimalId = 0;

  Object.entries(animalScores).forEach(([animalId, score]) => {
    if (score > highestScore) {
      highestScore = score;
      dominantAnimalId = parseInt(animalId);
    }
  });

  return dominantAnimalId;
}

// Submit quiz results to the database
export async function submitQuizResult(
  userId: string,
  auraId: number,
  answers: UserAnswer[]
): Promise<QuizResult> {
  const quizResult = {
    user_id: userId,
    aura_id: auraId,
    quiz_date: new Date().toISOString(),
    answer_data: answers,
  };

  const { data, error } = await supabase.from('user_quiz_results').insert(quizResult).select('*').single();

  if (error) {
    console.error('Error submitting quiz result:', error);
    throw error;
  }

  return data;
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
