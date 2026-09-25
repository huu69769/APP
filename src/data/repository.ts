import { nowIso } from '@/lib/date';

import type { StorageDriver } from './storage/types';
import type { BaseEntity, EntityTables, NewEntity, TableName } from './types';

export interface RepositoryDeps {
  newId: () => string;
  now?: () => Date;
  /** 每次写入后调用，用于通知界面刷新 */
  onChange?: (table: TableName) => void;
}

/**
 * 通用的数据仓库（repository 层）。界面代码只通过它读写数据，
 * 不关心底层是 SQLite、浏览器存储还是以后的云同步。
 *
 * 所有读取方法默认都不返回已软删除的记录。
 */
export class Repository<T extends BaseEntity> {
  constructor(
    private readonly driver: StorageDriver,
    readonly table: TableName,
    private readonly deps: RepositoryDeps
  ) {}

  private timestamp(): string {
    return nowIso(this.deps.now?.() ?? new Date());
  }

  async list(): Promise<T[]> {
    return ((await this.driver.getAll(this.table)) as T[]).filter((r) => !r.deletedAt);
  }

  /** 包括已删除的记录（比如已删除兼职的颜色，旧班次还要用） */
  async listWithDeleted(): Promise<T[]> {
    return (await this.driver.getAll(this.table)) as T[];
  }

  async get(id: string): Promise<T | null> {
    const row = (await this.driver.getById(this.table, id)) as T | null;
    return row && !row.deletedAt ? row : null;
  }

  /** 按日期范围读取（含两端），只用于有 date 字段的表 */
  async listByDateRange(from: string, to: string): Promise<T[]> {
    const rows = (await this.driver.getByDateRange(this.table, from, to)) as T[];
    return rows.filter((r) => !r.deletedAt);
  }

  async create(input: NewEntity<T>): Promise<T> {
    const ts = this.timestamp();
    const row = {
      ...input,
      id: this.deps.newId(),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    } as T;
    await this.driver.put(this.table, row);
    this.deps.onChange?.(this.table);
    return row;
  }

  async update(id: string, patch: Partial<NewEntity<T>>): Promise<T> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`${this.table}: record ${id} not found`);
    const row = { ...existing, ...patch, id, updatedAt: this.timestamp() } as T;
    await this.driver.put(this.table, row);
    this.deps.onChange?.(this.table);
    return row;
  }

  /** 软删除：只写 deletedAt，记录仍保留（以后云同步需要知道哪些被删了） */
  async remove(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const ts = this.timestamp();
    await this.driver.put(this.table, { ...existing, deletedAt: ts, updatedAt: ts });
    this.deps.onChange?.(this.table);
  }

  /** 撤销删除（「元に戻す / 撤销」用） */
  async restore(id: string): Promise<void> {
    const row = (await this.driver.getById(this.table, id)) as T | null;
    if (!row || !row.deletedAt) return;
    await this.driver.put(this.table, { ...row, deletedAt: null, updatedAt: this.timestamp() });
    this.deps.onChange?.(this.table);
  }
}

export type Repositories = { [K in TableName]: Repository<EntityTables[K]> };

export function createRepositories(driver: StorageDriver, deps: RepositoryDeps): Repositories {
  return {
    jobs: new Repository(driver, 'jobs', deps),
    shift_templates: new Repository(driver, 'shift_templates', deps),
    shifts: new Repository(driver, 'shifts', deps),
    tasks: new Repository(driver, 'tasks', deps),
    events: new Repository(driver, 'events', deps),
    anniversaries: new Repository(driver, 'anniversaries', deps),
    day_notes: new Repository(driver, 'day_notes', deps),
    holidays_cache: new Repository(driver, 'holidays_cache', deps),
  };
}
