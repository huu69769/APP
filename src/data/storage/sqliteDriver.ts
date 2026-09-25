import * as SQLite from 'expo-sqlite';

import { DATED_TABLES, TABLE_NAMES, type BaseEntity, type TableName } from '../types';
import { SCHEMA_VERSION, type DataDump, type StorageDriver } from './types';

const DB_NAME = 'worklog.db';

interface Row {
  data: string;
}

/**
 * 手机上的存储：SQLite。
 *
 * 每张表的结构都一样：公共字段 + date（方便按日期查）+ data（整条记录的 JSON）。
 * 这样以后给记录加字段（比如 premiumRules）时不需要改表结构，
 * 也让手机版和网页版的存储逻辑保持一致。
 */
export class SqliteDriver implements StorageDriver {
  private db: SQLite.SQLiteDatabase | null = null;

  private get conn(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('SqliteDriver not initialised');
    return this.db;
  }

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    await this.migrate();
  }

  private async migrate(): Promise<void> {
    const result = await this.conn.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const current = result?.user_version ?? 0;
    if (current >= SCHEMA_VERSION) return;

    // 每个版本只是新增表，所以统一用 CREATE TABLE IF NOT EXISTS 补齐缺少的表：
    // 0 → 1：建立所有表　1 → 2：新增 tasks 表　2 → 3：新增 anniversaries 表
    // 以后如果要改已有表的结构，在这里按版本号追加迁移步骤：if (current < 3) { ... }
    const statements = current === 0 ? ['PRAGMA journal_mode = WAL;'] : [];
    for (const t of TABLE_NAMES) {
      statements.push(`CREATE TABLE IF NOT EXISTS ${t} (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        data TEXT NOT NULL
      );`);
      if (DATED_TABLES.includes(t)) {
        statements.push(`CREATE INDEX IF NOT EXISTS idx_${t}_date ON ${t}(date);`);
      }
    }
    statements.push(
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
    );
    await this.conn.execAsync(statements.join('\n'));

    await this.conn.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  async getAll(table: TableName): Promise<BaseEntity[]> {
    const rows = await this.conn.getAllAsync<Row>(`SELECT data FROM ${table}`);
    return rows.map((r) => JSON.parse(r.data));
  }

  async getById(table: TableName, id: string): Promise<BaseEntity | null> {
    const row = await this.conn.getFirstAsync<Row>(`SELECT data FROM ${table} WHERE id = ?`, id);
    return row ? JSON.parse(row.data) : null;
  }

  async getByDateRange(table: TableName, from: string, to: string): Promise<BaseEntity[]> {
    if (!DATED_TABLES.includes(table)) throw new Error(`Table ${table} has no date column`);
    const rows = await this.conn.getAllAsync<Row>(
      `SELECT data FROM ${table} WHERE date >= ? AND date <= ?`,
      from,
      to
    );
    return rows.map((r) => JSON.parse(r.data));
  }

  async put(table: TableName, row: BaseEntity): Promise<void> {
    await this.putWith(this.conn, table, row);
  }

  private async putWith(db: SQLite.SQLiteDatabase, table: TableName, row: BaseEntity) {
    const date = (row as BaseEntity & { date?: string }).date ?? null;
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (id, date, createdAt, updatedAt, deletedAt, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row.id,
      date,
      row.createdAt,
      row.updatedAt,
      row.deletedAt,
      JSON.stringify(row)
    );
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.conn.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.conn.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      key,
      value
    );
  }

  async exportAll(): Promise<DataDump> {
    const tables = {} as DataDump['tables'];
    for (const t of TABLE_NAMES) tables[t] = await this.getAll(t);
    return { schemaVersion: SCHEMA_VERSION, tables, settings: await this.getAllSettings() };
  }

  async importAll(dump: DataDump): Promise<void> {
    await this.conn.withExclusiveTransactionAsync(async (txn) => {
      for (const t of TABLE_NAMES) {
        await txn.runAsync(`DELETE FROM ${t}`);
        for (const row of dump.tables[t] ?? []) await this.putWith(txn, t, row);
      }
      await txn.runAsync('DELETE FROM settings');
      for (const [key, value] of Object.entries(dump.settings)) {
        await txn.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
      }
    });
  }
}
