import type { BaseEntity, TableName } from '../types';

/** 整个数据库的快照，用于备份导出 / 导入，以及以后的云同步。 */
export interface DataDump {
  schemaVersion: number;
  tables: Record<TableName, BaseEntity[]>;
  settings: Record<string, string>;
}

/**
 * 底层存储接口。界面和业务代码不直接用它，而是通过 repository 层。
 *
 * - 手机上：SQLite（sqliteDriver）
 * - 网页上：浏览器 localStorage（webDriver）
 * - 以后接云同步：再实现一个 driver，或在 repository 层加同步逻辑，界面代码不用改
 */
export interface StorageDriver {
  init(): Promise<void>;
  /** 读取整张表（包括已软删除的记录） */
  getAll(table: TableName): Promise<BaseEntity[]>;
  getById(table: TableName, id: string): Promise<BaseEntity | null>;
  /** 按日期范围读取（含两端），只用于有 date 字段的表；包括已软删除的记录 */
  getByDateRange(table: TableName, from: string, to: string): Promise<BaseEntity[]>;
  /** 新增或覆盖一条记录 */
  put(table: TableName, row: BaseEntity): Promise<void>;

  getAllSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;

  exportAll(): Promise<DataDump>;
  /** 用快照整体替换所有数据 */
  importAll(dump: DataDump): Promise<void>;
}

export const SCHEMA_VERSION = 1;
