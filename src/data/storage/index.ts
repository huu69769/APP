import { SqliteDriver } from './sqliteDriver';
import type { StorageDriver } from './types';

/** 手机上使用 SQLite。网页版见 index.web.ts（演示模式只在网页版有效）。 */
export function createDefaultDriver(_options: { demo?: boolean } = {}): StorageDriver {
  return new SqliteDriver();
}
