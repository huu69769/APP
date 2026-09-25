import {
  isTimed,
  type Currency,
  type Job,
  type MinorUnits,
  type Shift,
  type Task,
  type TimedShift,
} from '@/data/types';

import { addDays, type LocalDate, type YearMonth } from './date';
import {
  calendarMonthRange,
  eachDay,
  inRange,
  periodRange,
  type DateRange,
  type PeriodMode,
} from './period';
import { spanMinutes, shiftWage, workedMinutes } from './shift';
import { MINUTES_PER_DAY, minutesToTime, timeToMinutes } from './time';

/** 按币种分开的金额。不同币种不换算、不相加（PRD 5.7） */
export type MoneyByCurrency = Partial<Record<Currency, MinorUnits>>;

type StatShift = Pick<
  Shift,
  'jobId' | 'date' | 'startTime' | 'endTime' | 'breakMinutes' | 'wageSnapshot' | 'currencySnapshot'
>;
type StatJob = Pick<Job, 'id' | 'cutoffDay'>;
type StatTask = Pick<Task, 'jobId' | 'dueDate' | 'amount' | 'currency'>;

/** 现在的本地时间，用于区分「已完成」和「预计」 */
export interface LocalNow {
  date: LocalDate;
  /** "HH:mm" */
  time: string;
}

export function addMoney(target: MoneyByCurrency, currency: Currency, amount: MinorUnits): void {
  target[currency] = (target[currency] ?? 0) + amount;
}

export function sumMoney(...items: MoneyByCurrency[]): MoneyByCurrency {
  const result: MoneyByCurrency = {};
  for (const item of items) {
    for (const [c, v] of Object.entries(item) as [Currency, number][]) addMoney(result, c, v);
  }
  return result;
}

/** 班次结束的本地时间 "YYYY-MM-DD HH:mm"（跨夜班在第二天） */
export function shiftEnd(shift: TimedShift<Pick<Shift, 'date' | 'startTime' | 'endTime'>>): string {
  const end = timeToMinutes(shift.startTime) + spanMinutes(shift.startTime, shift.endTime);
  const date =
    end >= MINUTES_PER_DAY ? addDays(shift.date, Math.floor(end / MINUTES_PER_DAY)) : shift.date;
  return `${date} ${minutesToTime(end)}`;
}

/** 班次结束时间早于现在，算「已完成」；其余算「预计」 */
export function isCompleted(
  shift: TimedShift<Pick<Shift, 'date' | 'startTime' | 'endTime'>>,
  now: LocalNow
): boolean {
  return shiftEnd(shift) < `${now.date} ${now.time}`;
}

