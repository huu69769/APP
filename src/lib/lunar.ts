import { Solar } from 'lunar-javascript';

import { parseLocalDate, type LocalDate } from './date';

export interface LunarInfo {
  /** "八月十五"、"闰六月初一" */
  date: string;
  /** 传统节日（春节、中秋节…）或节气（清明、秋分…）；没有为 null */
  special: string | null;
  /** 月历格子里的小字：节日 > 节气 > 初一显示月份（"八月"）> 日（"十五"） */
  short: string;
}

/** 农历信息（农历日期、节气、传统节日） */
export function lunarInfo(date: LocalDate): LunarInfo {
  const d = parseLocalDate(date);
  const lunar = Solar.fromYmd(d.year(), d.month() + 1, d.date()).getLunar();
  const month = `${lunar.getMonthInChinese()}月`;
  const day = lunar.getDayInChinese();
  const special = lunar.getFestivals()[0] ?? (lunar.getJieQi() || null);
  return {
    date: `${month}${day}`,
    special,
    short: special ?? (day === '初一' ? month : day),
  };
}
