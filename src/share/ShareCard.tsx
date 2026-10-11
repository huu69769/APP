import { forwardRef } from 'react';
import { Platform } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { Job, Shift } from '@/data/types';
import { isTimed } from '@/data/types';
import { buildMonthGrid, orderedWeekdays, type WeekStart } from '@/lib/calendar';
import type { YearMonth } from '@/lib/date';
import { sortShifts } from '@/data/shifts';
import { lightColors } from '@/theme/colors';

/** 分享图片的宽度（像素）；高度按周数算 */
export const SHARE_WIDTH = 1080;
const PAD = 48;
const HEADER = 150;
const WEEKDAY_ROW = 56;
const CELL_H = 190;
const FOOTER = 90;
const MAX_PER_DAY = 2;
/** 网页导出图片时浏览器默认用衬线字体，指定成无衬线；手机上用系统默认字体 */
const FONT =
  Platform.OS === 'web'
    ? "-apple-system, 'Helvetica Neue', 'Hiragino Sans', 'PingFang SC', 'Noto Sans CJK JP', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
    : undefined;

/** 分享图片的高度 */
export function shareHeight(weeks: number): number {
  return HEADER + WEEKDAY_ROW + weeks * CELL_H + FOOTER;
}

/** 去掉月末全是下个月日期的那几行 */
export function shareWeeks(month: YearMonth, weekStart: WeekStart) {
  return buildMonthGrid(month, weekStart).filter((w) => w.some((d) => d.inMonth));
}

/** 工作名称太长时截断 */
function short(name: string, max = 6): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * 分享用的月历图片（只画打工班次，不含工资和日程）。
 * 固定用浅色配色：发给朋友的图片不跟着夜间模式变。
 */
interface ShareCardProps {
  month: YearMonth;
  weekStart: WeekStart;
  shifts: Shift[];
  jobsById: Map<string, Pick<Job, 'name' | 'color'>>;
  showNames: boolean;
  texts: {
    title: string;
    subtitle: string;
    weekdays: string[];
    work: string;
    pending: string;
    more: (n: number) => string;
    footer: string;
  };
}

export const ShareCard = forwardRef<Svg, ShareCardProps>(function ShareCard(
  { month, weekStart, shifts, jobsById, showNames, texts },
  ref
) {
  const c = lightColors;
  const weeks = shareWeeks(month, weekStart);
  const height = shareHeight(weeks.length);
  const cellW = (SHARE_WIDTH - PAD * 2) / 7;
  const byDate = new Map<string, Shift[]>();
  for (const s of sortShifts(shifts)) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const gridTop = HEADER + WEEKDAY_ROW;

  return (
    <Svg ref={ref} width="100%" height="100%" viewBox={`0 0 ${SHARE_WIDTH} ${height}`}>
      <G fontFamily={FONT}>
        <Rect x={0} y={0} width={SHARE_WIDTH} height={height} fill={c.background} />
        <SvgText x={PAD} y={84} fontSize={52} fontWeight="bold" fill={c.text}>
          {texts.title}
        </SvgText>
        <SvgText x={PAD} y={124} fontSize={26} fill={c.textMuted}>
          {texts.subtitle}
        </SvgText>

        {orderedWeekdays(weekStart).map((wd, i) => (
          <SvgText
            key={wd}
            x={PAD + cellW * i + cellW / 2}
            y={HEADER + 38}
            fontSize={24}
            textAnchor="middle"
            fill={wd === 0 ? c.sunday : wd === 6 ? c.saturday : c.textMuted}>
            {texts.weekdays[wd]}
          </SvgText>
        ))}

        {weeks.map((week, w) => {
          const y = gridTop + w * CELL_H;
          return (
            <G key={w}>
              <Line
                x1={PAD}
                x2={SHARE_WIDTH - PAD}
                y1={y}
                y2={y}
                stroke={c.border}
                strokeWidth={2}
              />
              {week.map((day, i) => {
                if (!day.inMonth) return null;
                const x = PAD + cellW * i;
                const list = byDate.get(day.date) ?? [];
                return (
                  <G key={day.date}>
                    <SvgText
                      x={x + 10}
                      y={y + 34}
                      fontSize={26}
                      fontWeight={list.length ? 'bold' : 'normal'}
                      fill={day.weekday === 0 ? c.sunday : day.weekday === 6 ? c.saturday : c.text}>
                      {String(day.day)}
                    </SvgText>
                    {list.slice(0, MAX_PER_DAY).map((s, k) => {
                      const job = jobsById.get(s.jobId);
                      const by = y + 48 + k * 56;
                      const time = isTimed(s) ? `${s.startTime}-${s.endTime}` : texts.pending;
                      return (
                        <G key={s.id}>
                          <Rect
                            x={x + 5}
                            y={by}
                            width={cellW - 10}
                            height={50}
                            rx={8}
                            fill={job?.color ?? c.primary}
                            opacity={isTimed(s) ? 1 : 0.55}
                          />
                          <SvgText
                            x={x + cellW / 2}
                            y={by + (showNames ? 21 : 32)}
                            fontSize={showNames ? 18 : 20}
                            fontWeight="bold"
                            textAnchor="middle"
                            fill={c.onColor}>
                            {time}
                          </SvgText>
                          {showNames && (
                            <SvgText
                              x={x + cellW / 2}
                              y={by + 43}
                              fontSize={17}
                              textAnchor="middle"
                              fill={c.onColor}>
                              {short(job?.name ?? texts.work)}
                            </SvgText>
                          )}
                        </G>
                      );
                    })}
                    {list.length > MAX_PER_DAY && (
                      <SvgText
                        x={x + cellW / 2}
                        y={y + CELL_H - 12}
                        fontSize={18}
                        textAnchor="middle"
                        fill={c.textMuted}>
                        {texts.more(list.length - MAX_PER_DAY)}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </G>
          );
        })}
        <Line
          x1={PAD}
          x2={SHARE_WIDTH - PAD}
          y1={gridTop + weeks.length * CELL_H}
          y2={gridTop + weeks.length * CELL_H}
          stroke={c.border}
          strokeWidth={2}
        />
        <SvgText
          x={SHARE_WIDTH - PAD}
          y={height - 36}
          fontSize={22}
          textAnchor="end"
          fill={c.textFaint}>
          {texts.footer}
        </SvgText>
      </G>
    </Svg>
  );
});
