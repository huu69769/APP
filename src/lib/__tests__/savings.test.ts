import {
  isActiveIn,
  monthSummary,
  monthsBetween,
  monthsUntil,
  planStatus,
  pauseFrom,
  planTarget,
  resumeIn,
  saveDate,
  savingsYearBars,
} from '../savings';

const plan = (over: Partial<Parameters<typeof planStatus>[0]> = {}) => ({
  id: 'p1',
  currency: 'CNY' as const,
  monthlyAmount: 71500,
  startMonth: '2026-09',
  endMonth: '2027-10' as string | null,
  targetAmount: null as number | null,
  saveDay: 27,
  pauses: [] as { from: string; to: string | null }[],
  ...over,
});
const dep = (planId: string, date: string, amount: number) => ({ planId, date, amount });

describe('basics', () => {
  it('counts months inclusively', () => {
    expect(monthsBetween('2026-09', '2027-10')).toBe(14);
    expect(monthsBetween('2027-10', '2026-09')).toBe(0);
    expect(monthsUntil('2026-09', '2028-01')).toBe(16);
  });
  it('computes the target from monthly amount x months unless set', () => {
    expect(planTarget(plan())).toBe(71500 * 14);
    expect(planTarget(plan({ targetAmount: 1000000 }))).toBe(1000000);
    expect(planTarget(plan({ endMonth: null }))).toBeNull();
  });
  it('clamps the save day to the end of the month', () => {
    expect(saveDate({ saveDay: 31 }, '2027-02')).toBe('2027-02-28');
    expect(saveDate({ saveDay: 27 }, '2026-09')).toBe('2026-09-27');
  });
});

describe('planStatus', () => {
  it('is upcoming before the start month and active after', () => {
    const p = plan({ startMonth: '2028-01', endMonth: '2032-12' });
    expect(planStatus(p, '2026-09', 0)).toBe('upcoming');
    expect(planStatus(p, '2028-01', 0)).toBe('active');
  });
  it('is done after the end month or when the target is reached', () => {
    expect(planStatus(plan(), '2027-11', 0)).toBe('done');
    expect(planStatus(plan({ targetAmount: 100000 }), '2026-10', 100000)).toBe('done');
  });
  it('is paused during a pause period', () => {
    const p = plan({ pauses: [{ from: '2026-11', to: '2026-12' }] });
    expect(planStatus(p, '2026-11', 0)).toBe('paused');
    expect(planStatus(p, '2027-01', 0)).toBe('active');
    expect(isActiveIn(plan({ pauses: [{ from: '2026-10', to: null }] }), '2027-05')).toBe(false);
  });
});

describe('monthSummary', () => {
  const plans = [
    plan(),
    plan({ id: 'p2', monthlyAmount: 70000, startMonth: '2027-07', endMonth: null }),
    plan({ id: 'p3', currency: 'JPY', monthlyAmount: 10000, saveDay: 10, endMonth: null }),
  ];
  it('only running plans are required; upcoming ones are not', () => {
    const s = monthSummary({
      plans,
      deposits: [dep('p1', '2026-09-27', 50000), dep('p1', '2026-08-01', 99999)],
      month: '2026-09',
      today: '2026-09-27',
    });
    expect(s.required).toEqual({ CNY: 71500, JPY: 10000 });
    expect(s.saved).toEqual({ CNY: 50000 });
    expect(s.owed).toEqual({ CNY: 21500, JPY: 10000 });
    expect(s.plans.map((p) => [p.planId, p.status, p.overdue])).toEqual([
      ['p1', 'active', true],
      ['p2', 'upcoming', false],
      ['p3', 'active', true],
    ]);
  });
  it('is not overdue before the save day', () => {
    const s = monthSummary({ plans, deposits: [], month: '2026-09', today: '2026-09-26' });
    expect(s.plans[0].overdue).toBe(false);
    expect(s.plans[2].overdue).toBe(true); // 10 号已过
  });
  it('the month that fills the target still counts as active', () => {
    const p = plan({ targetAmount: 100000 });
    const s = monthSummary({
      plans: [p],
      deposits: [dep('p1', '2026-09-27', 50000), dep('p1', '2026-10-27', 50000)],
      month: '2026-10',
      today: '2026-10-28',
    });
    expect(s.plans[0]).toMatchObject({ status: 'active', saved: 50000, owed: 21500 });
    expect(
      monthSummary({
        plans: [p],
        deposits: [dep('p1', '2026-09-27', 100000)],
        month: '2026-10',
        today: '2026-10-28',
      }).plans[0].status
    ).toBe('done');
  });
});

describe('savingsYearBars', () => {
  it('compares deposits with what was required each month', () => {
    const bars = savingsYearBars({
      plans: [plan()],
      deposits: [dep('p1', '2026-09-27', 71500), dep('p1', '2026-10-28', 50000)],
      year: 2026,
      currency: 'CNY',
      today: '2026-10-30',
    });
    expect(bars[7]).toMatchObject({ earned: 0, target: null });
    expect(bars[8]).toMatchObject({ earned: 71500, target: 71500, reached: true });
    expect(bars[9]).toMatchObject({ earned: 50000, target: 71500, reached: false });
  });
});

describe('pause / resume', () => {
  it('records pause periods by month', () => {
    const paused = pauseFrom([], '2026-11');
    expect(paused).toEqual([{ from: '2026-11', to: null }]);
    expect(pauseFrom(paused, '2026-12')).toBe(paused);
    expect(resumeIn(paused, '2027-02')).toEqual([{ from: '2026-11', to: '2027-01' }]);
    expect(resumeIn(paused, '2026-11')).toEqual([]);
  });
});
