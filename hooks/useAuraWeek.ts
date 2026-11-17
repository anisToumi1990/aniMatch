import { useCallback, useEffect, useMemo, useState } from 'react';
import { DailyAuraMessage, fetchAuraMessageForDate, getDailyAuraSettings } from '@/lib/supabase/dailyAura';
import { buildAuraWeek, WeekDay } from '@/lib/auraWeek';
import { toLocalDateString } from '@/lib/dailyAuraSchedule';

export type SelectedDayState =
  | { status: 'loading' }
  | { status: 'ready'; message: DailyAuraMessage }
  /** No message for this aura on that day. */
  | { status: 'empty' }
  | { status: 'error' };

/**
 * Home's week strip: the 7 days around today and the message of the selected
 * day (today by default). Messages are cached per date in lib/supabase/dailyAura.ts.
 * `today` comes from the caller so the strip moves on at local midnight.
 */
export function useAuraWeek(auraId: number | null, today: string = toLocalDateString()) {
  const [seasonStartDate, setSeasonStartDate] = useState<string | null>(null);
  // The tapped day, remembered for the day it was tapped on: a new day starts on today again.
  const [selection, setSelection] = useState<{ date: string; onDay: string } | null>(null);
  const selectedDate = selection && selection.onDay === today ? selection.date : today;
  const [result, setResult] = useState<{ key: string; state: SelectedDayState } | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${auraId}|${selectedDate}|${reloadCount}`;
  // Loading until the result for the current request arrives.
  const state: SelectedDayState = result?.key === requestKey ? result.state : { status: 'loading' };

  useEffect(() => {
    if (auraId === null) return;
    let isCancelled = false;
    getDailyAuraSettings()
      .then(settings => {
        if (!isCancelled) setSeasonStartDate(settings.seasonStartDate);
      })
      .catch(error => console.error('Error loading daily aura settings:', error));
    return () => {
      isCancelled = true;
    };
  }, [auraId, today, reloadCount]);

  useEffect(() => {
    if (auraId === null) return;
    let isCancelled = false;
    fetchAuraMessageForDate(auraId, selectedDate)
      .then(message => {
        if (!isCancelled) setResult({ key: requestKey, state: message ? { status: 'ready', message } : { status: 'empty' } });
      })
      .catch(error => {
        console.error('Error loading aura message for', selectedDate, error);
        if (!isCancelled) setResult({ key: requestKey, state: { status: 'error' } });
      });
    return () => {
      isCancelled = true;
    };
  }, [auraId, selectedDate, requestKey]);

  const days: WeekDay[] = useMemo(() => {
    const [year, month, day] = today.split('-').map(Number);
    return buildAuraWeek(new Date(year, month - 1, day), seasonStartDate);
  }, [today, seasonStartDate]);

  const selectDate = useCallback((localDate: string) => setSelection({ date: localDate, onDay: today }), [today]);
  const retry = useCallback(() => setReloadCount(count => count + 1), []);

  return { days, selectedDate, selectDate, state, retry, isToday: selectedDate === today };
}
