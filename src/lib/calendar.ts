import {
  addDays,
  DATE_FORMAT,
  type LocalDate,
  parseYearMonth,
  today,
  type YearMonth,
} from './date';

/** 0 = 周日开始，1 = 周一开始 */
export type WeekStart = 0 | 1;

export interface CalendarDay {
  date: LocalDate;
  /** 几号（1–31） */
  day: number;
  /** 星期几：0 = 周日 … 6 = 周六 */
  weekday: number;
  /** 是否属于正在显示的月份（否则是上/下月补位的灰色日期） */
  inMonth: boolean;
  isToday: boolean;
}

/**
 * 生成月历网格：固定 6 行 × 7 列，这样切换月份时高度不会跳动。
 */
export function buildMonthGrid(
  month: YearMonth,
  weekStart: WeekStart,
  todayDate: LocalDate = today()
): CalendarDay[][] {
  const first = parseYearMonth(month).startOf('month');
  const offset = (first.day() - weekStart + 7) % 7;
  const start = first.subtract(offset, 'day').format(DATE_FORMAT);
  const monthPrefix = first.format('YYYY-MM');

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i);
      week.push({
        date,
        day: Number(date.slice(8, 10)),
        weekday: (weekStart + i) % 7,
        inMonth: date.startsWith(monthPrefix),
        isToday: date === todayDate,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** 按每周起始日排好的星期序号，比如周一开始 → [1,2,3,4,5,6,0] */
export function orderedWeekdays(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

/** 月历网格覆盖的日期范围（含上下月补位的日期），用于一次读出要显示的班次 */
export function monthGridRange(
  month: YearMonth,
  weekStart: WeekStart
): { from: LocalDate; to: LocalDate } {
  const weeks = buildMonthGrid(month, weekStart);
  return { from: weeks[0][0].date, to: weeks[5][6].date };
}
