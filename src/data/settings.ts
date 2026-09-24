import type { WeekStart } from '@/lib/calendar';

import type { StorageDriver } from './storage/types';
import type { Currency } from './types';

export type Language = 'zh' | 'ja';
export type StatsPeriod = 'calendarMonth' | 'payPeriod';
export type WageDisplay = 'total' | 'split';
export type HolidayMode = 'cn' | 'jp' | 'both' | 'none';

export interface Settings {
  /** 界面语言（和节假日国家是两个独立的设置） */
  language: Language;
  defaultCurrency: Currency;
  weekStart: WeekStart;
  statsPeriod: StatsPeriod;
  wageDisplay: WageDisplay;
  holidayMode: HolidayMode;
  showLunar: boolean;
  /** 上次备份时间（ISO），null = 从未备份 */
  lastBackupAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  defaultCurrency: 'CNY',
  weekStart: 0,
  statsPeriod: 'calendarMonth',
  wageDisplay: 'total',
  holidayMode: 'cn',
  showLunar: true,
  lastBackupAt: null,
};

/** 设置在存储里是键值对，值用 JSON 编码 */
export async function loadSettings(driver: StorageDriver): Promise<Settings> {
  const raw = await driver.getAllSettings();
  const result: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (raw[key] === undefined) continue;
    try {
      (result as unknown as Record<string, unknown>)[key] = JSON.parse(raw[key]);
    } catch {
      // 坏数据就保留默认值
    }
  }
  return result;
}

export async function saveSettings(driver: StorageDriver, patch: Partial<Settings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await driver.setSetting(key, JSON.stringify(value));
  }
}
