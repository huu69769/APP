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

/** 批量排班：给多个日期套用同一个模板 */
export async function applyTemplateToDates(
  repos: Repositories,
  template: ShiftTemplate,
  dates: LocalDate[]
): Promise<Shift[]> {
  const job = await repos.jobs.get(template.jobId);
  if (!job) throw new Error('Job not found');
  const created: Shift[] = [];
  for (const date of [...dates].sort()) {
    created.push(await repos.shifts.create(buildShiftFromTemplate(job, template, date)));
  }
  return created;
}

/** 批量标记「时间待定」：给多个日期加上某份兼职的待定班次 */
export async function applyPendingToDates(
  repos: Repositories,
  job: Job,
  dates: LocalDate[]
): Promise<Shift[]> {
  const created: Shift[] = [];
  for (const date of [...dates].sort()) {
    created.push(await repos.shifts.create(buildPendingShift(job, date)));
  }
  return created;
}

/** 按日期、开始时间排序；同一天里「时间待定」排在最前 */
export function sortShifts<T extends { date: string; startTime: string | null }>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? '').localeCompare(b.startTime ?? '')
      : a.date.localeCompare(b.date)
  );
}
