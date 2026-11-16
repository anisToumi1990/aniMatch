import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDailyMessagePosition, toLocalDateString } from '@/lib/dailyAuraSchedule';

export { getDailyMessagePosition, toLocalDateString } from '@/lib/dailyAuraSchedule';

/** Today's message for one animal. */
export interface DailyAuraMessage {
  id: number;
  auraId: number;
  season: number;
  dayIndex: number;
  message: string;
  doText: string;
  dontText: string;
  /** The local date ("YYYY-MM-DD") this message is for. */
  localDate: string;
}

export interface DailyAuraSettings {
  currentSeason: number;
  /** "YYYY-MM-DD" */
  seasonStartDate: string;
}

interface CachedEntry {
  auraId: number;
  localDate: string;
  /** null = no content for this aura today (also worth caching). */
  message: DailyAuraMessage | null;
}

const CACHE_KEY = 'animatch.dailyAura.v1';
let memoryCache: CachedEntry | null = null;

async function readCache(auraId: number, localDate: string): Promise<CachedEntry | null> {
  if (memoryCache?.auraId === auraId && memoryCache.localDate === localDate) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedEntry;
    if (entry.auraId !== auraId || entry.localDate !== localDate) return null;
    memoryCache = entry;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(entry: CachedEntry): Promise<void> {
  memoryCache = entry;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // The memory cache is enough for this session.
  }
}

/** Drops the cached message (e.g. to force a reload after an error). */
export function clearDailyAuraCache(): void {
  memoryCache = null;
  AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

/** The single row of daily_aura_settings. */
export async function fetchDailyAuraSettings(): Promise<DailyAuraSettings> {
  const { data, error } = await supabase
    .from('daily_aura_settings')
    .select('current_season, season_start_date')
    .limit(1)
    .single();
  if (error) throw error;
  return { currentSeason: data.current_season, seasonStartDate: data.season_start_date };
}

/**
 * Today's message for an aura (by animal_auras.id), using the user's local date.
 * Cached for the day (memory + AsyncStorage), so repeated calls don't refetch.
 * Resolves to null when the current season has no active message for this aura.
 */
export async function fetchTodayAuraMessage(auraId: number, now: Date = new Date()): Promise<DailyAuraMessage | null> {
  const localDate = toLocalDateString(now);
  const cached = await readCache(auraId, localDate);
  if (cached) return cached.message;

  const settings = await fetchDailyAuraSettings();

  const { count, error: countError } = await supabase
    .from('daily_aura_messages')
    .select('id', { count: 'exact', head: true })
    .eq('aura_id', auraId)
    .eq('season', settings.currentSeason)
    .eq('is_active', true);
  if (countError) throw countError;

  const position = getDailyMessagePosition({
    seasonStartDate: settings.seasonStartDate,
    localDate,
    messageCount: count ?? 0,
  });
  if (position === null) {
    await writeCache({ auraId, localDate, message: null });
    return null;
  }

  const { data, error } = await supabase
    .from('daily_aura_messages')
    .select('id, aura_id, season, day_index, message, do_text, dont_text')
    .eq('aura_id', auraId)
    .eq('season', settings.currentSeason)
    .eq('is_active', true)
    .order('day_index', { ascending: true })
    .range(position, position);
  if (error) throw error;

  const row = data?.[0];
  const message: DailyAuraMessage | null = row
    ? {
        id: row.id,
        auraId: row.aura_id,
        season: row.season,
        dayIndex: row.day_index,
        message: row.message,
        doText: row.do_text,
        dontText: row.dont_text,
        localDate,
      }
    : null;
  await writeCache({ auraId, localDate, message });
  return message;
}
