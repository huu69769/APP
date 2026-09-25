import { createRepositories } from '@/data/repository';
import { MemoryDriver } from '@/data/storage/memoryDriver';

import {
  BackupError,
  backupFileName,
  countBackup,
  parseBackup,
  serializeBackup,
  shouldRemindBackup,
} from '../backup';

async function sampleDump() {
  const driver = new MemoryDriver();
  let n = 0;
  const repos = createRepositories(driver, { newId: () => `id-${++n}` });
  const job = await repos.jobs.create({
    name: '便利店',
    color: '#f00',
    hourlyWage: 2500,
    currency: 'CNY',
    cutoffDay: null,
    defaultBreakMinutes: 0,
  });
  await repos.day_notes.create({ date: '2026-09-25', content: '笔记' });
  const gone = await repos.day_notes.create({ date: '2026-09-26', content: 'x' });
  await repos.day_notes.remove(gone.id);
  await driver.setSetting('language', '"ja"');
  return { driver, dump: await driver.exportAll(), job };
}

describe('backup round trip', () => {
  it('restores everything that was exported', async () => {
    const { dump } = await sampleDump();
    const text = serializeBackup(dump, new Date('2026-09-25T00:00:00Z'));
    const parsed = parseBackup(text);
    expect(parsed).toEqual(dump);

    const target = new MemoryDriver();
    await target.importAll(parsed);
    expect(await target.exportAll()).toEqual(dump);
  });

  it('counts live records for the confirmation message', async () => {
    const { dump } = await sampleDump();
    expect(countBackup(dump)).toEqual({ jobs: 1, shifts: 0, tasks: 0, events: 0, notes: 1 });
  });
});

describe('parseBackup', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof BackupError ? e.code : 'other';
    }
    return null;
  };

  it('rejects files that are not backups', () => {
    expect(code(() => parseBackup('not json'))).toBe('notJson');
    expect(code(() => parseBackup('{"hello":1}'))).toBe('wrongFormat');
    expect(code(() => parseBackup('null'))).toBe('wrongFormat');
  });

  it('rejects backups from a newer app version', () => {
    expect(
      code(() => parseBackup(JSON.stringify({ format: 'worklog-calendar-backup', version: 99 })))
    ).toBe('newerVersion');
  });

  it('rejects corrupt tables', () => {
    expect(
      code(() =>
        parseBackup(
          JSON.stringify({ format: 'worklog-calendar-backup', version: 1, tables: { jobs: [{}] } })
        )
      )
    ).toBe('corrupt');
  });

  it('fills in tables missing from older backups', () => {
    const dump = parseBackup(
      JSON.stringify({ format: 'worklog-calendar-backup', version: 1, tables: {}, settings: {} })
    );
    expect(dump.tables.tasks).toEqual([]);
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 8, 5, 23, 0))).toBe('worklog-backup-2026-09-05.json');
  });
});

describe('shouldRemindBackup', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  it('reminds 30 days after the last backup', () => {
    expect(
      shouldRemindBackup({
        lastBackupAt: '2026-08-20T00:00:00Z',
        dismissedAt: null,
        oldestDataAt: null,
        now,
      })
    ).toBe(true);
    expect(
      shouldRemindBackup({
        lastBackupAt: '2026-09-01T00:00:00Z',
        dismissedAt: null,
        oldestDataAt: null,
        now,
      })
    ).toBe(false);
  });

  it('uses the oldest data when never backed up, and nothing when there is no data', () => {
    expect(
      shouldRemindBackup({
        lastBackupAt: null,
        dismissedAt: null,
        oldestDataAt: '2026-07-01T00:00:00Z',
        now,
      })
    ).toBe(true);
    expect(
      shouldRemindBackup({ lastBackupAt: null, dismissedAt: null, oldestDataAt: null, now })
    ).toBe(false);
  });

  it('stays quiet for 30 days after being dismissed', () => {
    expect(
      shouldRemindBackup({
        lastBackupAt: '2026-01-01T00:00:00Z',
        dismissedAt: '2026-09-20T00:00:00Z',
        oldestDataAt: null,
        now,
      })
    ).toBe(false);
  });
});
