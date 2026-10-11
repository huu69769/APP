import type { TFunction } from 'i18next';

import { currentMonth, parseYearMonth } from '@/lib/date';
import { JOB_COLORS } from '@/theme/colors';

import type { Repositories } from './repository';
import { saveSettings, type Language } from './settings';
import { SCHEMA_VERSION, type StorageDriver } from './storage/types';
import { TABLE_NAMES, type TableName } from './types';

/**
 * 演示模式（只在网页版）：网址带 `?demo=1` 时，用一份单独的示例数据打开，
 * 让第一次看的人马上就能看到填好的月历和统计（作品集网站里嵌入时用）。
 *
 * - 数据存在浏览器里另外的位置（DEMO_PREFIX），不会碰到平时自己用的数据
 * - 每个月第一次打开时，重新生成这个月的示例数据
 */
export const DEMO_PREFIX = 'worklog-demo:';
const DEMO_MONTH_KEY = 'demoMonth';

export function demoFromQuery(search: string | null | undefined): boolean {
  const match = /[?&]demo=([^&#]*)/i.exec(search ?? '');
  const value = match?.[1]?.toLowerCase();
  return value === '1' || value === 'true';
}

/** 这个月还没有示例数据（第一次打开、或者月份变了）时，清空并重新放入示例数据 */
export async function prepareDemo(
  driver: StorageDriver,
  repos: Repositories,
  options: { language: Language; t: TFunction; now?: Date }
): Promise<void> {
  const now = options.now ?? new Date();
  const month = JSON.stringify(currentMonth(now));
  const settings = await driver.getAllSettings();
  if (settings[DEMO_MONTH_KEY] === month) return;

  const tables = Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as Record<
    TableName,
    []
  >;
  await driver.importAll({ schemaVersion: SCHEMA_VERSION, tables, settings: {} });
  await seedDemoData(repos, options.t, now);
  await saveSettings(driver, {
    language: options.language,
    holidayMode: 'jp',
    defaultCurrency: 'JPY',
    // 农历是给中文用户看的，日语演示时不显示
    showLunar: options.language === 'zh',
  });
  await driver.setSetting(DEMO_MONTH_KEY, month);
}

/**
 * 示例数据：时薪的打工 2 份（班次按星期排满这个月）、按项目结算的翻译 1 份、日程 2 个。
 * 名字用 t() 取，跟着界面语言走。
 */
export async function seedDemoData(
  repos: Repositories,
  t: TFunction,
  now: Date = new Date()
): Promise<void> {
  const start = parseYearMonth(currentMonth(now));
  const days = start.daysInMonth();
  const dateOf = (day: number) => start.date(Math.min(day, days)).format('YYYY-MM-DD');

  const cafe = await repos.jobs.create({
    name: t('demo.cafe'),
    payType: 'hourly',
    color: JOB_COLORS[3],
    hourlyWage: 1200,
    currency: 'JPY',
    cutoffDay: null,
    defaultBreakMinutes: 0,
    endedAt: null,
  });
  const juku = await repos.jobs.create({
    name: t('demo.juku'),
    payType: 'hourly',
    color: JOB_COLORS[5],
    hourlyWage: 1800,
    currency: 'JPY',
    cutoffDay: null,
    defaultBreakMinutes: 0,
    endedAt: null,
  });
  const translation = await repos.jobs.create({
    name: t('demo.translation'),
    payType: 'piece',
    color: JOB_COLORS[7],
    hourlyWage: 0,
    currency: 'JPY',
    cutoffDay: null,
    defaultBreakMinutes: 0,
    endedAt: null,
  });

  await repos.shift_templates.create({
    jobId: cafe.id,
    name: t('demo.morning'),
    startTime: '09:00',
    endTime: '14:00',
    breakMinutes: 0,
  });
  await repos.shift_templates.create({
    jobId: cafe.id,
    name: t('demo.evening'),
    startTime: '17:00',
    endTime: '22:00',
    breakMinutes: 30,
  });

  // 曜日ごとの決まったシフト（0 = 日曜は休み）
  const weekly: Record<number, { job: typeof cafe; start: string; end: string; rest: number }> = {
    1: { job: cafe, start: '09:00', end: '14:00', rest: 0 },
    2: { job: juku, start: '18:00', end: '21:00', rest: 0 },
    3: { job: cafe, start: '09:00', end: '14:00', rest: 0 },
    4: { job: juku, start: '18:00', end: '21:00', rest: 0 },
    5: { job: cafe, start: '17:00', end: '22:00', rest: 30 },
    6: { job: cafe, start: '10:00', end: '16:00', rest: 60 },
  };
  for (let day = 1; day <= days; day++) {
    const plan = weekly[start.date(day).day()];
    if (!plan) continue;
    await repos.shifts.create({
      jobId: plan.job.id,
      date: dateOf(day),
      startTime: plan.start,
      endTime: plan.end,
      breakMinutes: plan.rest,
      wageSnapshot: plan.job.hourlyWage,
      currencySnapshot: plan.job.currency,
      note: '',
      reminderMinutesBefore: null,
    });
  }

  for (const [day, title, amount] of [
    [12, t('demo.task1'), 8000],
    [25, t('demo.task2'), 15000],
  ] as const) {
    await repos.tasks.create({
      jobId: translation.id,
      title,
      dueDate: dateOf(day),
      amount,
      currency: 'JPY',
      note: '',
      reminderMinutesBefore: null,
    });
  }

  await repos.events.create({
    date: dateOf(8),
    title: t('demo.event1'),
    allDay: true,
    startTime: null,
    endTime: null,
    color: JOB_COLORS[0],
    note: '',
    reminderMinutesBefore: null,
  });
  await repos.events.create({
    date: dateOf(19),
    title: t('demo.event2'),
    allDay: false,
    startTime: '12:00',
    endTime: '13:30',
    color: JOB_COLORS[8],
    note: '',
    reminderMinutesBefore: null,
  });
}
