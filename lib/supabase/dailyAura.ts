import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { daysBetween, getDailyMessagePosition, toLocalDateString } from '@/lib/dailyAuraSchedule';

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

/** Message per "auraId|YYYY-MM-DD"; null = no content for that aura on that day. */
type MessageCache = Record<string, DailyAuraMessage | null>;

const CACHE_KEY = 'animatch.dailyAura.v2';
/** Days kept in the cache (the week strip shows 4 past days + today). */
const CACHE_DAYS = 10;
let memoryCache: MessageCache | null = null;

const cacheKey = (auraId: number, localDate: string) => `${auraId}|${localDate}`;

async function loadCache(): Promise<MessageCache> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    memoryCache = raw ? (JSON.parse(raw) as MessageCache) : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

async function saveToCache(auraId: number, localDate: string, message: DailyAuraMessage | null): Promise<void> {
  const cache = { ...(await loadCache()), [cacheKey(auraId, localDate)]: message };
  // Drop days that are too old to be shown again.
  const today = toLocalDateString();
  Object.keys(cache).forEach(key => {
    const date = key.split('|')[1];
    if (!date || daysBetween(date, today) > CACHE_DAYS) delete cache[key];
  });
  memoryCache = cache;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The memory cache is enough for this session.
  }
}

/** Drops the cached messages (e.g. to force a reload after an error). */
export function clearDailyAuraCache(): void {
  memoryCache = null;
  settingsMemo = null;
  seasonMemo.clear();
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

async function countActiveMessages(auraId: number, season: number): Promise<number> {
  const { count, error } = await supabase
    .from('daily_aura_messages')
    .select('id', { count: 'exact', head: true })
    .eq('aura_id', auraId)
    .eq('season', season)
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

/** The highest season before `beforeSeason` with an active message for this aura, or null. */
async function findLatestSeasonWithMessages(auraId: number, beforeSeason: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('daily_aura_messages')
    .select('season')
    .eq('aura_id', auraId)
    .lt('season', beforeSeason)
    .eq('is_active', true)
    .order('season', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.season ?? null;
}

let settingsMemo: { day: string; promise: Promise<DailyAuraSettings> } | null = null;
/** "auraId|day" -> resolved season and its active message count (fallback applied). */
const seasonMemo = new Map<string, Promise<{ season: number; count: number }>>();

/** daily_aura_settings, fetched once per local day. */
export function getDailyAuraSettings(): Promise<DailyAuraSettings> {
  const day = toLocalDateString();
  if (!settingsMemo || settingsMemo.day !== day) {
    const promise = fetchDailyAuraSettings();
    promise.catch(() => {
      if (settingsMemo?.promise === promise) settingsMemo = null;
    });
    settingsMemo = { day, promise };
  }
  return settingsMemo.promise;
}

/** The season to read for this aura (current, else the latest earlier one with messages). */
function resolveSeason(auraId: number, settings: DailyAuraSettings): Promise<{ season: number; count: number }> {
  const key = `${auraId}|${toLocalDateString()}|${settings.currentSeason}`;
  let promise = seasonMemo.get(key);
  if (!promise) {
    promise = (async () => {
      let season = settings.currentSeason;
      let count = await countActiveMessages(auraId, season);
      // No messages for this animal in the current season (e.g. a drop that
      // skipped it): use the latest earlier season that has some.
      if (count === 0) {
        const fallbackSeason = await findLatestSeasonWithMessages(auraId, season);
        if (fallbackSeason !== null) {
          season = fallbackSeason;
          count = await countActiveMessages(auraId, season);
        }
      }
      return { season, count };
    })();
    promise.catch(() => seasonMemo.delete(key));
    seasonMemo.set(key, promise);
  }
  return promise;
}

/**
 * The message for an aura on a given local date ("YYYY-MM-DD"), same day rule
 * as today's (lib/dailyAuraSchedule.ts). Cached per date (memory + AsyncStorage).
 * Resolves to null when no season has a message for this aura.
 */
export async function fetchAuraMessageForDate(auraId: number, localDate: string): Promise<DailyAuraMessage | null> {
  const cache = await loadCache();
  const key = cacheKey(auraId, localDate);
  if (key in cache) return cache[key];

  const settings = await getDailyAuraSettings();
  const { season, count } = await resolveSeason(auraId, settings);
  const position = getDailyMessagePosition({ seasonStartDate: settings.seasonStartDate, localDate, messageCount: count });
  if (position === null) {
    await saveToCache(auraId, localDate, null);
    return null;
  }

  const { data, error } = await supabase
    .from('daily_aura_messages')
    .select('id, aura_id, season, day_index, message, do_text, dont_text')
    .eq('aura_id', auraId)
    .eq('season', season)
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
  await saveToCache(auraId, localDate, message);
  return message;
}

/**
 * Today's message for an aura (by animal_auras.id), using the user's local date.
 * Cached for the day, so repeated calls don't refetch. Falls back to the latest
 * earlier season when the current one has no message for this aura; resolves to
 * null only when no season has any.
 */
export function fetchTodayAuraMessage(auraId: number, now: Date = new Date()): Promise<DailyAuraMessage | null> {
  return fetchAuraMessageForDate(auraId, toLocalDateString(now));
}
