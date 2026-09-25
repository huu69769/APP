import type { Currency, MinorUnits } from '@/data/types';

import type { MoneyByCurrency } from './stats';

/** 收入目标：金额 + 币种（只统计这个币种的收入，不同币种不相加） */
export interface IncomeTarget {
  amount: MinorUnits;
  currency: Currency;
}

export interface TargetProgress {
  /** 已经赚到（班次已结束） */
  earned: MinorUnits;
  /** 已排班的全部（已赚 + 还没上的班） */
  expected: MinorUnits;
  /** 进度条用：0–1 */
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
