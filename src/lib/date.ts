import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

/** 本地日期字符串，例如 "2026-09-24"。日期一律用这种格式保存和比较（PRD 5.6）。 */
export type LocalDate = string;
/** 年月字符串，例如 "2026-09"。 */
export type YearMonth = string;

export const DATE_FORMAT = 'YYYY-MM-DD';
export const MONTH_FORMAT = 'YYYY-MM';

/** 今天的本地日期（按手机时区，不经过 UTC 换算）。 */
export function today(now: Date = new Date()): LocalDate {
  return dayjs(now).format(DATE_FORMAT);
}

export function currentMonth(now: Date = new Date()): YearMonth {
  return dayjs(now).format(MONTH_FORMAT);
}

/** 严格解析 "YYYY-MM-DD"，得到本地时间当天 0 点。 */
export function parseLocalDate(date: LocalDate): dayjs.Dayjs {
  const d = dayjs(date, DATE_FORMAT, true);
  if (!d.isValid()) throw new Error(`Invalid local date: ${date}`);
  return d;
}

export function isValidLocalDate(date: string): boolean {
  return dayjs(date, DATE_FORMAT, true).isValid();
}

export function parseYearMonth(month: YearMonth): dayjs.Dayjs {
  const d = dayjs(month, MONTH_FORMAT, true);
  if (!d.isValid()) throw new Error(`Invalid year-month: ${month}`);
  return d;
}

export function addMonths(month: YearMonth, delta: number): YearMonth {
  return parseYearMonth(month).add(delta, 'month').format(MONTH_FORMAT);
}

export function addDays(date: LocalDate, delta: number): LocalDate {
  return parseLocalDate(date).add(delta, 'day').format(DATE_FORMAT);
}

/** 当前时间的 ISO 字符串，用于 createdAt / updatedAt / deletedAt。 */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** 现在的本地日期和时间 { date: "YYYY-MM-DD", time: "HH:mm" } */
export function localNow(now: Date = new Date()): { date: LocalDate; time: string } {
  const d = dayjs(now);
  return { date: d.format(DATE_FORMAT), time: d.format('HH:mm') };
}

/** 日期输入框的自动格式化：只留数字，自动插入「-」。"20260930" → "2026-09-30" */
export function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}
