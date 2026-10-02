import type { TFunction } from 'i18next';

import { demoFromQuery, DEMO_PREFIX, prepareDemo, seedDemoData } from '../demo';
import { createRepositories } from '../repository';
import { loadSettings } from '../settings';
import { MemoryDriver } from '../storage/memoryDriver';
import { WebDriver } from '../storage/webDriver';

const t = ((key: string) => key) as unknown as TFunction;

function setup(driver = new MemoryDriver()) {
  let n = 0;
  const repos = createRepositories(driver, { newId: () => `id-${++n}` });
  return { driver, repos };
}

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

describe('demoFromQuery', () => {
  it('turns on only for demo=1 / demo=true', () => {
    expect(demoFromQuery('?demo=1')).toBe(true);
    expect(demoFromQuery('?lang=ja&demo=true')).toBe(true);
    expect(demoFromQuery('?demo=0')).toBe(false);
    expect(demoFromQuery('?lang=ja')).toBe(false);
    expect(demoFromQuery('')).toBe(false);
    expect(demoFromQuery(undefined)).toBe(false);
  });
});

describe('seedDemoData', () => {
  it('fills the current month with jobs, shifts, tasks and events', async () => {
    const { repos } = setup();
    const now = new Date(2026, 9, 15); // 2026-10
    await seedDemoData(repos, t, now);

    expect(await repos.jobs.list()).toHaveLength(3);
    const shifts = await repos.shifts.list();
    expect(shifts.length).toBeGreaterThan(15);
    expect(shifts.every((s) => s.date.startsWith('2026-10-'))).toBe(true);
    // 日曜日（2026-10-04 など）は休み
    expect(shifts.some((s) => s.date === '2026-10-04')).toBe(false);
    expect(await repos.tasks.list()).toHaveLength(2);
    expect(await repos.events.list()).toHaveLength(2);
  });
});

describe('prepareDemo', () => {
  it('seeds once per month and sets Japanese defaults', async () => {
    const { driver, repos } = setup();
    const opts = { language: 'ja' as const, t, now: new Date(2026, 9, 15) };
    await prepareDemo(driver, repos, opts);
    const firstCount = (await repos.shifts.list()).length;
    await prepareDemo(driver, repos, opts);
    expect(await repos.shifts.list()).toHaveLength(firstCount);

    const settings = await loadSettings(driver);
    expect(settings.language).toBe('ja');
    expect(settings.holidayMode).toBe('jp');
    expect(settings.defaultCurrency).toBe('JPY');
    expect(settings.showLunar).toBe(false);
  });

  it('starts over in a new month', async () => {
    const { driver, repos } = setup();
    await prepareDemo(driver, repos, { language: 'ja', t, now: new Date(2026, 9, 15) });
    await prepareDemo(driver, repos, { language: 'ja', t, now: new Date(2026, 10, 3) });
    const shifts = await repos.shifts.list();
    expect(shifts.every((s) => s.date.startsWith('2026-11-'))).toBe(true);
  });

  it('keeps the demo data apart from the normal web data', async () => {
    const storage = fakeStorage();
    const normal = new WebDriver(storage);
    await normal.init();
    await normal.setSetting('language', JSON.stringify('zh'));

    const demoDriver = new WebDriver(storage, DEMO_PREFIX);
    await demoDriver.init();
    const { repos } = setup(demoDriver);
    await prepareDemo(demoDriver, repos, { language: 'ja', t, now: new Date(2026, 9, 15) });

    const reopened = new WebDriver(storage);
    await reopened.init();
    expect((await reopened.getAll('jobs')).length).toBe(0);
    expect((await loadSettings(reopened)).language).toBe('zh');
  });
});
