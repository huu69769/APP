import type { MinorUnits, TimeOfDay } from '@/data/types';

import { MINUTES_PER_DAY, timeToMinutes } from './time';

export interface ShiftTimes {
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  breakMinutes: number;
}

export type ShiftError = 'invalidTime' | 'invalidBreak' | 'breakTooLong';

export class ShiftValidationError extends Error {
  constructor(readonly code: ShiftError) {
    super(code);
    this.name = 'ShiftValidationError';
  }
}

/** 结束时间 ≤ 开始时间，就是跨夜班（第二天结束）。PRD 5.1 */
export function isOvernight(startTime: TimeOfDay, endTime: TimeOfDay): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/**
 * 从开始到结束的总分钟数（包括休息）。跨夜班会正确跨过 0 点。
 * 开始 = 结束 视为 24 小时。
 */
export function spanMinutes(startTime: TimeOfDay, endTime: TimeOfDay): number {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += MINUTES_PER_DAY;
  return end - start;
}

/**
 * 实际工作分钟数 = 结束 − 开始 − 休息。PRD 5.2
 * 结果 ≤ 0 时抛出错误（不能保存）。
 */
export function workedMinutes(shift: ShiftTimes): number {
  if (!Number.isInteger(shift.breakMinutes) || shift.breakMinutes < 0) {
    throw new ShiftValidationError('invalidBreak');
  }
  let span: number;
  try {
    span = spanMinutes(shift.startTime, shift.endTime);
  } catch {
    throw new ShiftValidationError('invalidTime');
  }
  const worked = span - shift.breakMinutes;
  if (worked <= 0) throw new ShiftValidationError('breakTooLong');
  return worked;
}

/** 不抛错的检查，返回错误代码或 null */
export function validateShift(shift: ShiftTimes): ShiftError | null {
  try {
    workedMinutes(shift);
    return null;
  } catch (e) {
    if (e instanceof ShiftValidationError) return e.code;
    throw e;
  }
}

/**
 * 工钱 = 实际工作时长 × 时薪快照。PRD 5.3
 * 金额是最小单位整数；按分钟计算后四舍五入到最小单位。
 */
export function shiftWage(shift: ShiftTimes & { wageSnapshot: MinorUnits }): MinorUnits {
  return Math.round((workedMinutes(shift) * shift.wageSnapshot) / 60);
}
