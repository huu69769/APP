import { localNow, type YearMonth } from '@/lib/date';
import { periodStats, statsLoadRange, yearIncome } from '@/lib/stats';

import { useData } from './DataProvider';
import { useQuery } from './useQuery';

/** 读取某个月（统计周期）的统计数据；数据变化时自动刷新 */
export function useMonthStats(month: YearMonth) {
  const { settings } = useData();
  const mode = settings.statsPeriod;
  return useQuery(
    async (r) => {
      const range = statsLoadRange(month);
      const [shifts, jobs, tasks] = await Promise.all([
        r.shifts.listByDateRange(range.from, range.to),
        r.jobs.listWithDeleted(),
        r.tasks.list(),
      ]);
      const activeJobs = jobs.filter((j) => !j.deletedAt);
      const stats = periodStats({ shifts, tasks, jobs, activeJobs, mode, month, now: localNow() });
      return { stats, jobsById: new Map(jobs.map((j) => [j.id, j])) };
    },
    [month, mode]
  );
}

/** 年度累计收入 */
export function useYearIncome(year: number) {
  const { settings } = useData();
  const mode = settings.statsPeriod;
  return useQuery(
    async (r) => {
      // 工资周期会跨年，所以多读前后一个月
      const [shifts, jobs, tasks] = await Promise.all([
        r.shifts.listByDateRange(`${year - 1}-12-01`, `${year}-12-31`),
        r.jobs.listWithDeleted(),
        r.tasks.list(),
      ]);
      return yearIncome({ shifts, tasks, jobs, mode, year });
    },
    [year, mode]
  );
}
