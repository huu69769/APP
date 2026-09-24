import { DATED_TABLES, TABLE_NAMES, type BaseEntity, type TableName } from '../types';
import { SCHEMA_VERSION, type DataDump, type StorageDriver } from './types';

type Tables = Record<TableName, Map<string, BaseEntity>>;

function emptyTables(): Tables {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, new Map()])) as Tables;
}

/**
 * 内存存储：用于单元测试，也是网页版存储的基础。
 */
export class MemoryDriver implements StorageDriver {
  protected tables: Tables = emptyTables();
  protected settings: Record<string, string> = {};

  async init(): Promise<void> {}

  async getAll(table: TableName): Promise<BaseEntity[]> {
    return [...this.tables[table].values()].map(clone);
  }

  async getById(table: TableName, id: string): Promise<BaseEntity | null> {
    const row = this.tables[table].get(id);
    return row ? clone(row) : null;
  }

  async getByDateRange(table: TableName, from: string, to: string): Promise<BaseEntity[]> {
    if (!DATED_TABLES.includes(table)) throw new Error(`Table ${table} has no date column`);
    return (await this.getAll(table)).filter((row) => {
      const date = (row as BaseEntity & { date: string }).date;
      return date >= from && date <= to;
    });
  }

  async put(table: TableName, row: BaseEntity): Promise<void> {
    this.tables[table].set(row.id, clone(row));
    this.persist(table);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    return { ...this.settings };
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings[key] = value;
    this.persistSettings();
  }

  async exportAll(): Promise<DataDump> {
    const tables = {} as DataDump['tables'];
    for (const t of TABLE_NAMES) tables[t] = await this.getAll(t);
    return { schemaVersion: SCHEMA_VERSION, tables, settings: { ...this.settings } };
  }

  async importAll(dump: DataDump): Promise<void> {
    const tables = emptyTables();
    for (const t of TABLE_NAMES) {
      for (const row of dump.tables[t] ?? []) tables[t].set(row.id, clone(row));
    }
    this.tables = tables;
    this.settings = { ...dump.settings };
    TABLE_NAMES.forEach((t) => this.persist(t));
    this.persistSettings();
  }

  /** 子类（网页版）覆盖这两个方法把数据写进浏览器 */
  protected persist(_table: TableName): void {}
  protected persistSettings(): void {}
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
