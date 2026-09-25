import { workedMinutes, type ShiftTimes } from '@/lib/shift';
import type { LocalDate } from '@/lib/date';

import type { Repositories } from './repository';
import type { Job, NewEntity, Shift, ShiftTemplate } from './types';

export interface NewShiftInput extends ShiftTimes {
  date: LocalDate;
  note?: string;
}

/**
 * 根据兼职生成一条新班次。
 * 时薪和币种在这里拍快照：以后改兼职的时薪，不影响已有班次（PRD 3.2 / 5.3）。
 * 时长不合法（比如休息比班次还长）会抛出 ShiftValidationError。
 */
export function buildShift(job: Job, input: NewShiftInput): NewEntity<Shift> {
  workedMinutes(input); // 校验
  return {
    jobId: job.id,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    wageSnapshot: job.hourlyWage,
    currencySnapshot: job.currency,
    note: input.note ?? '',
    reminderMinutesBefore: null,
    premiumRules: null,
  };
}

/** 「时间待定」的班次：知道这天要上班，但还不知道几点 */
export function buildPendingShift(job: Job, date: LocalDate, note = ''): NewEntity<Shift> {
  return {
    jobId: job.id,
    date,
    startTime: null,
    endTime: null,
    breakMinutes: job.defaultBreakMinutes,
    wageSnapshot: job.hourlyWage,
    currencySnapshot: job.currency,
    note,
    reminderMinutesBefore: null,
    premiumRules: null,
  };
}

export function buildShiftFromTemplate(
  job: Job,
  template: ShiftTemplate,
  date: LocalDate
): NewEntity<Shift> {
  return buildShift(job, {
    date,
    startTime: template.startTime,
    endTime: template.endTime,
    breakMinutes: template.breakMinutes,
  });
}

/**
 * 是否已经有一模一样的班次：同一天、同一份工作、同样的开始和结束时间
 * （时间待定的班次：同一天同一份工作已经有待定的就算重复）。
 * 用来防止一键添加、批量排班时重复登记。
 */
export function isDuplicateShift(
  existing: Pick<Shift, 'jobId' | 'date' | 'startTime' | 'endTime'>[],
  candidate: Pick<Shift, 'jobId' | 'date' | 'startTime' | 'endTime'>
): boolean {
  return existing.some(
    (s) =>
      s.jobId === candidate.jobId &&
      s.date === candidate.date &&
      s.startTime === candidate.startTime &&
      s.endTime === candidate.endTime
  );
}

/** 添加班次；已经有一模一样的就不添加，返回 null */
export async function createShiftUnlessDuplicate(
  repos: Repositories,
  shift: NewEntity<Shift>
): Promise<Shift | null> {
  const sameDay = await repos.shifts.listByDateRange(shift.date, shift.date);
  if (isDuplicateShift(sameDay, shift)) return null;
  return repos.shifts.create(shift);
}

export interface ApplyResult {
  created: Shift[];
  /** 因为已经有同样的班次而跳过的日期 */
  skipped: LocalDate[];
}

async function applyToDates(
  repos: Repositories,
  dates: LocalDate[],
  build: (date: LocalDate) => NewEntity<Shift>
): Promise<ApplyResult> {
  const result: ApplyResult = { created: [], skipped: [] };
  for (const date of [...dates].sort()) {
    const shift = await createShiftUnlessDuplicate(repos, build(date));
    if (shift) result.created.push(shift);
    else result.skipped.push(date);
  }
  return result;
}

/** 批量排班：给多个日期套用同一个模板（已经有同样班次的日期跳过） */
export async function applyTemplateToDates(
  repos: Repositories,
  template: ShiftTemplate,
  dates: LocalDate[]
): Promise<ApplyResult> {
  const job = await repos.jobs.get(template.jobId);
  if (!job) throw new Error('Job not found');
  return applyToDates(repos, dates, (date) => buildShiftFromTemplate(job, template, date));
}

/** 批量标记「时间待定」：给多个日期加上某份工作的待定班次（已经有的跳过） */
export async function applyPendingToDates(
  repos: Repositories,
  job: Job,
  dates: LocalDate[]
): Promise<ApplyResult> {
  return applyToDates(repos, dates, (date) => buildPendingShift(job, date));
}

/** 按日期、开始时间排序；同一天里「时间待定」排在最前 */
export function sortShifts<T extends { date: string; startTime: string | null }>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? '').localeCompare(b.startTime ?? '')
      : a.date.localeCompare(b.date)
  );
}
