const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
