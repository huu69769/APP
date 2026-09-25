import { Lunar, LunarMonth, Solar } from 'lunar-javascript';

import { parseLocalDate, type LocalDate } from './date';

/** 算纪念日需要的字段 */
export interface AnniversaryDate {
  /** 最初那一天（公历） */
  date: LocalDate;
  /** 每年重复 */
  repeat: boolean;
  /** 按农历重复（比如农历生日） */
  lunar: boolean;
}

export type AnniversaryStatus =
  /** 今天就是（重复的：今年这一次） */
  | { kind: 'today'; years: number }
  /** 还有 days 天；years = 那一次是第几周年（0 = 第一次，还没到过） */
  | { kind: 'until'; days: number; years: number; date: LocalDate }
  /** 不重复、已经过去 days 天 */
  | { kind: 'since'; days: number };

function diffDays(from: LocalDate, to: LocalDate): number {
  return parseLocalDate(to).diff(parseLocalDate(from), 'day');
}

/**
 * 某一年的那一次（公历日期）。
 * - 公历：同月同日；2 月 29 日在平年算 2 月 28 日
 * - 农历：同一个农历月日（闰月按普通月算）；那个月没有三十就算二十九
 * `year` 对农历来说是农历年，结果可能落在下一个公历年（比如腊月）。
 */
export function occurrenceInYear(a: AnniversaryDate, year: number): LocalDate {
  const d = parseLocalDate(a.date);
  if (!a.lunar) {
    const month = d.month();
    const target = parseLocalDate(`${year}-01-01`).month(month);
    const day = Math.min(d.date(), target.daysInMonth());
    return target.date(day).format('YYYY-MM-DD');
  }
  const origin = Solar.fromYmd(d.year(), d.month() + 1, d.date()).getLunar();
  const month = Math.abs(origin.getMonth());
  const day = Math.min(origin.getDay(), LunarMonth.fromYm(year, month).getDayCount());
  return Lunar.fromYmd(year, month, day).getSolar().toYmd();
}

/** 起始日的年份（农历按农历年） */
function originYear(a: AnniversaryDate): number {
  const d = parseLocalDate(a.date);
  return a.lunar
    ? Solar.fromYmd(d.year(), d.month() + 1, d.date())
        .getLunar()
        .getYear()
    : d.year();
}

/** 在 [from, to] 范围内出现的日期（含最初那一天），以及那是第几周年 */
export function occurrencesInRange(
  a: AnniversaryDate,
  from: LocalDate,
  to: LocalDate
): { date: LocalDate; years: number }[] {
  if (!a.repeat) {
    return a.date >= from && a.date <= to ? [{ date: a.date, years: 0 }] : [];
  }
  const start = originYear(a);
  const result: { date: LocalDate; years: number }[] = [];
  // 农历年可能跨到下一个公历年，所以往前多看一年
  for (
    let y = Math.max(start, parseLocalDate(from).year() - 1);
    y <= parseLocalDate(to).year();
    y++
  ) {
    const date = y === start ? a.date : occurrenceInYear(a, y);
    if (date >= from && date <= to) result.push({ date, years: y - start });
  }
  return result;
}

/** 下一次（今天也算）；不重复且已经过去的返回 null */
export function nextOccurrence(
  a: AnniversaryDate,
  today: LocalDate
): { date: LocalDate; years: number } | null {
  if (!a.repeat) return a.date >= today ? { date: a.date, years: 0 } : null;
  const year = parseLocalDate(today).year();
  return occurrencesInRange(a, today, `${year + 1}-12-31`)[0] ?? null;
}

/** 列表里显示的状态：今天 / 还有 N 天 / 已经 N 天 */
export function anniversaryStatus(a: AnniversaryDate, today: LocalDate): AnniversaryStatus {
  const next = nextOccurrence(a, today);
  if (!next) return { kind: 'since', days: diffDays(a.date, today) };
  const days = diffDays(today, next.date);
  if (days === 0) return { kind: 'today', years: next.years };
  return { kind: 'until', days, years: next.years, date: next.date };
}

/** 从最初那天到今天已经过了多少天（还没到返回 null） */
export function daysSince(a: AnniversaryDate, today: LocalDate): number | null {
  return a.date < today ? diffDays(a.date, today) : null;
}

/** 农历年月日 → 公历日期；这个农历日期不存在（比如那个月没有三十）返回 null */
export function lunarToSolar(year: number, month: number, day: number): LocalDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1901 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 30) return null;
  if (day > LunarMonth.fromYm(year, month).getDayCount()) return null;
  return Lunar.fromYmd(year, month, day).getSolar().toYmd();
}

/** 公历日期 → 农历年月日（闰月按普通月） */
export function solarToLunar(date: LocalDate): { year: number; month: number; day: number } {
  const d = parseLocalDate(date);
  const l = Solar.fromYmd(d.year(), d.month() + 1, d.date()).getLunar();
  return { year: l.getYear(), month: Math.abs(l.getMonth()), day: l.getDay() };
}
