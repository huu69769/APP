import {
  anniversaryStatus,
  daysSince,
  nextOccurrence,
  occurrenceInYear,
  occurrencesInRange,
} from '../anniversary';

const solar = (date: string, repeat = true) => ({ date, repeat, lunar: false });
const lunar = (date: string) => ({ date, repeat: true, lunar: true });

describe('occurrenceInYear', () => {
  it('keeps the same month and day for solar dates', () => {
    expect(occurrenceInYear(solar('2020-10-01'), 2026)).toBe('2026-10-01');
  });
  it('uses Feb 28 in non-leap years', () => {
    expect(occurrenceInYear(solar('2024-02-29'), 2026)).toBe('2026-02-28');
    expect(occurrenceInYear(solar('2024-02-29'), 2028)).toBe('2028-02-29');
  });
  it('follows the lunar month and day', () => {
    // 2023-08-20 = 农历七月初五；2026 年的七月初五 = 2026-08-17
    expect(occurrenceInYear(lunar('2023-08-20'), 2026)).toBe('2026-08-17');
  });
  it('uses day 29 when the lunar month has no day 30', () => {
    // 2024-02-09 = 腊月三十；农历 2026 年的腊月只有 29 天 → 腊月廿九
    expect(occurrenceInYear(lunar('2024-02-09'), 2026)).toBe('2027-02-05');
  });
  it('treats a leap month birthday as the normal month', () => {
    // 2023-04-01 = 闰二月十一 → 2026 年二月十一
    expect(occurrenceInYear(lunar('2023-04-01'), 2026)).toBe('2026-03-29');
  });
});

describe('occurrencesInRange', () => {
  it('lists yearly occurrences with the anniversary number', () => {
    expect(occurrencesInRange(solar('2020-09-25'), '2026-09-01', '2026-09-30')).toEqual([
      { date: '2026-09-25', years: 6 },
    ]);
  });
  it('includes the original day but nothing before it', () => {
    expect(occurrencesInRange(solar('2026-09-25'), '2025-01-01', '2026-12-31')).toEqual([
      { date: '2026-09-25', years: 0 },
    ]);
  });
  it('shows a one-off date only once', () => {
    expect(occurrencesInRange(solar('2026-09-25', false), '2026-09-01', '2026-09-30')).toEqual([
      { date: '2026-09-25', years: 0 },
    ]);
    expect(occurrencesInRange(solar('2025-09-25', false), '2026-09-01', '2026-09-30')).toEqual([]);
  });
  it('finds lunar occurrences that fall in the next solar year', () => {
    // 2020-01-24 = 腊月三十（除夕）；2026 年的除夕在 2027 年 2 月（农历 2026 年）
    const r = occurrencesInRange(lunar('2020-01-24'), '2027-01-01', '2027-12-31');
    expect(r).toHaveLength(1);
    expect(r[0].date.startsWith('2027-02')).toBe(true);
    expect(r[0].years).toBe(7);
  });
});

describe('anniversaryStatus', () => {
  it('counts down to the next yearly occurrence', () => {
    expect(anniversaryStatus(solar('2000-10-07'), '2026-09-25')).toEqual({
      kind: 'until',
      days: 12,
      years: 26,
      date: '2026-10-07',
    });
  });
  it('rolls over to next year once passed', () => {
    const s = anniversaryStatus(solar('2000-09-01'), '2026-09-25');
    expect(s).toMatchObject({ kind: 'until', date: '2027-09-01', years: 27 });
  });
  it('says today', () => {
    expect(anniversaryStatus(solar('2020-09-25'), '2026-09-25')).toEqual({
      kind: 'today',
      years: 6,
    });
  });
  it('counts days since a past one-off date', () => {
    expect(anniversaryStatus(solar('2026-09-20', false), '2026-09-25')).toEqual({
      kind: 'since',
      days: 5,
    });
  });
  it('counts down to a future one-off date', () => {
    expect(anniversaryStatus(solar('2026-10-25', false), '2026-09-25')).toMatchObject({
      kind: 'until',
      days: 30,
      years: 0,
    });
  });
});

describe('nextOccurrence / daysSince', () => {
  it('returns null for a passed one-off date', () => {
    expect(nextOccurrence(solar('2026-01-01', false), '2026-09-25')).toBeNull();
  });
  it('counts total days since the start', () => {
    expect(daysSince(solar('2026-09-20'), '2026-09-25')).toBe(5);
    expect(daysSince(solar('2026-09-30'), '2026-09-25')).toBeNull();
  });
});
