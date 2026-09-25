import type { Repositories } from '@/data/repository';
import type { HolidayCache } from '@/data/types';
import { needsRefresh, type CountryCode, type HolidayDay } from '@/lib/holidays';
import { nowIso } from '@/lib/date';

import { HOLIDAY_PROVIDERS } from './providers';

/**
 * 节假日数据：优先用手机里保存的（从网上下载过的），没有就用 app 里预先打包的。
 * 下载在后台进行，失败也不影响显示。
 */
async function findCache(
  repos: Repositories,
  country: CountryCode,
  year: number
): Promise<HolidayCache | undefined> {
  return (await repos.holidays_cache.list()).find((c) => c.country === country && c.year === year);
}

export async function loadHolidayYear(
  repos: Repositories,
  country: CountryCode,
  year: number
): Promise<HolidayDay[]> {
  const cached = await findCache(repos, country, year);
  if (cached) {
    try {
      const days = JSON.parse(cached.data) as HolidayDay[];
      if (days.length) return days;
    } catch {
      // 坏数据：用打包的
    }
  }
  return HOLIDAY_PROVIDERS[country].bundled(year) ?? [];
}

/** 本次打开 app 已经尝试过下载的（避免重复请求） */
const attempted = new Set<string>();

/** 需要的话从网上更新某国某年的数据，保存到手机里 */
export async function refreshHolidayYear(
  repos: Repositories,
  country: CountryCode,
  year: number,
  now: Date = new Date()
): Promise<void> {
  const key = `${country}:${year}`;
  if (attempted.has(key)) return;
  attempted.add(key);

  const cached = await findCache(repos, country, year);
  if (
    !needsRefresh({
      year,
      currentYear: now.getFullYear(),
      fetchedAt: cached?.fetchedAt ?? null,
      now,
    })
  ) {
    return;
  }
  let days: HolidayDay[] | null;
  try {
    days = await HOLIDAY_PROVIDERS[country].fetchYear(year);
  } catch {
    attempted.delete(key); // 网络问题：下次再试
    return;
  }
  // 还没公布（比如明年的中国安排）也记下检查时间，避免每次都请求；
  // 已经保存过的数据不会被空结果覆盖
  const data = days ? JSON.stringify(days) : (cached?.data ?? '[]');
  if (cached) await repos.holidays_cache.update(cached.id, { data, fetchedAt: nowIso(now) });
  else await repos.holidays_cache.create({ country, year, data, fetchedAt: nowIso(now) });
}
