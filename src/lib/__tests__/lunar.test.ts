import { lunarInfo } from '../lunar';

describe('lunarInfo', () => {
  it('shows traditional festivals first', () => {
    expect(lunarInfo('2026-09-25')).toEqual({
      date: '八月十五',
      special: '中秋节',
      short: '中秋节',
    });
    expect(lunarInfo('2026-02-17').short).toBe('春节');
    expect(lunarInfo('2026-02-16').short).toBe('除夕');
  });

  it('shows solar terms', () => {
    expect(lunarInfo('2026-04-05')).toMatchObject({ special: '清明', short: '清明' });
  });

  it('shows the month name on the first day of a lunar month', () => {
    expect(lunarInfo('2025-07-25')).toMatchObject({ date: '闰六月初一', short: '闰六月' });
  });

  it('shows the day otherwise', () => {
    expect(lunarInfo('2026-09-24')).toEqual({ date: '八月十四', special: null, short: '十四' });
  });
});
