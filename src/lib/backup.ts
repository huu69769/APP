import type { DataDump } from '@/data/storage/types';
import { SCHEMA_VERSION } from '@/data/storage/types';
import { TABLE_NAMES, type BaseEntity, type TableName } from '@/data/types';

/** 备份文件的格式标识，导入时用来确认是不是本 app 的备份 */
export const BACKUP_FORMAT = 'worklog-calendar-backup';
export const BACKUP_VERSION = 1;
/** 超过多少天没备份，首页提示一次 */
export const BACKUP_REMIND_DAYS = 30;

export type BackupErrorCode = 'notJson' | 'wrongFormat' | 'newerVersion' | 'corrupt';

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
  }
}

interface BackupFile extends DataDump {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
}

/** 把全部数据变成备份文件的内容（JSON 文本） */
export function serializeBackup(dump: DataDump, now: Date = new Date()): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    ...dump,
  };
  return JSON.stringify(file, null, 1);
}

/** 读取备份文件；格式不对会抛出 BackupError */
export function parseBackup(text: string): DataDump {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('notJson');
  }
  const file = json as Partial<BackupFile> | null;
  if (!file || typeof file !== 'object' || file.format !== BACKUP_FORMAT) {
    throw new BackupError('wrongFormat');
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new BackupError('newerVersion');
  }
  if (typeof file.schemaVersion === 'number' && file.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('newerVersion');
  }
  const tables = {} as Record<TableName, BaseEntity[]>;
  for (const t of TABLE_NAMES) {
    const rows = (file.tables as Record<string, unknown> | undefined)?.[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupError('corrupt');
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as BaseEntity).id !== 'string') {
        throw new BackupError('corrupt');
      }
    }
    tables[t] = rows as BaseEntity[];
  }
  const settings: Record<string, string> = {};
  for (const [k, v] of Object.entries(file.settings ?? {})) {
    if (typeof v === 'string') settings[k] = v;
  }
  return { schemaVersion: file.schemaVersion ?? SCHEMA_VERSION, tables, settings };
}

/** 备份里各类数据的条数（不算已删除的），导入前给用户确认 */
export function countBackup(dump: DataDump): {
  jobs: number;
  shifts: number;
  tasks: number;
  events: number;
  notes: number;
} {
  const live = (t: TableName) => dump.tables[t].filter((r) => !r.deletedAt).length;
  return {
    jobs: live('jobs'),
    shifts: live('shifts'),
    tasks: live('tasks'),
    events: live('events'),
    notes: live('day_notes'),
  };
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `worklog-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * 首页要不要提示「该备份了」：
 * - 从上次备份（从没备份过就从第一条数据）算起超过 30 天
 * - 提示后用户点了「知道了」，30 天内不再提示
 */
export function shouldRemindBackup(params: {
  lastBackupAt: string | null;
  dismissedAt: string | null;
  /** 最早一条数据的创建时间；没有数据为 null */
  oldestDataAt: string | null;
  now: Date;
}): boolean {
  const days = (iso: string) => (params.now.getTime() - new Date(iso).getTime()) / 86400000;
  const base = params.lastBackupAt ?? params.oldestDataAt;
  if (!base || days(base) < BACKUP_REMIND_DAYS) return false;
  if (params.dismissedAt && days(params.dismissedAt) < BACKUP_REMIND_DAYS) return false;
  return true;
}
