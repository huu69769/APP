import { useEffect } from 'react';

import { useData } from '@/data/DataProvider';
import { useQuery } from '@/data/useQuery';
import { dayLabel, type DayLabel } from '@/lib/dayLabel';
import { eachDay } from '@/lib/period';
import { buildMarks, countriesForMode, type HolidayMark } from '@/lib/holidays';
import { lunarInfo } from '@/lib/lunar';
import type { LocalDate } from '@/lib/date';

import { loadHolidayYear, refreshHolidayYear } from './service';

/**
 * 某个日期范围内每一天的节假日标记和农历小字（按设置里的节假日模式、农历开关）。
 * 同时在后台检查需不需要从网上更新（今年、明年，以及正在看的年份）。
 */
export function useDayLabels(from: LocalDate, to: LocalDate) {
  const { repos, settings } = useData();
  const countries = countriesForMode(settings.holidayMode);
  const showLunar = settings.showLunar;
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));
  const key = countries.join(',');

  useEffect(() => {
    const thisYear = new Date().getFullYear();
    const years = new Set([thisYear, thisYear + 1]);
    for (let y = firstYear; y <= lastYear; y++) years.add(y);
    for (const country of countries) {
      for (const year of years) refreshHolidayYear(repos, country, year).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, key, firstYear, lastYear]);

  return useQuery(
    async (r) => {
      const data = [];
      for (const country of countries) {
        for (let y = firstYear; y <= lastYear; y++) {
          data.push({ country, days: await loadHolidayYear(r, country, y) });
        }
      }
      const marks = buildMarks(data);
      const labels = new Map<LocalDate, DayLabel>();
      for (const date of eachDay({ from, to })) {
        labels.set(date, dayLabel(marks.get(date) ?? [], showLunar ? lunarInfo(date) : null));
      }
      return { labels, marks: marks as Map<LocalDate, HolidayMark[]> };
    },
    [from, to, key, showLunar]
  );
}
