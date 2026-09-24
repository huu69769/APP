import { SqliteDriver } from './sqliteDriver';
import type { StorageDriver } from './types';

/** 手机上使用 SQLite。网页版见 index.web.ts。 */
export function createDefaultDriver(): StorageDriver {
  return new SqliteDriver();
}
