import { formatLongDate, weekdayName } from '../dateLabels';

describe('date labels', () => {
  it('formats the date on top of the daily card', () => {
    expect(formatLongDate('2026-11-16')).toBe('Monday, 16 November');
  });

  it('crosses month and year boundaries', () => {
    expect(formatLongDate('2027-01-01')).toBe('Friday, 1 January');
  });

  it('names the weekday', () => {
    expect(weekdayName('2026-11-17')).toBe('Tuesday');
  });
});
