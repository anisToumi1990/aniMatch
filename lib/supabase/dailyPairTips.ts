import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDailyMessagePosition, toLocalDateString } from '@/lib/dailyAuraSchedule';
import { fetchDailyAuraSettings } from '@/lib/supabase/dailyAura';
import { getDisplayName, getFirstName } from '@/lib/names';

/** One person the user has a compatibility result with (newest result per person). */
export interface PairMatch {
  /** compatibility_results.id, used to open the detail. */
  resultId: number;
  otherUserId: string;
  /** "Lina Ben Salah", else the email name, else "Someone". */
  displayName: string;
  /** "Lina", same fallbacks; replaces {name} in tips. */
  firstName: string;
  /** The other person's aura (animal_auras.id), or null if unknown. */
  auraId: number | null;
  animalName: string | null;
  relationshipType: string;
}

interface ProfileJoin {
  full_name: string | null;
  email: string | null;
}

interface CompatibilityRow {
  id: number;
  user_a_id: string;
  user_b_id: string;
  user_a_aura_id: number | null;
  user_b_aura_id: number | null;
  relationship_type: string;
  created_at: string;
  user_a: ProfileJoin | null;
  user_b: ProfileJoin | null;
}

let auraNamesPromise: Promise<Record<number, string>> | null = null;

/** animal_auras id -> name (15 rows, loaded once per session). */
function fetchAuraNames(): Promise<Record<number, string>> {
  if (!auraNamesPromise) {
    auraNamesPromise = (async () => {
      const { data, error } = await supabase.from('animal_auras').select('id, name');
      if (error) throw error;
      const names: Record<number, string> = {};
      (data ?? []).forEach((aura: { id: number; name: string }) => {
        names[aura.id] = aura.name;
      });
      return names;
    })();
    auraNamesPromise.catch(() => {
      auraNamesPromise = null;
    });
  }
  return auraNamesPromise;
}

/** The user's matches, one per person (their newest result), newest first. */
export async function fetchPairMatches(userId: string): Promise<PairMatch[]> {
  const [{ data, error }, auraNames] = await Promise.all([
    supabase
      .from('compatibility_results')
      .select(`
        id, user_a_id, user_b_id, user_a_aura_id, user_b_aura_id, relationship_type, created_at,
        user_a:user_a_id(full_name, email),
        user_b:user_b_id(full_name, email)
      `)
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
    fetchAuraNames(),
  ]);
  if (error) throw error;

  const seen = new Set<string>();
  const matches: PairMatch[] = [];
  ((data ?? []) as CompatibilityRow[]).forEach(row => {
    const isUserA = row.user_a_id === userId;
    const otherUserId = isUserA ? row.user_b_id : row.user_a_id;
    if (!otherUserId || seen.has(otherUserId)) return;
    seen.add(otherUserId);
    const other = isUserA ? row.user_b : row.user_a;
    const auraId = isUserA ? row.user_b_aura_id : row.user_a_aura_id;
    matches.push({
      resultId: row.id,
      otherUserId,
      displayName: getDisplayName(other?.full_name, other?.email),
      firstName: getFirstName(other?.full_name, other?.email),
      auraId: auraId ?? null,
      animalName: auraId != null ? auraNames[auraId] ?? null : null,
      relationshipType: row.relationship_type,
    });
  });
  return matches;
}

interface TipsCache {
  localDate: string;
  /** aura id -> tip template ({name} not filled), null = no tip for that aura. */
  tips: Record<string, string | null>;
}

const CACHE_KEY = 'animatch.dailyPairTips.v1';
let memoryCache: TipsCache | null = null;

async function readCache(localDate: string): Promise<TipsCache> {
  if (memoryCache?.localDate === localDate) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const stored = raw ? (JSON.parse(raw) as TipsCache) : null;
    if (stored?.localDate === localDate) {
      memoryCache = stored;
      return stored;
    }
  } catch {
    // Ignore a broken cache.
  }
  memoryCache = { localDate, tips: {} };
  return memoryCache;
}

async function writeCache(cache: TipsCache): Promise<void> {
  memoryCache = cache;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The memory cache is enough for this session.
  }
}

/**
 * Today's tip template for each aura id (same day rule as the daily aura, on the
 * other person's animal). Cached for the day; only uncached auras are fetched,
 * in a single query.
 */
export async function fetchTodayPairTips(auraIds: number[], now: Date = new Date()): Promise<Record<number, string | null>> {
  const localDate = toLocalDateString(now);
  const cache = await readCache(localDate);
  const uniqueIds = Array.from(new Set(auraIds));
  const missing = uniqueIds.filter(id => !(String(id) in cache.tips));

  if (missing.length > 0) {
    const settings = await fetchDailyAuraSettings();
    const { data, error } = await supabase
      .from('daily_pair_tips')
      .select('aura_id, day_index, tip')
      .in('aura_id', missing)
      .eq('season', settings.currentSeason)
      .eq('is_active', true)
      .order('aura_id', { ascending: true })
      .order('day_index', { ascending: true });
    if (error) throw error;

    const byAura = new Map<number, string[]>();
    (data ?? []).forEach((row: { aura_id: number; tip: string }) => {
      const list = byAura.get(row.aura_id) ?? [];
      list.push(row.tip);
      byAura.set(row.aura_id, list);
    });
    const tips = { ...cache.tips };
    missing.forEach(id => {
      const list = byAura.get(id) ?? [];
      const position = getDailyMessagePosition({
        seasonStartDate: settings.seasonStartDate,
        localDate,
        messageCount: list.length,
      });
      tips[String(id)] = position === null ? null : list[position];
    });
    await writeCache({ localDate, tips });
  }

  const result: Record<number, string | null> = {};
  uniqueIds.forEach(id => {
    result[id] = memoryCache?.tips[String(id)] ?? null;
  });
  return result;
}

/** Replaces {name} in a tip with the person's first name. */
export function fillTipName(template: string, firstName: string): string {
  return template.replace(/\{name\}/g, firstName);
}
