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
  // Get the mapping data to calculate scores for each animal aura category
  const { data: mappings, error } = await supabase
    .from('answer_aura_mapping')
    .select('*')
    .in(
      'question_id',
      userAnswers.map((answer) => answer.question_id)
    );

  if (error) {
    console.error('Error fetching answer mappings:', error);
    throw error;
  }

  // Calculate scores for each category
  const categoryScores: Record<string, number> = {
    'Extroverted/Social': 0,
    'Balanced/Adaptive': 0,
    'Introverted/Strategic': 0,
  };

  userAnswers.forEach((answer) => {
    const mapping = mappings.find(
      (m) => m.question_id === answer.question_id && m.option_key === answer.selected_option
    );

    if (mapping) {
      categoryScores[mapping.aura_category] += mapping.aura_weight;
    }
  });

  // Find the dominant category
  let dominantCategory = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b
  );

  // Get a random animal aura from the dominant category
  const { data: auras, error: aurasError } = await supabase
    .from('animal_auras')
    .select('id')
    .eq('category', dominantCategory);

  if (aurasError) {
    console.error('Error fetching animal auras:', aurasError);
    throw aurasError;
  }

  // Randomly select one of the auras from the dominant category
  const randomIndex = Math.floor(Math.random() * auras.length);
  return auras[randomIndex].id;
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