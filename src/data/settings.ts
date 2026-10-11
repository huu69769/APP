import type { WeekStart } from '@/lib/calendar';
import { currentMonth } from '@/lib/date';
import type { MonthlyTargets } from '@/lib/target';

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
/** 钱包标签显示收入统计还是存钱计划 */
export type WalletView = 'income' | 'savings';

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
  /** 每个月单独的收入目标（键 "YYYY-MM"）；年目标 = 各月目标加起来 */
  monthlyTargets: MonthlyTargets;
  walletView: WalletView;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'ja',
  defaultCurrency: 'JPY',
  weekStart: 0,
  statsPeriod: 'calendarMonth',
  wageDisplay: 'total',
  holidayMode: 'jp',
  showLunar: true,
  lastBackupAt: null,
  backupReminderDismissedAt: null,
  calendarView: 'work',
  calendarRange: 'month',
  theme: 'system',
  monthlyTargets: {},
  walletView: 'income',
};

/**
 * 第一次打开时按手机的系统语言决定默认设置：
 * 系统是中文 → 中文界面、中国节假日、人民币；其他语言 → 日语界面、日本节假日、日元（默认值）。
 */
export function localeDefaults(systemLanguage: string | null | undefined): Partial<Settings> {
  if (systemLanguage?.toLowerCase().startsWith('zh')) {
    return { language: 'zh', holidayMode: 'cn', defaultCurrency: 'CNY' };
  }
  return {};
}

/** 旧版本的默认值是中文：已经在用、但没改过这几项的人，保持原来的样子 */
const LEGACY_DEFAULTS: Partial<Settings> = {
  language: 'zh',
  holidayMode: 'cn',
  defaultCurrency: 'CNY',
};

/**
 * 网页版的网址里可以指定语言：`…/APP/?lang=ja` 打开时用日语、`?lang=zh` 用中文
 * （从作品集网站点过来时用）。只认识 zh / ja，其它情况返回 null。
 */
export function languageFromQuery(search: string | null | undefined): Language | null {
  const match = /[?&]lang=([^&#]*)/i.exec(search ?? '');
  const lang = match?.[1]?.toLowerCase();
  return lang === 'ja' || lang === 'zh' ? lang : null;
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
    // 第一次打开：语言、节假日、币种都存下来（以后就不会被当成老用户）
    await saveSettings(driver, {
      language: DEFAULT_SETTINGS.language,
      holidayMode: DEFAULT_SETTINGS.holidayMode,
      defaultCurrency: DEFAULT_SETTINGS.defaultCurrency,
      ...localeDefaults(systemLanguage),
    });
    Object.assign(raw, await driver.getAllSettings());
  } else {
    // 老用户：这几项没保存过（一直用的旧默认值），把旧默认值写进去，升级后不会突然变成日语
    const missing = Object.fromEntries(
      Object.entries(LEGACY_DEFAULTS).filter(([k]) => raw[k] === undefined)
    ) as Partial<Settings>;
    if (Object.keys(missing).length > 0) {
      await saveSettings(driver, missing);
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
  // 旧版本只有一个「每月同一个目标」（monthlyTarget）：换算成当前这个月的目标
  if (raw.monthlyTarget && Object.keys(result.monthlyTargets).length === 0) {
    try {
      const legacy = JSON.parse(raw.monthlyTarget);
      if (legacy) result.monthlyTargets = { [currentMonth()]: legacy };
    } catch {
      // 坏数据就忽略
    }
  }
  return result;
}

export async function saveSettings(driver: StorageDriver, patch: Partial<Settings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await driver.setSetting(key, JSON.stringify(value));
  }
}
