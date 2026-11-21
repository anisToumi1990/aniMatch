import { supabase } from './index';
import { QuizResult } from './quiz';
import { AnimalTraitProfile, QuizV2Trait, TraitScores, isQuizV2Trait } from '@/lib/quizV2Scoring';

export const QUIZ_V2_VERSION = 2;

export interface QuizV2Option {
  id: number;
  text: string;
  points: number;
}

export interface QuizV2Question {
  id: number;
  trait: QuizV2Trait;
  text: string;
  isTiebreaker: boolean;
  sortOrder: number;
  options: QuizV2Option[];
}

/** What's saved in user_quiz_results.answer_data for v2. */
export interface QuizV2AnswerRecord {
  question_id: number;
  option_id: number;
}

interface QuestionRow {
  id: number;
  trait: string;
  text: string;
  is_tiebreaker: boolean;
  sort_order: number;
  options: QuizV2Option[] | null;
}

interface ProfileRow {
  aura_id: number;
  social: number;
  curiosity: number;
  organization: number;
  kindness: number;
  chill: number;
}

/** All v2 questions (main + tie-breakers) with their options, in sort order. */
export async function fetchQuizV2Questions(): Promise<QuizV2Question[]> {
  const { data, error } = await supabase
    .from<QuestionRow>('quiz_v2_questions')
    .select('id, trait, text, is_tiebreaker, sort_order, options:quiz_v2_options(id, text, points)')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching quiz v2 questions:', error);
    throw error;
  }

  return (data ?? []).flatMap(row => {
    if (!isQuizV2Trait(row.trait)) {
      console.warn(`Skipping quiz v2 question ${row.id}: unknown trait "${row.trait}"`);
      return [];
    }
    return [
      {
        id: row.id,
        trait: row.trait,
        text: row.text,
        isTiebreaker: row.is_tiebreaker,
        sortOrder: row.sort_order,
        options: row.options ?? [],
      },
    ];
  });
}

export async function fetchAnimalTraitProfiles(): Promise<AnimalTraitProfile[]> {
  const { data, error } = await supabase
    .from<ProfileRow>('animal_trait_profiles')
    .select('aura_id, social, curiosity, organization, kindness, chill');

  if (error) {
    console.error('Error fetching animal trait profiles:', error);
    throw error;
  }

  return (data ?? []).map(row => ({
    auraId: row.aura_id,
    scores: {
      social: row.social,
      curiosity: row.curiosity,
      organization: row.organization,
      kindness: row.kindness,
      chill: row.chill,
    },
  }));
}

export async function submitQuizV2Result(
  userId: string,
  auraId: number,
  answers: QuizV2AnswerRecord[],
  traitScores: TraitScores
): Promise<QuizResult> {
  const { data, error } = await supabase
    .from('user_quiz_results')
    .insert({
      user_id: userId,
      aura_id: auraId,
      quiz_date: new Date().toISOString(),
      answer_data: answers,
      quiz_version: QUIZ_V2_VERSION,
      trait_scores: traitScores,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error submitting quiz v2 result:', error);
    throw error;
  }

  return data;
}
