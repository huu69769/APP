import { TABLE_NAMES, type BaseEntity, type TableName } from '../types';
import { MemoryDriver } from './memoryDriver';

const PREFIX = 'worklog:';

/**
 * 网页版存储：数据放在浏览器的 localStorage 里。
 * 注意：网页版的数据和手机上的数据是分开的（PRD 5.9）。
 */
export class WebDriver extends MemoryDriver {
  constructor(private readonly storage: Storage = globalThis.localStorage) {
    super();
  }

  async init(): Promise<void> {
    for (const t of TABLE_NAMES) {
      const rows = this.read<BaseEntity[]>(`${PREFIX}${t}`) ?? [];
      this.tables[t] = new Map(rows.map((r) => [r.id, r]));
    }
    this.settings = this.read<Record<string, string>>(`${PREFIX}settings`) ?? {};
  }

  protected persist(table: TableName): void {
    this.storage.setItem(`${PREFIX}${table}`, JSON.stringify([...this.tables[table].values()]));
  }

  protected persistSettings(): void {
    this.storage.setItem(`${PREFIX}settings`, JSON.stringify(this.settings));
  }

  private read<T>(key: string): T | null {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
