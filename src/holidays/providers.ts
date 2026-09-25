import { parseCnJson, parseJpYaml, type CountryCode, type HolidayDay } from '@/lib/holidays';

import cnBundled from './bundled/cn.json';
import jpBundled from './bundled/jp.json';

/**
 * 每个国家一个 provider：知道去哪里下载、怎么解析，以及 app 里预先打包的数据。
 * 以后加其他国家：在这里加一个 provider，并在 CountryCode 里加上国家代码。
 */
export interface HolidayProvider {
  country: CountryCode;
  /** 从网上获取某年的数据；还没公布返回 null；网络出错抛出异常 */
  fetchYear(year: number): Promise<HolidayDay[] | null>;
  /** app 里预先打包的数据（保底） */
  bundled(year: number): HolidayDay[] | null;
}

const TIMEOUT_MS = 10000;

async function fetchFirst(urls: string[]): Promise<Response | null> {
  let lastError: unknown = null;
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 404) return null;
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('fetch failed');
}

/** 中国：NateScarlet/holiday-cn（法定节假日 + 调休上班日）。jsDelivr 在国内也比较容易访问 */
const cn: HolidayProvider = {
  country: 'CN',
  async fetchYear(year) {
    const res = await fetchFirst([
      `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
      `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
    ]);
    if (!res) return null;
    const days = parseCnJson(await res.json());
    return days.length ? days : null;
  },
  bundled: (year) => (cnBundled as Record<string, HolidayDay[]>)[year] ?? null,
};

/** 日本：holiday-jp/holiday_jp（祝日、振替休日、国民の休日），一个文件包含所有年份 */
let jpCache: Promise<Map<number, HolidayDay[]>> | null = null;
const jp: HolidayProvider = {
  country: 'JP',
  async fetchYear(year) {
    jpCache ??= (async () => {
      const res = await fetchFirst([
        'https://cdn.jsdelivr.net/gh/holiday-jp/holiday_jp@master/holidays.yml',
        'https://raw.githubusercontent.com/holiday-jp/holiday_jp/master/holidays.yml',
      ]);
      if (!res) return new Map();
      return parseJpYaml(await res.text());
    })().catch((e) => {
      jpCache = null;
      throw e;
    });
    return (await jpCache).get(year) ?? null;
  },
  bundled: (year) => (jpBundled as Record<string, HolidayDay[]>)[year] ?? null,
};

export const HOLIDAY_PROVIDERS: Record<CountryCode, HolidayProvider> = { CN: cn, JP: jp };
