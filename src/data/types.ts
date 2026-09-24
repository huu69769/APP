import type { LocalDate } from '@/lib/date';

/**
 * 所有数据表共用的字段（为以后云同步做准备，PRD 第 4 节）。
 * - id 用 UUID，不用自增编号
 * - 删除时只写 deletedAt（软删除）
 */
export interface BaseEntity {
  id: string;
  /** ISO 时间 */
  createdAt: string;
  /** ISO 时间 */
  updatedAt: string;
  /** ISO 时间；null 表示未删除 */
  deletedAt: string | null;
}

export type Currency = 'CNY' | 'JPY' | 'USD';
export const CURRENCIES: Currency[] = ['CNY', 'JPY', 'USD'];

/** "HH:mm" */
export type TimeOfDay = string;

/**
 * 金额一律用「最小单位的整数」：JPY 1 = 1 日元；CNY/USD 1 = 0.01。
 * 不用浮点数算钱。
 */
export type MinorUnits = number;

export interface Job extends BaseEntity {
  name: string;
  color: string;
  hourlyWage: MinorUnits;
  currency: Currency;
  /** 截止日 1–31；null = 月末 */
  cutoffDay: number | null;
  defaultBreakMinutes: number;
}

export interface ShiftTemplate extends BaseEntity {
  jobId: string;
  name: string;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  breakMinutes: number;
}

/** 预留：以后做夜班、周末加价（第一版不用） */
export type PremiumRules = unknown;

export interface Shift extends BaseEntity {
  jobId: string;
  /** 班次开始那天的本地日期（跨夜班也算在开始那天） */
  date: LocalDate;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  breakMinutes: number;
  /** 创建班次时兼职的时薪快照 */
  wageSnapshot: MinorUnits;
  currencySnapshot: Currency;
  note: string;
  reminderMinutesBefore: number | null;
  premiumRules?: PremiumRules | null;
}

export interface CalendarEvent extends BaseEntity {
  date: LocalDate;
  title: string;
  allDay: boolean;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  color: string;
  note: string;
  reminderMinutesBefore: number | null;
}

export interface DayNote extends BaseEntity {
  date: LocalDate;
  content: string;
}

export interface HolidayCache extends BaseEntity {
  country: string;
  year: number;
  /** 原始 JSON 数据 */
  data: string;
  fetchedAt: string;
}

/** 表名 → 实体类型 */
export interface EntityTables {
  jobs: Job;
  shift_templates: ShiftTemplate;
  shifts: Shift;
  events: CalendarEvent;
  day_notes: DayNote;
  holidays_cache: HolidayCache;
}

export type TableName = keyof EntityTables;

export const TABLE_NAMES: TableName[] = [
  'jobs',
  'shift_templates',
  'shifts',
  'events',
  'day_notes',
  'holidays_cache',
];

/** 有 date 字段、需要按日期范围查询的表 */
export const DATED_TABLES: TableName[] = ['shifts', 'events', 'day_notes'];

/** 除公共字段外，新建记录时需要提供的内容 */
export type NewEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity>;
