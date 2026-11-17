import { daysBetween, toLocalDateString } from '@/lib/dailyAuraSchedule';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Days shown in Home's week strip, relative to today. */
export const PAST_DAYS = 4;
export const LOCKED_DAYS = 2;

/**
 * past: readable (tap to show that day's message)
 * today: the default selection
 * locked: a future day (opens the paywall)
 * unavailable: before the current season started, so there's no message for it
 */
export type WeekDayKind = 'past' | 'today' | 'locked' | 'unavailable';

export interface WeekDay {
  /** "YYYY-MM-DD" in the user's local calendar. */
  localDate: string;
  /** -4 … +2, 0 = today. */
  offset: number;
  /** "Mon" */
  weekdayShort: string;
  /** "Monday" */
  weekdayLong: string;
  dayOfMonth: number;
  kind: WeekDayKind;
}

function parseLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Monday" for "2026-11-16". */
export function weekdayName(localDate: string): string {
  return WEEKDAYS[parseLocalDate(localDate).getDay()];
}

/** "Monday, 16 November" for "2026-11-16". */
export function formatLongDate(localDate: string): string {
  const date = parseLocalDate(localDate);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * The 7 days of the week strip: PAST_DAYS before today, today, LOCKED_DAYS after.
 * Past days before `seasonStartDate` are 'unavailable' (the day rule would only
 * repeat message #1 there). Pass null while the season start isn't known yet.
 */
export function buildAuraWeek(now: Date, seasonStartDate: string | null): WeekDay[] {
  const days: WeekDay[] = [];
  for (let offset = -PAST_DAYS; offset <= LOCKED_DAYS; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const localDate = toLocalDateString(date);
    let kind: WeekDayKind = offset === 0 ? 'today' : offset > 0 ? 'locked' : 'past';
    if (kind === 'past' && seasonStartDate && daysBetween(seasonStartDate, localDate) < 0) kind = 'unavailable';
    days.push({
      localDate,
      offset,
      weekdayShort: WEEKDAYS[date.getDay()].slice(0, 3),
      weekdayLong: WEEKDAYS[date.getDay()],
      dayOfMonth: date.getDate(),
      kind,
    });
  }
  return days;
}
