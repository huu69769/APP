import type { CountryCode, HolidayMark } from './holidays';
import type { LunarInfo } from './lunar';

export type BadgeKind = 'cnOff' | 'cnWork' | 'jpOff';

export interface DayLabel {
  /** 右上角的小标：休 / 班 / 祝 */
  badges: BadgeKind[];
  /** 日期数字下面的小字 */
  text: string | null;
  tone: CountryCode | 'lunarSpecial' | 'lunar' | null;
  /** 是否放假（日期数字显示成红色） */
  off: boolean;
  /** 调休上班日（周末也按平日颜色显示） */
  workday: boolean;
}

/**
 * 月历格子里显示什么：
 * - 小标：中国放假「休」、调休上班「班」、日本祝日「祝」（中日合并时靠颜色和小标区分国家）
 * - 小字：放假的节日名 > 农历节日 / 节气 > 农历日期
 */
export function dayLabel(marks: HolidayMark[], lunar: LunarInfo | null): DayLabel {
  const badges: BadgeKind[] = [];
  for (const m of marks) {
    const kind: BadgeKind = m.country === 'JP' ? 'jpOff' : m.off ? 'cnOff' : 'cnWork';
    if (!badges.includes(kind)) badges.push(kind);
  }
  const offMark = marks.find((m) => m.off);
  const workday = marks.some((m) => m.country === 'CN' && !m.off);
  if (offMark) {
    return { badges, text: offMark.name, tone: offMark.country, off: true, workday };
  }
  if (lunar) {
    return {
      badges,
      text: lunar.short,
      tone: lunar.special ? 'lunarSpecial' : 'lunar',
      off: false,
      workday,
    };
  }
  return { badges, text: null, tone: null, off: false, workday };
}
