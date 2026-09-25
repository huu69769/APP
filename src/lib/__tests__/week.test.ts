import {
  datesByWeekdays,
  endOfNextMonth,
  layoutWeek,
  startOfWeek,
  visibleHours,
  weekDates,
  weekTotals,
} from '../week';

const dates = weekDates('2026-09-20');

describe('startOfWeek', () => {
  it('uses the configured first weekday', () => {
    expect(startOfWeek('2026-09-25', 0)).toBe('2026-09-20'); // 周日开始
    expect(startOfWeek('2026-09-25', 1)).toBe('2026-09-21'); // 周一开始
    expect(startOfWeek('2026-09-20', 1)).toBe('2026-09-14');
  });
});

describe('layoutWeek', () => {
  it('places a block in its day column', () => {
    expect(
      layoutWeek([{ key: 'a', date: '2026-09-22', startTime: '09:00', endTime: '15:00' }], dates)
    ).toEqual([{ key: 'a', day: 2, start: 540, end: 900, lane: 0, lanes: 1, continued: false }]);
  });

  it('splits an overnight shift at midnight', () => {
    const r = layoutWeek(
      [{ key: 'n', date: '2026-09-22', startTime: '22:00', endTime: '05:00' }],
      dates
    );
    expect(r).toEqual([
      { key: 'n', day: 2, start: 1320, end: 1440, lane: 0, lanes: 1, continued: false },
      { key: 'n', day: 3, start: 0, end: 300, lane: 0, lanes: 1, continued: true },
    ]);
  });

  it('shows the second half of an overnight shift from the previous week', () => {
    const r = layoutWeek(
      [{ key: 'n', date: '2026-09-19', startTime: '22:00', endTime: '05:00' }],
      dates
    );
    expect(r).toEqual([
      { key: 'n', day: 0, start: 0, end: 300, lane: 0, lanes: 1, continued: true },
    ]);
  });

  it('draws events without an end time as one hour', () => {
    const r = layoutWeek(
      [{ key: 'e', date: '2026-09-20', startTime: '10:00', endTime: null }],
      dates
    );
    expect(r[0]).toMatchObject({ start: 600, end: 660 });
  });

  it('puts overlapping blocks side by side', () => {
    const r = layoutWeek(
      [
        { key: 'a', date: '2026-09-20', startTime: '09:00', endTime: '12:00' },
        { key: 'b', date: '2026-09-20', startTime: '11:00', endTime: '13:00' },
        { key: 'c', date: '2026-09-20', startTime: '12:30', endTime: '14:00' },
        { key: 'd', date: '2026-09-20', startTime: '18:00', endTime: '20:00' },
      ],
      dates
    );
    const by = Object.fromEntries(r.map((s) => [s.key, [s.lane, s.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});

describe('visibleHours', () => {
  it('defaults to 8–22 and grows for early or late blocks', () => {
    expect(visibleHours([])).toEqual({ from: 8, to: 22 });
    const r = layoutWeek(
      [{ key: 'n', date: '2026-09-22', startTime: '22:00', endTime: '05:30' }],
      dates
    );
    expect(visibleHours(r)).toEqual({ from: 0, to: 24 });
  });
});

describe('weekTotals', () => {
  it('sums hours and wage for the week, counting pending shifts', () => {
    const s = (date: string, startTime: string | null, endTime: string | null) => ({
      date,
      startTime,
      endTime,
      breakMinutes: 0,
      wageSnapshot: 1100,
      currencySnapshot: 'JPY' as const,
    });
    expect(
      weekTotals(
        [
          s('2026-09-21', '09:00', '15:00'),
          s('2026-09-22', null, null),
          s('2026-09-27', '09:00', '10:00'),
        ],
        dates
      )
    ).toEqual({ minutes: 360, wage: { JPY: 6600 }, pending: 1 });
  });
});

describe('datesByWeekdays', () => {
  it('lists weekdays in the range, both ends included', () => {
    // 2026-09-21 是周一
    expect(datesByWeekdays('2026-09-21', '2026-10-02', [1, 3, 5])).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-25',
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
    ]);
  });
  it('is empty for no weekdays or a reversed range', () => {
    expect(datesByWeekdays('2026-09-21', '2026-10-02', [])).toEqual([]);
    expect(datesByWeekdays('2026-10-02', '2026-09-21', [1])).toEqual([]);
  });
});

describe('endOfNextMonth', () => {
  it('returns the last day of next month', () => {
    expect(endOfNextMonth('2026-09-25')).toBe('2026-10-31');
    expect(endOfNextMonth('2026-12-31')).toBe('2027-01-31');
    expect(endOfNextMonth('2026-01-31')).toBe('2026-02-28');
  });
});
