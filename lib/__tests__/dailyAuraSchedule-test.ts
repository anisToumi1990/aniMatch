import { daysBetween, getDailyMessagePosition, msUntilNextLocalMidnight, toLocalDateString } from '../dailyAuraSchedule';

describe('getDailyMessagePosition', () => {
  const base = { seasonStartDate: '2026-11-17', messageCount: 60 };

  it('shows message #1 on day 1 of the season', () => {
    expect(getDailyMessagePosition({ ...base, localDate: '2026-11-17' })).toBe(0);
  });

  it('moves one message per calendar day', () => {
    expect(getDailyMessagePosition({ ...base, localDate: '2026-11-18' })).toBe(1);
    expect(getDailyMessagePosition({ ...base, localDate: '2027-01-15' })).toBe(59);
  });

  it('wraps around after the last message', () => {
    expect(getDailyMessagePosition({ ...base, localDate: '2027-01-16' })).toBe(0);
    expect(getDailyMessagePosition({ ...base, localDate: '2027-01-17' })).toBe(1);
  });

  it('works with any number of messages', () => {
    expect(getDailyMessagePosition({ ...base, messageCount: 7, localDate: '2026-11-24' })).toBe(0);
    expect(getDailyMessagePosition({ ...base, messageCount: 1, localDate: '2026-12-25' })).toBe(0);
  });

  it('returns null when there are no messages', () => {
    expect(getDailyMessagePosition({ ...base, messageCount: 0, localDate: '2026-11-20' })).toBeNull();
  });

  it('shows the first message before the season starts', () => {
    expect(getDailyMessagePosition({ ...base, localDate: '2026-11-16' })).toBe(0);
  });
});

describe('daysBetween', () => {
  it('ignores daylight saving changes', () => {
    // Europe and the US switch clocks between these dates.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-20', '2026-11-10')).toBe(21);
  });

  it('accepts timestamps by using their date part', () => {
    expect(daysBetween('2026-11-17T00:00:00Z', '2026-11-19')).toBe(2);
  });
});

describe('local date helpers', () => {
  it('formats the local calendar date', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('counts down to the next local midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 0, 5, 23, 0, 0))).toBe(60 * 60 * 1000);
  });
});
