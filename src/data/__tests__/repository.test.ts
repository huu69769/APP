import { Repository } from '../repository';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../settings';
import { MemoryDriver } from '../storage/memoryDriver';
import { WebDriver } from '../storage/webDriver';
import type { DayNote, Job } from '../types';

function makeDeps() {
  let n = 0;
  let t = Date.UTC(2026, 8, 1);
  return {
    newId: () => `id-${++n}`,
    now: () => new Date((t += 1000)),
  };
}

const job = {
  name: 'Cafe',
  color: '#ff0000',
  hourlyWage: 2500,
  currency: 'CNY' as const,
  cutoffDay: null,
  defaultBreakMinutes: 0,
};

describe('Repository', () => {
  it('creates records with common fields', async () => {
    const repo = new Repository<Job>(new MemoryDriver(), 'jobs', makeDeps());
    const created = await repo.create(job);
    expect(created).toMatchObject({ ...job, id: 'id-1', deletedAt: null });
    expect(created.createdAt).toBe(created.updatedAt);
    expect(await repo.get('id-1')).toEqual(created);
  });

  it('updates fields and bumps updatedAt', async () => {
    const repo = new Repository<Job>(new MemoryDriver(), 'jobs', makeDeps());
    const created = await repo.create(job);
    const updated = await repo.update(created.id, { hourlyWage: 3000 });
    expect(updated.hourlyWage).toBe(3000);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it('soft-deletes records and hides them from reads', async () => {
    const driver = new MemoryDriver();
    const repo = new Repository<Job>(driver, 'jobs', makeDeps());
    const a = await repo.create(job);
    await repo.create({ ...job, name: 'Shop' });
    await repo.remove(a.id);
    expect((await repo.list()).map((j) => j.name)).toEqual(['Shop']);
    expect(await repo.get(a.id)).toBeNull();
    // 底层仍保留记录，只是打了 deletedAt 标记
    const raw = await driver.getById('jobs', a.id);
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('queries dated tables by inclusive date range', async () => {
    const repo = new Repository<DayNote>(new MemoryDriver(), 'day_notes', makeDeps());
    for (const date of ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01']) {
      await repo.create({ date, content: date });
    }
    const rows = await repo.listByDateRange('2026-09-01', '2026-09-30');
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-09-01', '2026-09-30']);
  });
});

describe('settings', () => {
  it('returns defaults and persists changes', async () => {
    const driver = new MemoryDriver();
    expect(await loadSettings(driver)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(driver, { language: 'ja', weekStart: 1, showLunar: false });
    expect(await loadSettings(driver)).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'ja',
      weekStart: 1,
      showLunar: false,
    });
  });
});

describe('settings on first launch', () => {
  it('uses Japanese defaults when the system language is Japanese', async () => {
    const driver = new MemoryDriver();
    expect(await loadSettings(driver, 'ja')).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'ja',
      holidayMode: 'jp',
      defaultCurrency: 'JPY',
    });
    // 保存下来了：之后系统语言变了也不再改
    expect((await loadSettings(driver, 'zh')).language).toBe('ja');
  });

  it('keeps Chinese defaults for other system languages', async () => {
    expect(await loadSettings(new MemoryDriver(), 'zh')).toEqual(DEFAULT_SETTINGS);
    expect(await loadSettings(new MemoryDriver(), 'en')).toEqual(DEFAULT_SETTINGS);
    expect(await loadSettings(new MemoryDriver(), null)).toEqual(DEFAULT_SETTINGS);
  });

  it('does not touch existing users', async () => {
    const driver = new MemoryDriver();
    await saveSettings(driver, { showLunar: false });
    expect((await loadSettings(driver, 'ja')).language).toBe('zh');
  });
});

describe('income targets migration', () => {
  it('moves the old single monthly target to the current month', async () => {
    const driver = new MemoryDriver();
    await driver.setSetting('monthlyTarget', JSON.stringify({ amount: 50000, currency: 'JPY' }));
    const s = await loadSettings(driver);
    expect(Object.values(s.monthlyTargets)).toEqual([{ amount: 50000, currency: 'JPY' }]);
  });
});

describe('WebDriver', () => {
  it('persists data across instances via Storage', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;

    const d1 = new WebDriver(storage);
    await d1.init();
    await new Repository<Job>(d1, 'jobs', makeDeps()).create(job);
    await saveSettings(d1, { language: 'ja' });

    const d2 = new WebDriver(storage);
    await d2.init();
    expect(await new Repository<Job>(d2, 'jobs', makeDeps()).list()).toHaveLength(1);
    expect((await loadSettings(d2)).language).toBe('ja');
  });

  it('round-trips export and import', async () => {
    const d1 = new MemoryDriver();
    await new Repository<Job>(d1, 'jobs', makeDeps()).create(job);
    const dump = await d1.exportAll();
    const d2 = new MemoryDriver();
    await d2.importAll(dump);
    expect(await d2.exportAll()).toEqual(dump);
  });
});
