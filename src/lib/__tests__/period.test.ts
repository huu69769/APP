import { calendarMonthRange, eachDay, effectiveCutoff, payPeriodRange, periodRange } from '../period';

describe('calendarMonthRange', () => {
  it('covers the 1st to the last day', () => {
    expect(calendarMonthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(calendarMonthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('effectiveCutoff', () => {
  it('uses month end for null', () => {
    expect(effectiveCutoff('2026-02', null)).toBe('2026-02-28');
  });

  it('clamps cutoff days beyond the month to month end', () => {
    expect(effectiveCutoff('2026-02', 31)).toBe('2026-02-28');
    expect(effectiveCutoff('2026-04', 31)).toBe('2026-04-30');
    expect(effectiveCutoff('2026-05', 31)).toBe('2026-05-31');
  });
});

describe('payPeriodRange', () => {
  it('runs from the day after the previous cutoff to this cutoff', () => {
    expect(payPeriodRange('2026-09', 25)).toEqual({ from: '2026-08-26', to: '2026-09-25' });
  });

  it('crosses the year boundary', () => {
    expect(payPeriodRange('2026-01', 15)).toEqual({ from: '2025-12-16', to: '2026-01-15' });
  });

  it('equals the calendar month when cutoff is month end', () => {
    expect(payPeriodRange('2026-03', null)).toEqual(calendarMonthRange('2026-03'));
    expect(payPeriodRange('2026-03', 31)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('handles short months after a clamped cutoff', () => {
    // 截止日 30：2 月按 28 日截止，3 月期从 3/1 开始
    expect(payPeriodRange('2026-02', 30)).toEqual({ from: '2026-01-31', to: '2026-02-28' });
    expect(payPeriodRange('2026-03', 30)).toEqual({ from: '2026-03-01', to: '2026-03-30' });
  });

  it('has no gaps or overlaps between consecutive periods', () => {
    for (const cutoff of [1, 15, 28, 29, 30, 31, null]) {
      for (let m = 1; m < 12; m++) {
        const a = payPeriodRange(`2026-${String(m).padStart(2, '0')}`, cutoff);
        const b = payPeriodRange(`2026-${String(m + 1).padStart(2, '0')}`, cutoff);
        expect(eachDay({ from: a.to, to: b.from })).toHaveLength(2);
      }
    }
  });
});

describe('periodRange', () => {
  it('switches by mode', () => {
    expect(periodRange('calendarMonth', '2026-09', 25)).toEqual(calendarMonthRange('2026-09'));
    expect(periodRange('payPeriod', '2026-09', 25)).toEqual(payPeriodRange('2026-09', 25));
  });
});
