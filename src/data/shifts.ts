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

/** 按开始时间排序 */
export function sortShifts<T extends { date: string; startTime: string }>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
  );
}
