import { createRepositories } from '@/data/repository';
import { MemoryDriver } from '@/data/storage/memoryDriver';

import { HOLIDAY_PROVIDERS } from '../providers';
import { loadHolidayYear, refreshHolidayYear } from '../service';

function setup() {
  let n = 0;
  return createRepositories(new MemoryDriver(), { newId: () => `id-${++n}` });
}

describe('holiday service', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  afterEach(() => jest.restoreAllMocks());

  it('falls back to bundled data when nothing is cached', async () => {
    const repos = setup();
    const days = await loadHolidayYear(repos, 'CN', 2026);
    expect(days.some((d) => d.date === '2026-10-01')).toBe(true);
  });

  it('saves downloaded data and prefers it over bundled data', async () => {
    const repos = setup();
    jest
      .spyOn(HOLIDAY_PROVIDERS.CN, 'fetchYear')
      .mockResolvedValue([{ date: '2027-01-01', name: '元旦', off: true }]);
    await refreshHolidayYear(repos, 'CN', 2027, now);
    expect(await loadHolidayYear(repos, 'CN', 2027)).toEqual([
      { date: '2027-01-01', name: '元旦', off: true },
    ]);
  });

  it('keeps saved data when the source has nothing and does not refetch in the same session', async () => {
    const repos = setup();
    await repos.holidays_cache.create({
      country: 'JP',
      year: 2026,
      data: JSON.stringify([{ date: '2026-01-01', name: '元日', off: true }]),
      fetchedAt: '2026-01-01T00:00:00Z',
    });
    const spy = jest.spyOn(HOLIDAY_PROVIDERS.JP, 'fetchYear').mockResolvedValue(null);
    await refreshHolidayYear(repos, 'JP', 2026, now);
    await refreshHolidayYear(repos, 'JP', 2026, now);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await loadHolidayYear(repos, 'JP', 2026)).toHaveLength(1);
  });

  it('does not save anything when the network fails', async () => {
    const repos = setup();
    jest.spyOn(HOLIDAY_PROVIDERS.CN, 'fetchYear').mockRejectedValue(new Error('offline'));
    await refreshHolidayYear(repos, 'CN', 2028, now);
    expect(await repos.holidays_cache.list()).toHaveLength(0);
  });
});
