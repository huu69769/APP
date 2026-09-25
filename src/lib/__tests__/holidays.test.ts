import cnBundled from '@/holidays/bundled/cn.json';
import jpBundled from '@/holidays/bundled/jp.json';

import { buildMarks, countriesForMode, needsRefresh, parseCnJson, parseJpYaml } from '../holidays';

describe('parseCnJson', () => {
  it('keeps off days and make-up work days', () => {
    const days = parseCnJson({
      year: 2026,
      days: [
        { name: '国庆节', date: '2026-10-01', isOffDay: true },
        { name: '国庆节', date: '2026-10-10', isOffDay: false },
        { bad: true },
      ],
    });
    expect(days).toEqual([
      { date: '2026-10-01', name: '国庆节', off: true },
      { date: '2026-10-10', name: '国庆节', off: false },
    ]);
  });

  it('rejects malformed data', () => {
    expect(() => parseCnJson({})).toThrow();
  });
});

describe('parseJpYaml', () => {
  it('groups holidays by year, including substitute holidays', () => {
    const byYear = parseJpYaml(
      '---\n2026-05-05: こどもの日\n2026-05-06: こどもの日 振替休日\n2027-01-01: 元日\nnot a line\n'
    );
    expect(byYear.get(2026)).toEqual([
      { date: '2026-05-05', name: 'こどもの日', off: true },
      { date: '2026-05-06', name: 'こどもの日 振替休日', off: true },
    ]);
    expect(byYear.get(2027)).toHaveLength(1);
  });
});

describe('buildMarks', () => {
  it('merges countries on the same date', () => {
    const marks = buildMarks([
      { country: 'CN', days: [{ date: '2026-01-01', name: '元旦', off: true }] },
      { country: 'JP', days: [{ date: '2026-01-01', name: '元日', off: true }] },
    ]);
    expect(marks.get('2026-01-01')?.map((m) => m.country)).toEqual(['CN', 'JP']);
  });
});

describe('countriesForMode', () => {
  it('maps display modes to countries', () => {
    expect(countriesForMode('both')).toEqual(['CN', 'JP']);
    expect(countriesForMode('none')).toEqual([]);
  });
});

describe('needsRefresh', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  it('refreshes missing data and stale current/next year data only', () => {
    expect(needsRefresh({ year: 2026, currentYear: 2026, fetchedAt: null, now })).toBe(true);
    expect(
      needsRefresh({ year: 2026, currentYear: 2026, fetchedAt: '2026-09-24T00:00:00Z', now })
    ).toBe(false);
    expect(
      needsRefresh({ year: 2027, currentYear: 2026, fetchedAt: '2026-09-20T00:00:00Z', now })
    ).toBe(true);
    expect(
      needsRefresh({ year: 2024, currentYear: 2026, fetchedAt: '2025-01-01T00:00:00Z', now })
    ).toBe(false);
  });
});

describe('bundled data', () => {
  it('includes the current Chinese schedule with make-up work days', () => {
    const cn2026 = (cnBundled as Record<string, { date: string; off: boolean }[]>)['2026'];
    expect(cn2026.some((d) => d.date === '2026-10-01' && d.off)).toBe(true);
    expect(cn2026.some((d) => !d.off)).toBe(true);
  });

  it('includes Japanese holidays with substitute holidays', () => {
    const jp2026 = (jpBundled as Record<string, { date: string; name: string }[]>)['2026'];
    expect(jp2026.find((d) => d.date === '2026-05-06')?.name).toContain('振替休日');
  });
});
