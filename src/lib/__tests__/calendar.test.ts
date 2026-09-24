import { buildMonthGrid, monthGridRange, orderedWeekdays } from '../calendar';
import { addDays, addMonths, formatDateInput, isValidLocalDate, today } from '../date';

describe('buildMonthGrid', () => {
  it('always has 6 weeks of 7 days', () => {
    const grid = buildMonthGrid('2026-02', 0);
    expect(grid).toHaveLength(6);
    grid.forEach((week) => expect(week).toHaveLength(7));
  });

  it('starts on Sunday when weekStart = 0', () => {
    // 2026-09-01 是星期二
    const grid = buildMonthGrid('2026-09', 0);
    expect(grid[0][0].date).toBe('2026-08-30');
    expect(grid[0][0].weekday).toBe(0);
    expect(grid[0][2]).toMatchObject({ date: '2026-09-01', day: 1, inMonth: true });
  });

  it('starts on Monday when weekStart = 1', () => {
    const grid = buildMonthGrid('2026-09', 1);
    expect(grid[0][0].date).toBe('2026-08-31');
    expect(grid[0][0].weekday).toBe(1);
    expect(grid[0][6].weekday).toBe(0);
    expect(grid[0][1].date).toBe('2026-09-01');
  });

  it('does not add a leading week when the month starts on the week start day', () => {
    // 2026-02-01 是星期日
    const grid = buildMonthGrid('2026-02', 0);
    expect(grid[0][0].date).toBe('2026-02-01');
  });

  it('marks days outside the month and today', () => {
    const grid = buildMonthGrid('2026-09', 0, '2026-09-24');
    const days = grid.flat();
    expect(days.filter((d) => d.inMonth)).toHaveLength(30);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-09-24']);
  });

  it('handles leap years', () => {
    const days = buildMonthGrid('2028-02', 1).flat();
    expect(days.filter((d) => d.inMonth)).toHaveLength(29);
  });

  it('produces consecutive dates across month and year boundaries', () => {
    const days = buildMonthGrid('2026-12', 1).flat();
    for (let i = 1; i < days.length; i++) {
      expect(days[i].date).toBe(addDays(days[i - 1].date, 1));
    }
    expect(days[days.length - 1].date.startsWith('2027-01')).toBe(true);
  });
});

describe('date helpers', () => {
  it('orders weekdays by week start', () => {
    expect(orderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(orderedWeekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('adds months across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('uses the local calendar date, not UTC', () => {
    // 本地时间晚上 23:30 仍然是当天
    expect(today(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24');
    expect(today(new Date(2026, 8, 25, 0, 10))).toBe('2026-09-25');
  });

  it('validates local date strings strictly', () => {
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-9-1')).toBe(false);
  });
});

describe('monthGridRange', () => {
  it('covers the visible 6 weeks', () => {
    expect(monthGridRange('2026-09', 0)).toEqual({ from: '2026-08-30', to: '2026-10-10' });
    expect(monthGridRange('2026-09', 1)).toEqual({ from: '2026-08-31', to: '2026-10-11' });
  });
});

describe('formatDateInput', () => {
  it('inserts dashes while typing', () => {
    expect(formatDateInput('2026')).toBe('2026');
    expect(formatDateInput('20260')).toBe('2026-0');
    expect(formatDateInput('20260930')).toBe('2026-09-30');
    expect(formatDateInput('2026-09-301')).toBe('2026-09-30');
  });
});
