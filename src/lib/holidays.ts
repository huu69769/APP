import type { LocalDate } from './date';

/**
 * 节假日按「国家」接入：每个国家提供一份 HolidayDay 列表。
 * 以后加其他国家时，只需在 src/holidays/providers.ts 里再加一个国家。
 */
export type CountryCode = 'CN' | 'JP';

export interface HolidayDay {
  date: LocalDate;
  name: string;
  /** true = 放假；false = 调休上班日（中国） */
  off: boolean;
}

export interface HolidayMark extends HolidayDay {
  country: CountryCode;
}

export type HolidayMode = 'cn' | 'jp' | 'both' | 'none';

export function countriesForMode(mode: HolidayMode): CountryCode[] {
  switch (mode) {
    case 'cn':
      return ['CN'];
    case 'jp':
      return ['JP'];
    case 'both':
      return ['CN', 'JP'];
    case 'none':
      return [];
  }
}

/** 解析 holiday-cn 的 JSON（{ year, papers, days: [{ name, date, isOffDay }] }） */
export function parseCnJson(json: unknown): HolidayDay[] {
  const days = (json as { days?: unknown })?.days;
  if (!Array.isArray(days)) throw new Error('Invalid holiday-cn data');
  return days
    .filter(
      (d): d is { name: string; date: string; isOffDay: boolean } =>
        typeof d?.name === 'string' &&
        typeof d?.date === 'string' &&
        typeof d?.isOffDay === 'boolean'
    )
    .map((d) => ({ date: d.date, name: d.name, off: d.isOffDay }));
}

/**
 * 解析 holiday_jp 的 holidays.yml（每行 "2026-05-06: こどもの日 振替休日"），按年份分组。
 * 包括振替休日和国民の休日。
 */
export function parseJpYaml(text: string): Map<number, HolidayDay[]> {
  const byYear = new Map<number, HolidayDay[]>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\d{4})-(\d{2})-(\d{2}):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const year = Number(m[1]);
    const list = byYear.get(year) ?? [];
    list.push({ date: `${m[1]}-${m[2]}-${m[3]}`, name: m[4], off: true });
    byYear.set(year, list);
  }
  return byYear;
}

/** 把各国的数据合并成「日期 → 标记」 */
export function buildMarks(
  data: { country: CountryCode; days: HolidayDay[] }[]
): Map<LocalDate, HolidayMark[]> {
  const marks = new Map<LocalDate, HolidayMark[]>();
  for (const { country, days } of data) {
    for (const d of days) marks.set(d.date, [...(marks.get(d.date) ?? []), { ...d, country }]);
  }
  return marks;
}

/**
 * 是否需要从网上更新某国某年的数据：
 * - 手机里还没有 → 要
 * - 今年、明年的数据：超过 3 天没检查 → 要（年底中国公布新一年安排后能自动更新）
 * - 以前的年份：有了就不再更新
 */
export function needsRefresh(params: {
  year: number;
  currentYear: number;
  fetchedAt: string | null;
  now: Date;
  maxAgeDays?: number;
}): boolean {
  if (!params.fetchedAt) return true;
  if (params.year < params.currentYear) return false;
  const ageMs = params.now.getTime() - new Date(params.fetchedAt).getTime();
  return ageMs > (params.maxAgeDays ?? 3) * 24 * 60 * 60 * 1000;
}
