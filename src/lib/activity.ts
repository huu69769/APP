import { addDays, dayjs, DATE_FORMAT, type LocalDate } from './date';

/** 超过多少天没有任何班次或项目，就提示「要结束吗？」 */
export const STALE_DAYS = 60;

/**
 * 工作是否「很久没用了」：
 * - 最后一条班次 / 项目的日期（包括将来的）早于 today − STALE_DAYS
 * - 从来没有记录的话，看创建日期
 * 只用来提示，不会自动结束。
 */
export function isStale(params: {
  /** 工作的创建时间（ISO） */
  createdAt: string;
  /** 这份工作最后一条班次 / 项目的日期；没有记录为 null */
  lastActivity: LocalDate | null;
  today: LocalDate;
  days?: number;
}): boolean {
  const limit = addDays(params.today, -(params.days ?? STALE_DAYS));
  const last = params.lastActivity ?? dayjs(params.createdAt).format(DATE_FORMAT);
  return last < limit;
}

/** 每份工作最后一条记录的日期 */
export function lastActivityByJob(
  records: { jobId: string; date: LocalDate }[]
): Map<string, LocalDate> {
  const result = new Map<string, LocalDate>();
  for (const r of records) {
    const prev = result.get(r.jobId);
    if (!prev || r.date > prev) result.set(r.jobId, r.date);
  }
  return result;
}
