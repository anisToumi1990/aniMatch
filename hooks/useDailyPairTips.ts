import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { PairMatch, fetchPairMatches, fetchTodayPairTips, fillTipName } from '@/lib/supabase/dailyPairTips';
import { msUntilNextLocalMidnight, toLocalDateString } from '@/lib/dailyAuraSchedule';

/** A match with today's tip, {name} already filled in (null when there's no tip). */
export interface PairTipItem extends PairMatch {
  tip: string | null;
}

export type DailyPairTipsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: PairTipItem[] };

/** Matches can change during the day (new results), so they're re-checked on focus, at most this often. */
const MATCHES_REFRESH_MS = 60 * 1000;

interface LoadedItems {
  userId: string;
  localDate: string;
  at: number;
  items: PairTipItem[];
}

/**
 * Last result, shared by every screen using the hook (Home and "See all") and
 * kept across remounts, so switching tabs doesn't refetch.
 */
let lastLoaded: LoadedItems | null = null;

function getFreshItems(userId: string | null): PairTipItem[] | null {
  if (!userId || !lastLoaded) return null;
  const isFresh =
    lastLoaded.userId === userId &&
    lastLoaded.localDate === toLocalDateString() &&
    Date.now() - lastLoaded.at < MATCHES_REFRESH_MS;
  return isFresh ? lastLoaded.items : null;
}

/**
 * Today's pair tips for the signed-in user's matches. Tips are cached per day
 * (lib/supabase/dailyPairTips.ts); the match list is re-checked on focus,
 * on foreground and at local midnight.
 */
export function useDailyPairTips(isEnabled: boolean = true) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<DailyPairTipsState>(() => {
    const items = getFreshItems(userId);
    return items ? { status: 'ready', items } : { status: 'loading' };
  });
  const requestIdRef = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!userId || !isEnabled) return;
    const freshItems = force ? null : getFreshItems(userId);
    if (freshItems) {
      setState(current => (current.status === 'ready' && current.items === freshItems ? current : { status: 'ready', items: freshItems }));
      return;
    }

    const localDate = toLocalDateString();
    const requestId = ++requestIdRef.current;
    setState(current => (current.status === 'ready' ? current : { status: 'loading' }));
    try {
      const matches = await fetchPairMatches(userId);
      const tips = await fetchTodayPairTips(matches);
      const items = matches.map(match => {
        const template = tips.get(match.otherUserId) ?? null;
        return { ...match, tip: template ? fillTipName(template, match.firstName) : null };
      });
      lastLoaded = { userId, localDate, at: Date.now(), items };
      if (requestId !== requestIdRef.current) return;
      setState({ status: 'ready', items });
    } catch (error) {
      console.error('Error loading daily pair tips:', error);
      if (requestId === requestIdRef.current) setState({ status: 'error' });
    }
  }, [userId, isEnabled]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', appState => {
      if (appState === 'active') load();
    });
    return () => subscription.remove();
  }, [load]);

  // New tips at local midnight.
  useEffect(() => {
    if (!isEnabled) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        load(true);
        schedule();
      }, msUntilNextLocalMidnight());
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [isEnabled, load]);

  const retry = useCallback(() => load(true), [load]);

  return { state, retry };
}
