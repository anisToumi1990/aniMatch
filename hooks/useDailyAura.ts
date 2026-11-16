import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/context/QuizContext';
import { fetchLatestQuizResult } from '@/lib/supabase/quiz';
import { DailyAuraMessage, fetchTodayAuraMessage } from '@/lib/supabase/dailyAura';
import { msUntilNextLocalMidnight, toLocalDateString } from '@/lib/dailyAuraSchedule';

export interface DailyAuraAura {
  id: number;
  name: string;
}

export type DailyAuraState =
  | { status: 'loading' }
  /** No quiz result yet: show the teaser. */
  | { status: 'locked' }
  | { status: 'ready'; aura: DailyAuraAura; message: DailyAuraMessage }
  /** The user has an aura, but the current season has no message for it. */
  | { status: 'empty'; aura: DailyAuraAura }
  | { status: 'error'; aura: DailyAuraAura | null };

/**
 * Today's aura message for the signed-in user. Uses the quiz context's aura
 * when it has one (e.g. right after a quiz), otherwise the latest saved result.
 * The message itself is cached per day in lib/supabase/dailyAura.ts; this hook
 * only re-checks the date on focus, on foreground and at local midnight.
 */
export function useDailyAura() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { animalAura: contextAura } = useQuiz();
  const [savedAura, setSavedAura] = useState<DailyAuraAura | null | undefined>(undefined);
  const [localDate, setLocalDate] = useState(() => toLocalDateString());
  const [state, setState] = useState<DailyAuraState>({ status: 'loading' });
  const [reloadCount, setReloadCount] = useState(0);
  const requestIdRef = useRef(0);

  const aura: DailyAuraAura | null | undefined = contextAura
    ? { id: contextAura.id, name: contextAura.name }
    : savedAura;

  // Latest saved aura, when the quiz context doesn't have one.
  useEffect(() => {
    if (!userId) {
      setSavedAura(null);
      return;
    }
    if (contextAura) return;
    let isCancelled = false;
    setSavedAura(undefined);
    fetchLatestQuizResult(userId)
      .then(result => {
        if (isCancelled) return;
        const saved = result?.animal_aura;
        setSavedAura(saved ? { id: saved.id, name: saved.name } : null);
      })
      .catch(error => {
        console.error('Error loading aura for daily message:', error);
        if (!isCancelled) setState({ status: 'error', aura: null });
      });
    return () => {
      isCancelled = true;
    };
  }, [userId, contextAura, reloadCount]);

  const isAuraPending = aura === undefined;
  const auraId = aura?.id ?? null;
  const auraName = aura?.name ?? null;

  // Today's message (cached per day, so this is cheap after the first load).
  useEffect(() => {
    if (isAuraPending) {
      setState(current => (current.status === 'error' ? current : { status: 'loading' }));
      return;
    }
    if (auraId === null || auraName === null) {
      setState({ status: 'locked' });
      return;
    }
    const requestId = ++requestIdRef.current;
    const currentAura = { id: auraId, name: auraName };
    setState(current => (current.status === 'ready' && current.aura.id === auraId && current.message.localDate === localDate
      ? current
      : { status: 'loading' }));
    fetchTodayAuraMessage(auraId)
      .then(message => {
        if (requestId !== requestIdRef.current) return;
        setState(message ? { status: 'ready', aura: currentAura, message } : { status: 'empty', aura: currentAura });
      })
      .catch(error => {
        console.error('Error loading daily aura message:', error);
        if (requestId === requestIdRef.current) setState({ status: 'error', aura: currentAura });
      });
  }, [auraId, auraName, isAuraPending, localDate, reloadCount]);

  const refreshDate = useCallback(() => {
    setLocalDate(current => {
      const today = toLocalDateString();
      return today === current ? current : today;
    });
  }, []);

  // New day: on focus, when the app returns to the foreground, and at local midnight.
  useFocusEffect(refreshDate);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', appState => {
      if (appState === 'active') refreshDate();
    });
    return () => subscription.remove();
  }, [refreshDate]);
  useEffect(() => {
    const timeout = setTimeout(refreshDate, msUntilNextLocalMidnight());
    return () => clearTimeout(timeout);
  }, [localDate, refreshDate]);

  const retry = useCallback(() => setReloadCount(count => count + 1), []);

  return { state, retry };
}
