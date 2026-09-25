import type { Currency, MinorUnits, Shift } from '@/data/types';

import type { WeekStart } from './calendar';
import { addDays, parseLocalDate, type LocalDate } from './date';
import { shiftWage, workedMinutes } from './shift';
import { MINUTES_PER_DAY, timeToMinutes } from './time';

/** 某天所在那一周的第一天 */
export function startOfWeek(date: LocalDate, weekStart: WeekStart): LocalDate {
  const offset = (parseLocalDate(date).day() - weekStart + 7) % 7;
  return addDays(date, -offset);
}

/** 从 start 开始的 7 天 */
export function weekDates(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 周视图里要画成时间块的东西（有具体时间的班次、日程） */
export interface TimedBlock {
  key: string;
  date: LocalDate;
  startTime: string;
  /** 没有结束时间的日程按 1 小时画 */
  endTime: string | null;
}

/** 画在某一天那一列里的一段（过夜的班次会分成两段） */
export interface BlockSegment {
  key: string;
  /** 第几列（0–6） */
  day: number;
  /** 从 0 点开始的分钟数 */
  start: number;
  end: number;
  /** 和别的块重叠时并排：第几条、一共几条 */
  lane: number;
  lanes: number;
  /** 前一天开始的（过夜班次的后半段） */
  continued: boolean;
}

const DEFAULT_LENGTH = 60;

/**
 * 算出每个时间块在周视图里的位置。
 * 过夜的（结束时间 ≤ 开始时间）在午夜切开，后半段放到第二天。
 * 同一天里时间重叠的块并排显示。
 */
export function layoutWeek(blocks: TimedBlock[], dates: LocalDate[]): BlockSegment[] {
  const index = new Map(dates.map((d, i) => [d, i]));
  const byDay: Omit<BlockSegment, 'lane' | 'lanes'>[][] = dates.map(() => []);
  for (const b of blocks) {
    const start = timeToMinutes(b.startTime);
    let end = b.endTime
      ? timeToMinutes(b.endTime)
      : Math.min(start + DEFAULT_LENGTH, MINUTES_PER_DAY);
    if (end <= start) end += MINUTES_PER_DAY;
    const day = index.get(b.date);
    if (day !== undefined) {
      byDay[day].push({
        key: b.key,
        day,
        start,
        end: Math.min(end, MINUTES_PER_DAY),
        continued: false,
      });
    }
    if (end > MINUTES_PER_DAY) {
      const next = index.get(addDays(b.date, 1));
      if (next !== undefined) {
        byDay[next].push({
          key: b.key,
          day: next,
          start: 0,
          end: end - MINUTES_PER_DAY,
          continued: true,
        });
      }
    }
  }

  const result: BlockSegment[] = [];
  for (const segments of byDay) {
    segments.sort((a, b) => a.start - b.start || b.end - a.end);
    // 按时间顺序分成「互相重叠的一组」，组内每块放在第一条空着的并排位置
    let group: Omit<BlockSegment, 'lanes'>[] = [];
    let groupEnd = -1;
    const flush = () => {
      const lanes = Math.max(0, ...group.map((g) => g.lane)) + 1;
      for (const g of group) result.push({ ...g, lanes });
      group = [];
    };
    for (const s of segments) {
      if (group.length && s.start >= groupEnd) flush();
      const laneEnds: number[] = [];
      for (const g of group) laneEnds[g.lane] = Math.max(laneEnds[g.lane] ?? 0, g.end);
      let lane = laneEnds.findIndex((e) => e <= s.start);
      if (lane === -1) lane = laneEnds.length;
      group.push({ ...s, lane });
      groupEnd = Math.max(groupEnd, s.end);
    }
    if (group.length) flush();
  }
  return result;
}

/** 一周的打工合计：时长、工钱（按币种）、时间待定的班次数 */
export function weekTotals(
  shifts: Pick<
    Shift,
    'date' | 'startTime' | 'endTime' | 'breakMinutes' | 'wageSnapshot' | 'currencySnapshot'
  >[],
  dates: LocalDate[]
): { minutes: number; wage: Partial<Record<Currency, MinorUnits>>; pending: number } {
  const days = new Set(dates);
  let minutes = 0;
  let pending = 0;
  const wage: Partial<Record<Currency, MinorUnits>> = {};
  for (const s of shifts) {
    if (!days.has(s.date)) continue;
    if (s.startTime === null || s.endTime === null) {
      pending++;
      continue;
    }
    const times = { startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes };
    minutes += workedMinutes(times);
    wage[s.currencySnapshot] =
      (wage[s.currencySnapshot] ?? 0) + shiftWage({ ...times, wageSnapshot: s.wageSnapshot });
  }
  return { minutes, wage, pending };
}

/** from 到 to（含两端）之间，星期几在 weekdays 里的日期（0 = 周日 … 6 = 周六） */
export function datesByWeekdays(from: LocalDate, to: LocalDate, weekdays: number[]): LocalDate[] {
  const wanted = new Set(weekdays);
  const result: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (wanted.has(parseLocalDate(d).day())) result.push(d);
  }
  return result;
}

/** 「按星期排班」默认的结束日：下个月的最后一天 */
export function endOfNextMonth(date: LocalDate): LocalDate {
  return parseLocalDate(date).add(1, 'month').endOf('month').format('YYYY-MM-DD');
}
