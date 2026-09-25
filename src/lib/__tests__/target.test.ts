import { targetProgress } from '../target';

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
  it('caps the bar at 100% but keeps the real percent', () => {
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
