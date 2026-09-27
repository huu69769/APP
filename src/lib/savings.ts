import type { Currency, Deposit, MinorUnits, SavingPlan } from '@/data/types';

import { parseYearMonth, type LocalDate, type YearMonth } from './date';
import { addMoney, type MoneyByCurrency } from './stats';
import type { MonthBar } from './target';

export type PlanStatus = 'upcoming' | 'active' | 'paused' | 'done';

type PlanLike = Pick<
  SavingPlan,
  | 'id'
  | 'currency'
  | 'monthlyAmount'
  | 'startMonth'
  | 'endMonth'
  | 'targetAmount'
  | 'saveDay'
  | 'pauses'
>;
type DepositLike = Pick<Deposit, 'planId' | 'date' | 'amount'>;

/** 两个月份之间有几个月（含两端）；b 在 a 之前为 0 */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return Math.max(by * 12 + bm - (ay * 12 + am) + 1, 0);
}

export function isPausedIn(plan: Pick<SavingPlan, 'pauses'>, month: YearMonth): boolean {
  return plan.pauses.some((p) => p.from <= month && (p.to === null || month <= p.to));
}

/** 这个月是否要存（已开始、没结束、没暂停） */
export function isActiveIn(plan: PlanLike, month: YearMonth): boolean {
  return (
    plan.startMonth <= month &&
    (plan.endMonth === null || month <= plan.endMonth) &&
    !isPausedIn(plan, month)
  );
}

/** 总目标：手动设的，或者 每月金额 × 月数；长期计划（没有结束月）没有总目标 */
export function planTarget(plan: PlanLike): MinorUnits | null {
  if (plan.targetAmount !== null) return plan.targetAmount;
  if (plan.endMonth === null) return null;
  return plan.monthlyAmount * monthsBetween(plan.startMonth, plan.endMonth);
}

export function savedTotal(planId: string, deposits: DepositLike[]): MinorUnits {
  return deposits.filter((d) => d.planId === planId).reduce((sum, d) => sum + d.amount, 0);
}

/**
 * 状态：
 * - upcoming：还没到开始月（不提醒、不算进每月合计）
 * - done：过了结束月，或者已经存满总目标
 * - paused：手动暂停中
 * - active：进行中
 */
export function planStatus(plan: PlanLike, month: YearMonth, saved: MinorUnits): PlanStatus {
  if (month < plan.startMonth) return 'upcoming';
  const target = planTarget(plan);
  if ((plan.endMonth !== null && month > plan.endMonth) || (target !== null && saved >= target)) {
    return 'done';
  }
  if (isPausedIn(plan, month)) return 'paused';
  return 'active';
}

/** 离开始还有几个月（本月开始为 0） */
export function monthsUntil(from: YearMonth, to: YearMonth): number {
  return Math.max(monthsBetween(from, to) - 1, 0);
}

/** 这个月的存钱日（超过当月天数按月底） */
export function saveDate(plan: Pick<SavingPlan, 'saveDay'>, month: YearMonth): LocalDate {
  const m = parseYearMonth(month);
  return m.date(Math.min(plan.saveDay, m.daysInMonth())).format('YYYY-MM-DD');
}

export interface PlanMonth {
  planId: string;
  currency: Currency;
  status: PlanStatus;
  /** 这个月应存（进行中才有） */
  required: MinorUnits;
  /** 这个月已经存了多少（按存入日期所在的月份） */
  saved: MinorUnits;
  /** 这个月还差多少 */
  owed: MinorUnits;
  /** 这个月的存钱日 */
  dueDate: LocalDate;
  /** 存钱日已到（含当天）但还没存够 → 首页提示 */
  overdue: boolean;
}

/** 某个月每个计划的情况，以及按币种的合计 */
export function monthSummary(params: {
  plans: PlanLike[];
  deposits: DepositLike[];
  month: YearMonth;
  today: LocalDate;
}): {
  plans: PlanMonth[];
  required: MoneyByCurrency;
  saved: MoneyByCurrency;
  owed: MoneyByCurrency;
} {
  const { plans, deposits, month, today } = params;
  const required: MoneyByCurrency = {};
  const saved: MoneyByCurrency = {};
  const owed: MoneyByCurrency = {};
  const rows = plans.map((plan) => {
    const total = savedTotal(
      plan.id,
      deposits.filter((d) => d.date.slice(0, 7) <= month)
    );
    const inMonth = deposits
      .filter((d) => d.planId === plan.id && d.date.startsWith(month))
      .reduce((s, d) => s + d.amount, 0);
    // 这个月存满目标的，状态按存之前算（这个月还是「进行中」）
    const status = planStatus(plan, month, total - inMonth);
    const req = status === 'active' ? plan.monthlyAmount : 0;
    const o = Math.max(req - inMonth, 0);
    const dueDate = saveDate(plan, month);
    if (req) addMoney(required, plan.currency, req);
    if (inMonth) addMoney(saved, plan.currency, inMonth);
    if (o) addMoney(owed, plan.currency, o);
    return {
      planId: plan.id,
      currency: plan.currency,
      status,
      required: req,
      saved: inMonth,
      owed: o,
      dueDate,
      overdue: o > 0 && today >= dueDate,
    };
  });
  return { plans: rows, required, saved, owed };
}

/** 全年每个月：实际存入（柱子）和应存（目标底柱），只看一种币种 */
export function savingsYearBars(params: {
  plans: PlanLike[];
  deposits: DepositLike[];
  year: number;
  currency: Currency;
  today: LocalDate;
}): MonthBar[] {
  const { plans, deposits, year, currency, today } = params;
  const mine = plans.filter((p) => p.currency === currency);
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const s = monthSummary({ plans: mine, deposits, month, today });
    const saved = s.saved[currency] ?? 0;
    const required = s.required[currency] ?? 0;
    return {
      month,
      earned: saved,
      expected: saved,
      target: required > 0 ? required : null,
      reached: required > 0 && saved >= required,
    };
  });
}

/** 从这个月开始暂停 */
export function pauseFrom(pauses: PausePeriodLike[], month: YearMonth): PausePeriodLike[] {
  if (pauses.some((p) => p.to === null)) return pauses;
  return [...pauses, { from: month, to: null }];
}

/** 从这个月恢复：暂停到上个月为止；同一个月里暂停又恢复就当没暂停过 */
export function resumeIn(pauses: PausePeriodLike[], month: YearMonth): PausePeriodLike[] {
  const prev = parseYearMonth(month).subtract(1, 'month').format('YYYY-MM');
  return pauses.flatMap((p) => {
    if (p.to !== null) return [p];
    return p.from >= month ? [] : [{ from: p.from, to: prev }];
  });
}

type PausePeriodLike = { from: YearMonth; to: YearMonth | null };

/**
 * 某个月存进存钱计划的钱，换成收入的币种算：
 * 计划币种相同 → 用存入金额；不同 → 用填写的「实际花费」（没填的不算）
 */
export function planSpendingIn(params: {
  plans: Pick<SavingPlan, 'id' | 'currency'>[];
  deposits: Pick<Deposit, 'planId' | 'date' | 'amount' | 'spent'>[];
  month: YearMonth;
  currency: Currency;
}): MinorUnits {
  const { plans, deposits, month, currency } = params;
  let total = 0;
  for (const d of deposits) {
    if (!d.date.startsWith(month)) continue;
    const plan = plans.find((p) => p.id === d.planId);
    if (!plan) continue;
    if (plan.currency === currency) total += d.amount;
    else if (d.spent && d.spent.currency === currency) total += d.spent.amount;
  }
  return total;
}
