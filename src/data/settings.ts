import type { WeekStart } from '@/lib/calendar';

import type { StorageDriver } from './storage/types';
import type { Currency } from './types';

export type Language = 'zh' | 'ja';
export type StatsPeriod = 'calendarMonth' | 'payPeriod';
export type WageDisplay = 'total' | 'split';
export type HolidayMode = 'cn' | 'jp' | 'both' | 'none';
export type CalendarView = 'work' | 'schedule';
export type CalendarRange = 'month' | 'week';
/** 外观：跟随系统 / 浅色 / 深色（夜间模式） */
export type ThemeMode = 'system' | 'light' | 'dark';

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
  /** 首页「该备份了」提示被关掉的时间（ISO） */
  backupReminderDismissedAt: string | null;
  /** 首页月历的显示方式：work = 班次显示成色块；schedule = 日程显示成色块 */
  calendarView: CalendarView;
  /** 首页显示月历还是周视图 */
  calendarRange: CalendarRange;
  theme: ThemeMode;
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
  backupReminderDismissedAt: null,
  calendarView: 'work',
  calendarRange: 'month',
  theme: 'system',
};

/**
 * 第一次打开时按手机的系统语言决定默认设置：
 * 系统是日语 → 日语界面、日本节假日、日元；其他语言 → 中文界面、中国节假日、人民币（默认值）。
 */
export function localeDefaults(systemLanguage: string | null | undefined): Partial<Settings> {
  if (systemLanguage?.toLowerCase().startsWith('ja')) {
    return { language: 'ja', holidayMode: 'jp', defaultCurrency: 'JPY' };
  }
  return {};
}

/**
 * 设置在存储里是键值对，值用 JSON 编码。
 * 还一个设置都没保存过（第一次打开）时，按系统语言定好默认值并保存下来，
 * 之后改了系统语言也不会再变（在「设置」里可以随时改）。
 */
export async function loadSettings(
  driver: StorageDriver,
  systemLanguage?: string | null
): Promise<Settings> {
  const raw = await driver.getAllSettings();
  if (Object.keys(raw).length === 0) {
    const initial = localeDefaults(systemLanguage);
    if (Object.keys(initial).length > 0) {
      await saveSettings(driver, initial);
      Object.assign(raw, await driver.getAllSettings());
    }
  }
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
