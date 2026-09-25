import type { Currency, MinorUnits } from '@/data/types';

import type { YearMonth } from './date';
import type { MoneyByCurrency } from './stats';

/** 收入目标：金额 + 币种（只统计这个币种的收入，不同币种不相加） */
export interface IncomeTarget {
  amount: MinorUnits;
  currency: Currency;
}

/** 每个月单独的目标，键是 "YYYY-MM" */
export type MonthlyTargets = Partial<Record<YearMonth, IncomeTarget>>;

export interface TargetProgress {
  /** 已经赚到（班次已结束） */
  earned: MinorUnits;
  /** 已排班的全部（已赚 + 还没上的班） */
  expected: MinorUnits;
  /** 进度用：0–1 */
  earnedRatio: number;
  expectedRatio: number;
  /** 已赚占目标的百分比（取整，可以超过 100） */
  percent: number;
  /** 离目标还差多少（已达成为 0） */
  remaining: MinorUnits;
}

export function targetProgress(
  target: IncomeTarget,
  wage: { completed: MoneyByCurrency; total: MoneyByCurrency }
): TargetProgress {
  const earned = wage.completed[target.currency] ?? 0;
  const expected = Math.max(wage.total[target.currency] ?? 0, earned);
  const ratio = (v: number) => (target.amount > 0 ? Math.min(v / target.amount, 1) : 1);
  return {
    earned,
    expected,
    earnedRatio: ratio(earned),
    expectedRatio: ratio(expected),
    percent: target.amount > 0 ? Math.floor((earned / target.amount) * 100) : 100,
    remaining: Math.max(target.amount - earned, 0),
  };
}

/** 柱状图的一个月 */
export interface MonthBar {
  month: YearMonth;
  earned: MinorUnits;
  expected: MinorUnits;
  /** 这个月的目标（币种和图表一致时才有） */
  target: MinorUnits | null;
  /** 已达标：已赚 ≥ 目标 */
  reached: boolean;
}

/**
 * 全年目标 vs 实际（只看一种币种）：
 * - 年目标合计 = 各月目标（同币种）加起来
 * - 达标月数：有目标、并且已经结束（或已经达标）的月份里，达标的有几个
 */
export function yearTargetSummary(params: {
  months: { month: YearMonth; wage: MoneyByCurrency; completed: MoneyByCurrency }[];
  targets: MonthlyTargets;
  currency: Currency;
  currentMonth: YearMonth;
}): {
  bars: MonthBar[];
  earned: MinorUnits;
  expected: MinorUnits;
  targetTotal: MinorUnits;
  reachedCount: number;
  judgedCount: number;
} {
  const { months, targets, currency, currentMonth } = params;
  let earned = 0;
  let expected = 0;
  let targetTotal = 0;
  let reachedCount = 0;
  let judgedCount = 0;
  const bars = months.map((m) => {
    const e = m.completed[currency] ?? 0;
    const x = Math.max(m.wage[currency] ?? 0, e);
    const t = targets[m.month];
    const target = t && t.currency === currency ? t.amount : null;
    const reached = target !== null && e >= target;
    earned += e;
    expected += x;
    if (target !== null) {
      targetTotal += target;
      // 过去的月份按结果算；本月及以后只在已经达标时算进去
      if (m.month < currentMonth || reached) {
        judgedCount++;
        if (reached) reachedCount++;
      }
    }
    return { month: m.month, earned: e, expected: x, target, reached };
  });
  return { bars, earned, expected, targetTotal, reachedCount, judgedCount };
}

/** 这一年里出现过的币种（有收入或设了目标的），用来决定图表可以切换哪些币种 */
export function currenciesInYear(
  months: { month: YearMonth; wage: MoneyByCurrency }[],
  targets: MonthlyTargets
): Currency[] {
  const set = new Set<Currency>();
  for (const m of months) {
    for (const c of Object.keys(m.wage) as Currency[]) set.add(c);
    const t = targets[m.month];
    if (t) set.add(t.currency);
  }
  return [...set];
}

/** 图表纵轴的上限：取一个好看的整数（1、2、5 × 10ⁿ），比最大值稍大 */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(value)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= value) return f * p;
  return 10 * p;
}