/** 统计空闲时间用到的日程字段 */
export interface StatEvent {
  date: LocalDate;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

/** 没有结束时间的日程按 1 小时算（和周视图一样） */
const EVENT_DEFAULT_MINUTES = 60;

/**
 * 每天被占用的分钟数：
 * - 班次：按开始到结束计算，包括休息；时间待定的班次不占用时间
 * - 日程：指定时间的按开始到结束；全天日程占用一整天
 * - 重叠的部分只算一次；跨夜的部分算进第二天
 */
export function occupiedMinutesByDay(
  shifts: StatShift[],
  events: StatEvent[] = []
): Map<LocalDate, number> {
  const intervals = new Map<LocalDate, [number, number][]>();
  const push = (date: LocalDate, start: number, end: number) => {
    const list = intervals.get(date) ?? [];
    list.push([start, end]);
    intervals.set(date, list);
  };
  const pushSpan = (date: LocalDate, start: number, end: number) => {
    while (end > 0) {
      push(date, start, Math.min(end, MINUTES_PER_DAY));
      end -= MINUTES_PER_DAY;
      start = 0;
      date = addDays(date, 1);
    }
  };
  for (const s of shifts.filter(isTimed)) {
    const start = timeToMinutes(s.startTime);
    pushSpan(s.date, start, start + spanMinutes(s.startTime, s.endTime));
  }
  for (const e of events) {
    if (e.allDay || !e.startTime) {
      push(e.date, 0, MINUTES_PER_DAY);
      continue;
    }
    const start = timeToMinutes(e.startTime);
    const length = e.endTime ? spanMinutes(e.startTime, e.endTime) : EVENT_DEFAULT_MINUTES;
    pushSpan(e.date, start, start + length);
  }
  const result = new Map<LocalDate, number>();
  for (const [date, list] of intervals) {
    list.sort((a, b) => a[0] - b[0]);
    let total = 0;
    let [curStart, curEnd] = list[0];
    for (const [s, e] of list.slice(1)) {
      if (s <= curEnd) curEnd = Math.max(curEnd, e);
      else {
        total += curEnd - curStart;
        [curStart, curEnd] = [s, e];
      }
    }
    total += curEnd - curStart;
    result.set(date, total);
  }
  return result;
}

/**
 * 空闲时间：
 * - 空闲天数：范围内既没有班次（时间待定的也算）、也没有日程的天数
 *   （项目 DDL、纪念日不占用时间，不影响）
 * - 空闲分钟：每天 24 小时 − 打工和日程占用（重叠只算一次），合计
 * shifts / events 需要包括范围开始前一天的（跨夜部分会占用第一天）
 */
export function freeTime(
  shifts: StatShift[],
  range: DateRange,
  events: StatEvent[] = []
): { freeDays: number; freeMinutes: number } {
  const busyDates = new Set([...shifts.map((s) => s.date), ...events.map((e) => e.date)]);
  const occupied = occupiedMinutesByDay(shifts, events);
  let freeDays = 0;
  let freeMinutes = 0;
  for (const day of eachDay(range)) {
    if (!busyDates.has(day)) freeDays++;
    freeMinutes += MINUTES_PER_DAY - (occupied.get(day) ?? 0);
  }
  return { freeDays, freeMinutes };
}

export interface JobStats {
  jobId: string;
  range: DateRange;
  minutes: number;
  wage: MoneyByCurrency;
  days: number;
  /** 时间待定、还没算进时长和工钱的班次数 */
  pending: number;
  /** 按项目结算：本周期 DDL 已过的项目数（已完成） */
  tasksDone: number;
  /** 按项目结算：本周期 DDL 还没到的项目数（预计） */
  tasksOpen: number;
}

export interface PeriodStats {
  /** 空闲时间使用的范围 */
  freeRange: DateRange;
  totalMinutes: number;
  /** 打工天数：有班次的日子（一天几个班都算 1 天，时间待定的也算） */
  workDays: number;
  wage: { total: MoneyByCurrency; completed: MoneyByCurrency; expected: MoneyByCurrency };
  freeDays: number;
  freeMinutes: number;
  /** 时间待定的班次数（不计入时长和工钱） */
  pending: number;
  jobs: JobStats[];
}

/**
 * 每份兼职在指定月份的统计范围。
 * 工资周期模式下每份兼职用自己的截止日。
 */
export function jobRange(mode: PeriodMode, month: YearMonth, job: StatJob | undefined): DateRange {
  return periodRange(mode, month, job ? job.cutoffDay : null);
}

/**
 * 空闲时间的范围：自然月模式用当月；
 * 工资周期模式下，如果所有兼职的截止日相同就用这个工资周期，否则用自然月。
 */
export function freeTimeRange(mode: PeriodMode, month: YearMonth, jobs: StatJob[]): DateRange {
  if (mode === 'payPeriod' && jobs.length > 0) {
    const cutoffs = new Set(jobs.map((j) => j.cutoffDay));
    if (cutoffs.size === 1) return periodRange(mode, month, jobs[0].cutoffDay);
  }
  return calendarMonthRange(month);
}

/**
 * 某个月（统计周期）的全部统计。
 * @param shifts 未删除的班次，范围要足够覆盖所有兼职的周期（前后各多一个月即可）
 * @param jobs 包括已删除的兼职（旧班次仍要统计）
 * @param activeJobs 未删除的兼职，用于决定空闲时间范围和显示哪些兼职
 */
export function periodStats(params: {
  shifts: StatShift[];
  /** 按项目结算的项目（未删除），不传则当作没有 */
  tasks?: StatTask[];
  /** 日程（占用空闲时间），不传则当作没有 */
  events?: StatEvent[];
  jobs: StatJob[];
  activeJobs: StatJob[];
  mode: PeriodMode;
  month: YearMonth;
  now: LocalNow;
}): PeriodStats {
  const { shifts, tasks = [], events = [], jobs, activeJobs, mode, month, now } = params;
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const perJob = new Map<string, JobStats & { dates: Set<LocalDate> }>();
  const total: MoneyByCurrency = {};
  const completed: MoneyByCurrency = {};
  const expected: MoneyByCurrency = {};
  let totalMinutes = 0;
  let pending = 0;
  const newEntry = (jobId: string, range: DateRange) => ({
    jobId,
    range,
    minutes: 0,
    wage: {},
    days: 0,
    pending: 0,
    tasksDone: 0,
    tasksOpen: 0,
    dates: new Set<LocalDate>(),
  });

  for (const job of activeJobs) perJob.set(job.id, newEntry(job.id, jobRange(mode, month, job)));

  for (const s of shifts) {
    const job = jobsById.get(s.jobId);
    const range = jobRange(mode, month, job);
    if (!inRange(s.date, range)) continue;
    let entry = perJob.get(s.jobId);
    if (!entry) {
      entry = newEntry(s.jobId, range);
      perJob.set(s.jobId, entry);
    }
    entry.dates.add(s.date);
    if (!isTimed(s)) {
      entry.pending++;
      pending++;
      continue;
    }
    const minutes = workedMinutes(s);
    const wage = shiftWage(s);
    entry.minutes += minutes;
    addMoney(entry.wage, s.currencySnapshot, wage);
    totalMinutes += minutes;
    addMoney(total, s.currencySnapshot, wage);
    addMoney(isCompleted(s, now) ? completed : expected, s.currencySnapshot, wage);
  }

  // 按项目结算的项目：收入算在 DDL；DDL 过了算已完成，没到算预计。
  // 只算钱，不算时长，也不影响空闲时间
  for (const task of tasks) {
    const job = jobsById.get(task.jobId);
    const range = jobRange(mode, month, job);
    if (!inRange(task.dueDate, range)) continue;
    let entry = perJob.get(task.jobId);
    if (!entry) {
      entry = newEntry(task.jobId, range);
      perJob.set(task.jobId, entry);
    }
    addMoney(entry.wage, task.currency, task.amount);
    addMoney(total, task.currency, task.amount);
    if (task.dueDate < now.date) {
      entry.tasksDone++;
      addMoney(completed, task.currency, task.amount);
    } else {
      entry.tasksOpen++;
      addMoney(expected, task.currency, task.amount);
    }
  }

  const freeRange = freeTimeRange(mode, month, activeJobs);
  const extended = { from: addDays(freeRange.from, -1), to: freeRange.to };
  const { freeDays, freeMinutes } = freeTime(
    shifts.filter((s) => inRange(s.date, extended)),
    freeRange,
    events.filter((e) => inRange(e.date, extended))
  );
  const workDates = new Set<LocalDate>();
  for (const entry of perJob.values()) for (const d of entry.dates) workDates.add(d);

  return {
    freeRange,
    totalMinutes,
    workDays: workDates.size,
    wage: { total, completed, expected },
    freeDays,
    freeMinutes,
    pending,
    jobs: [...perJob.values()].map(({ dates, ...rest }) => ({ ...rest, days: dates.size })),
  };
}

/**
 * 年度累计收入：1–12 月每个月的收入（按当前统计周期模式），以及全年合计。
 */
export function yearIncome(params: {
  shifts: StatShift[];
  tasks?: StatTask[];
  jobs: StatJob[];
  mode: PeriodMode;
  year: number;
  /** 传入时另外算出「已完成」（班次已结束、项目 DDL 已过）的部分 */
  now?: LocalNow;
}): {
  /** wage = 全部（已完成 + 预计），completed = 其中已完成的 */
  months: { month: YearMonth; wage: MoneyByCurrency; completed: MoneyByCurrency }[];
  total: MoneyByCurrency;
  completed: MoneyByCurrency;
} {
  const { shifts, tasks = [], jobs, mode, year, now } = params;
  const completed: MoneyByCurrency = {};
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    wage: {} as MoneyByCurrency,
    completed: {} as MoneyByCurrency,
  }));
  // 一笔收入（日期 + 金额）属于哪个月：检查它落在哪个月的周期内
  // （工资周期会跨月，所以当月和下个月都要检查）
  const place = (
    jobId: string,
    date: LocalDate,
    currency: Currency,
    amount: MinorUnits,
    done: boolean
  ) => {
    const job = jobsById.get(jobId);
    const [y, m] = date.split('-').map(Number);
    for (const offset of [0, 1]) {
      const d = new Date(y, m - 1 + offset, 1);
      if (d.getFullYear() !== year) continue;
      const month = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (inRange(date, jobRange(mode, month, job))) {
        addMoney(months[d.getMonth()].wage, currency, amount);
        if (done) {
          addMoney(completed, currency, amount);
          addMoney(months[d.getMonth()].completed, currency, amount);
        }
        return;
      }
    }
  };
  for (const s of shifts.filter(isTimed)) {
    place(s.jobId, s.date, s.currencySnapshot, shiftWage(s), !!now && isCompleted(s, now));
  }
  for (const t of tasks)
    place(t.jobId, t.dueDate, t.currency, t.amount, !!now && t.dueDate < now.date);
  return { months, total: sumMoney(...months.map((m) => m.wage)), completed };
}

/** 统计需要读取的班次范围：前后各多一个月，覆盖工资周期和跨夜班 */
export function statsLoadRange(month: YearMonth): DateRange {
  const range = calendarMonthRange(month);
  return { from: addDays(range.from, -32), to: addDays(range.to, 32) };
}
