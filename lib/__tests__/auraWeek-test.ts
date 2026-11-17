import { buildAuraWeek, formatLongDate, weekdayName } from '../auraWeek';

describe('buildAuraWeek', () => {
  // Monday 16 November 2026, 10:00 local time
  const now = new Date(2026, 10, 16, 10, 0);

  it('shows 4 past days, today and 2 locked days', () => {
    const week = buildAuraWeek(now, '2026-01-01');
    expect(week.map(day => day.localDate)).toEqual([
      '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18',
    ]);
    expect(week.map(day => day.kind)).toEqual(['past', 'past', 'past', 'past', 'today', 'locked', 'locked']);
    expect(week[4]).toMatchObject({ weekdayShort: 'Mon', weekdayLong: 'Monday', dayOfMonth: 16, offset: 0 });
  });

  it('marks past days before the season start as unavailable', () => {
    const week = buildAuraWeek(now, '2026-11-14');
    expect(week.slice(0, 4).map(day => day.kind)).toEqual(['unavailable', 'unavailable', 'past', 'past']);
  });

  it('keeps past days readable while the season start is unknown', () => {
    expect(buildAuraWeek(now, null).slice(0, 4).every(day => day.kind === 'past')).toBe(true);
  });

  it('crosses month and year boundaries', () => {
    const week = buildAuraWeek(new Date(2027, 0, 2, 9), '2026-01-01');
    expect(week[0].localDate).toBe('2026-12-29');
    expect(week[6].localDate).toBe('2027-01-04');
  });
});

describe('date labels', () => {
  it('formats the hero date', () => {
    expect(formatLongDate('2026-11-16')).toBe('Monday, 16 November');
  });

  it('names the weekday for the paywall title', () => {
    expect(weekdayName('2026-11-17')).toBe('Tuesday');
  });
});
