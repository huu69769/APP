import { addDays, DATE_FORMAT, parseYearMonth, type LocalDate, type YearMonth } from './date';

/** 日期范围（含两端） */
export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

/**
 * 统计周期：
 * - calendarMonth：自然月，1 号到月底
 * - payPeriod：工资周期，按每份兼职自己的截止日计算
 */
export type PeriodMode = 'calendarMonth' | 'payPeriod';

export function calendarMonthRange(month: YearMonth): DateRange {
  const d = parseYearMonth(month);
  return { from: d.startOf('month').format(DATE_FORMAT), to: d.endOf('month').format(DATE_FORMAT) };
}

/**
 * 某月实际的截止日。cutoffDay 为 null 表示月末；
 * 截止日超过当月天数（比如 2 月 31 日）时按月末处理（PRD 5.8）。
 */
export function effectiveCutoff(month: YearMonth, cutoffDay: number | null): LocalDate {
  const d = parseYearMonth(month);
  const days = d.daysInMonth();
  const day = cutoffDay === null ? days : Math.min(cutoffDay, days);
  return d.date(day).format(DATE_FORMAT);
}

/**
 * 工资周期：「上个截止日的第二天」到「本期截止日」，以截止日所在的月份命名（PRD 3.6）。
 * 例：截止日 25 日，"2026-09" 期 = 2026-08-26 ~ 2026-09-25
 */
export function payPeriodRange(month: YearMonth, cutoffDay: number | null): DateRange {
  const prevMonth = parseYearMonth(month).subtract(1, 'month').format('YYYY-MM');
  return {
    from: addDays(effectiveCutoff(prevMonth, cutoffDay), 1),
    to: effectiveCutoff(month, cutoffDay),
  };
}

export function periodRange(
  mode: PeriodMode,
  month: YearMonth,
  cutoffDay: number | null
): DateRange {
  return mode === 'calendarMonth' ? calendarMonthRange(month) : payPeriodRange(month, cutoffDay);
}

/** 范围内的每一天 */
export function eachDay(range: DateRange): LocalDate[] {
  const days: LocalDate[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function inRange(date: LocalDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}
