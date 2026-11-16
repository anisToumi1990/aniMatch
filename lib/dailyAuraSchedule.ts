/**
 * Day-selection rule for the daily aura message. Pure and dependency-free, so
 * a server (e.g. a push-notification job) can reuse it as is.
 *
 * Rule: day 1 of a season (its season_start_date, in the user's local calendar)
 * shows the 1st active message of that season for the animal, day 2 the 2nd,
 * and so on, wrapping around after the last one. "Nth message" means Nth by
 * day_index among the ACTIVE rows, so gaps or deactivated rows are skipped and
 * any number of rows works. The message changes at the user's local midnight.
 * Everyone with the same animal sees the same message on the same local date.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" of the given moment in the device's local time zone. */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calendar-day number of a "YYYY-MM-DD" date (time zones and DST don't matter). */
function toDayNumber(isoDate: string): number {
  const match = DATE_PATTERN.exec(isoDate.slice(0, 10));
  if (!match) throw new Error(`Invalid date "${isoDate}", expected YYYY-MM-DD.`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY;
}

/** Whole calendar days from `fromDate` to `toDate` (both "YYYY-MM-DD"). Negative if toDate is earlier. */
export function daysBetween(fromDate: string, toDate: string): number {
  return toDayNumber(toDate) - toDayNumber(fromDate);
}

export interface DailyMessageInput {
  /** daily_aura_settings.season_start_date, "YYYY-MM-DD". */
  seasonStartDate: string;
  /** The user's local date, "YYYY-MM-DD" (see toLocalDateString). */
  localDate: string;
  /** Number of active messages in the current season for this animal. */
  messageCount: number;
}

/**
 * 0-based position of today's message among the season's active messages for
 * one animal, sorted by day_index ascending. Returns null when there are none.
 *
 * Dates before the season start (e.g. a time zone still on "yesterday" on
 * launch day) show the first message.
 */
export function getDailyMessagePosition({ seasonStartDate, localDate, messageCount }: DailyMessageInput): number | null {
  if (!Number.isInteger(messageCount) || messageCount <= 0) return null;
  const daysSinceStart = Math.max(0, daysBetween(seasonStartDate, localDate));
  return daysSinceStart % messageCount;
}

/** Milliseconds until the next local midnight, when the message changes. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}
