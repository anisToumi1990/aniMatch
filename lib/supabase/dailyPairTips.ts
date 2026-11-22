import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getDailyPairTipPosition, getPairTipOffsets, toLocalDateString } from '@/lib/dailyAuraSchedule';
import { getDailyAuraSettings } from '@/lib/supabase/dailyAura';
import { getDisplayName, getFirstName } from '@/lib/names';
import { fetchHiddenMatchIds } from '@/lib/supabase/hiddenMatches';

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

/** The user's matches, one per person (their newest result that isn't hidden), newest first. */
export async function fetchPairMatches(userId: string): Promise<PairMatch[]> {
  const [{ data, error }, auraNames, hiddenIds] = await Promise.all([
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
    // Without hidden_matches (e.g. before its migration), show everything.
    fetchHiddenMatchIds(userId).catch(hiddenError => {
      console.error('Error loading hidden matches:', hiddenError);
      return new Set<number>();
    }),
  ]);
  if (error) throw error;

  const seen = new Set<string>();
  const matches: PairMatch[] = [];
  ((data ?? []) as CompatibilityRow[]).forEach(row => {
    if (hiddenIds.has(Number(row.id))) return;
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

interface TipListsCache {
  localDate: string;
  seasonStartDate: string;
  /** aura id -> that animal's active tip templates ({name} not filled), by day_index. */
  lists: Record<string, string[]>;
}

const CACHE_KEY = 'animatch.dailyPairTips.v2';
let memoryCache: TipListsCache | null = null;

async function readCache(localDate: string): Promise<TipListsCache | null> {
  if (memoryCache?.localDate === localDate) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const stored = raw ? (JSON.parse(raw) as TipListsCache) : null;
    if (stored?.localDate === localDate) {
      memoryCache = stored;
      return stored;
    }
  } catch {
    // Ignore a broken cache.
  }
  return null;
}

async function writeCache(cache: TipListsCache): Promise<void> {
  memoryCache = cache;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The memory cache is enough for this session.
  }
}

interface TipRow {
  aura_id: number;
  season: number;
  tip: string;
}

/** Groups rows by aura, keeping only each aura's highest season (rows are ordered by day_index). */
function groupLatestSeason(rows: TipRow[]): Map<number, string[]> {
  const latestSeason = new Map<number, number>();
  rows.forEach(row => latestSeason.set(row.aura_id, Math.max(latestSeason.get(row.aura_id) ?? 0, row.season)));
  const lists = new Map<number, string[]>();
  rows.forEach(row => {
    if (row.season !== latestSeason.get(row.aura_id)) return;
    lists.set(row.aura_id, [...(lists.get(row.aura_id) ?? []), row.tip]);
  });
  return lists;
}

/**
 * Today's tip lists for the given auras, cached for the day. Uses the current
 * season (daily_aura_settings); an aura with no tips in it falls back to the
 * latest earlier season that has tips, so the section never goes empty after a
 * daily-aura-only content drop.
 */
export async function fetchPairTipLists(
  auraIds: number[],
  now: Date = new Date(),
): Promise<{ seasonStartDate: string; localDate: string; lists: Record<number, string[]> }> {
  const localDate = toLocalDateString(now);
  const uniqueIds = Array.from(new Set(auraIds));
  let cache = await readCache(localDate);
  const missing = cache ? uniqueIds.filter(id => !(String(id) in cache!.lists)) : uniqueIds;

  if (!cache || missing.length > 0) {
    const settings = await getDailyAuraSettings();
    const lists: Record<string, string[]> = { ...(cache?.lists ?? {}) };

    const { data, error } = await supabase
      .from('daily_pair_tips')
      .select('aura_id, season, tip')
      .in('aura_id', missing)
      .eq('season', settings.currentSeason)
      .eq('is_active', true)
      .order('aura_id', { ascending: true })
      .order('day_index', { ascending: true });
    if (error) throw error;
    const current = groupLatestSeason((data ?? []) as TipRow[]);

    // Fallback: auras without tips this season use their latest earlier season.
    const withoutTips = missing.filter(id => !current.has(id));
    let fallback = new Map<number, string[]>();
    if (withoutTips.length > 0) {
      const { data: older, error: olderError } = await supabase
        .from('daily_pair_tips')
        .select('aura_id, season, tip')
        .in('aura_id', withoutTips)
        .lt('season', settings.currentSeason)
        .eq('is_active', true)
        .order('aura_id', { ascending: true })
        .order('season', { ascending: false })
        .order('day_index', { ascending: true });
      if (olderError) throw olderError;
      fallback = groupLatestSeason((older ?? []) as TipRow[]);
    }

    missing.forEach(id => {
      lists[String(id)] = current.get(id) ?? fallback.get(id) ?? [];
    });
    cache = { localDate, seasonStartDate: settings.seasonStartDate, lists };
    await writeCache(cache);
  }

  const result: Record<number, string[]> = {};
  uniqueIds.forEach(id => {
    result[id] = cache!.lists[String(id)] ?? [];
  });
  return { seasonStartDate: cache.seasonStartDate, localDate, lists: result };
}

/**
 * Today's tip template per match (keyed by the other user's id), or null.
 * Same day rotation as the daily aura, shifted per match (getPairTipOffsets) so
 * two matches with the same animal don't get the same tip.
 */
export async function fetchTodayPairTips(
  matches: Pick<PairMatch, 'otherUserId' | 'auraId'>[],
  now: Date = new Date(),
): Promise<Map<string, string | null>> {
  const withAura = matches.filter((match): match is { otherUserId: string; auraId: number } => match.auraId !== null);
  const tips = new Map<string, string | null>(matches.map(match => [match.otherUserId, null]));
  if (withAura.length === 0) return tips;

  const { seasonStartDate, localDate, lists } = await fetchPairTipLists(withAura.map(match => match.auraId), now);
  const offsets = getPairTipOffsets(
    withAura.map(match => ({ key: match.otherUserId, group: match.auraId })),
    group => lists[Number(group)]?.length ?? 0,
  );
  withAura.forEach(match => {
    const list = lists[match.auraId] ?? [];
    const position = getDailyPairTipPosition({
      seasonStartDate,
      localDate,
      messageCount: list.length,
      offset: offsets.get(match.otherUserId) ?? 0,
    });
    tips.set(match.otherUserId, position === null ? null : list[position]);
  });
  return tips;
}

/** Replaces {name} in a tip with the person's first name. */
export function fillTipName(template: string, firstName: string): string {
  return template.replace(/\{name\}/g, firstName);
}
