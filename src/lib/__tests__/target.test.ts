import { currenciesInYear, niceCeil, targetProgress, yearTargetSummary } from '../target';

describe('targetProgress', () => {
  it('uses only the target currency', () => {
    const p = targetProgress(
      { amount: 50000, currency: 'JPY' },
      { completed: { JPY: 25400, CNY: 90000 }, total: { JPY: 38000, CNY: 90000 } }
    );
    expect(p).toEqual({
      earned: 25400,
      expected: 38000,
      earnedRatio: 0.508,
      expectedRatio: 0.76,
      percent: 50,
      remaining: 24600,
    });
  });
  it('caps the ratio at 1 but keeps the real percent', () => {
    const p = targetProgress(
      { amount: 1000, currency: 'JPY' },
      { completed: { JPY: 1500 }, total: { JPY: 1500 } }
    );
    expect(p).toMatchObject({ earnedRatio: 1, expectedRatio: 1, percent: 150, remaining: 0 });
  });
  it('is zero when there is no income in that currency', () => {
    const p = targetProgress(
      { amount: 1000, currency: 'CNY' },
      { completed: { JPY: 1500 }, total: { JPY: 1500 } }
    );
    expect(p).toMatchObject({ earned: 0, expected: 0, percent: 0, remaining: 1000 });
  });
});

describe('yearTargetSummary', () => {
  const m = (month: string, completed: number, total: number) => ({
    month,
    completed: completed ? { JPY: completed } : {},
    wage: total ? { JPY: total } : {},
  });
  const months = [
    m('2026-07', 60000, 60000), // 达标
    m('2026-08', 40000, 40000), // 没达标
    m('2026-09', 20000, 45000), // 本月，还没达标
    m('2026-10', 0, 10000), // 以后
  ];
  const targets = {
    '2026-07': { amount: 50000, currency: 'JPY' as const },
    '2026-08': { amount: 50000, currency: 'JPY' as const },
    '2026-09': { amount: 30000, currency: 'JPY' as const },
    '2026-10': { amount: 5000, currency: 'CNY' as const }, // 币种不同，不算
  };

  it('compares each month with its own target', () => {
    const r = yearTargetSummary({ months, targets, currency: 'JPY', currentMonth: '2026-09' });
    expect(r.bars.map((b) => [b.target, b.reached])).toEqual([
      [50000, true],
      [50000, false],
      [30000, false],
      [null, false],
    ]);
    expect(r).toMatchObject({
      earned: 120000,
      expected: 155000,
      targetTotal: 130000,
      reachedCount: 1,
      judgedCount: 2, // 9 月还没结束、也还没达标，不算
    });
  });

  it('lists the currencies used in the year', () => {
    expect(currenciesInYear(months, targets).sort()).toEqual(['CNY', 'JPY']);
  });
});

describe('niceCeil', () => {
  it('rounds up to a clean axis maximum', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(38000)).toBe(50000);
    expect(niceCeil(50000)).toBe(50000);
    expect(niceCeil(120000)).toBe(200000);
    expect(niceCeil(2100000)).toBe(2500000);
  });
});
