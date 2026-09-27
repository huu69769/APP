import type {
  Anniversary,
  CalendarEvent,
  Currency,
  Deposit,
  SavingPlan,
  Shift,
  Task,
} from '@/data/types';

import { occurrencesInRange } from './anniversary';
import { addDays, addMonths, dayjs, type LocalDate } from './date';
import { isActiveIn, monthSummary, saveDate } from './savings';

/** 班次、日程可选的「提前多久提醒」（分钟）；null = 不提醒 */
export const TIMED_REMINDER_OPTIONS = [null, 0, 30, 60, 1440] as const;
/** 项目（DDL）可选的提醒：当天、前一天、3 天前（都在 9:00） */
export const TASK_REMINDER_OPTIONS = [null, 0, 1440, 4320] as const;
/** 纪念日可选的提醒：当天、1 天前、3 天前、7 天前（都在 9:00） */
export const ANNIVERSARY_REMINDER_OPTIONS = [null, 0, 1, 3, 7] as const;

/** 全天日程和项目 DDL 的提醒基准时间 */
export const ALL_DAY_BASE_TIME = '09:00';

/** 最多安排多少天以内的提醒、最多多少条（Android 对闹钟数量有限制） */
export const REMINDER_HORIZON_DAYS = 60;
export const MAX_REMINDERS = 300;

export interface Reminder {
  /** 通知的唯一 ID，比如 "shift:<id>" */
  id: string;
  kind: 'shift' | 'event' | 'task' | 'anniversary' | 'saving';
  /** 提醒的时间 */
  at: Date;
  /** 事情开始的日期、时间（全天日程 / 项目的时间为 null） */
  date: LocalDate;
  time: string | null;
  endTime: string | null;
  /** 班次：兼职名；日程：标题；项目：项目名；存钱：计划名 */
  title: string;
  /** 存钱：这次该存的金额 */
  amount?: { value: number; currency: Currency };
}

function localDateTime(date: LocalDate, time: string): Date {
  return dayjs(`${date} ${time}`, 'YYYY-MM-DD HH:mm').toDate();
}

/**
 * 根据当前数据算出所有要安排的提醒。
 * 每次数据变化都重新算一遍、整体重新安排，这样修改或删除后提醒一定是同步的（PRD 3.5）。
 */
export function computeReminders(params: {
  shifts: Pick<
    Shift,
    'id' | 'jobId' | 'date' | 'startTime' | 'endTime' | 'reminderMinutesBefore'
  >[];
  events: Pick<
    CalendarEvent,
    'id' | 'date' | 'title' | 'allDay' | 'startTime' | 'endTime' | 'reminderMinutesBefore'
  >[];
  tasks: Pick<Task, 'id' | 'title' | 'dueDate' | 'reminderMinutesBefore'>[];
  anniversaries?: Pick<
    Anniversary,
    'id' | 'title' | 'date' | 'repeat' | 'lunar' | 'reminderDaysBefore'
  >[];
  /** 存钱计划：每月存钱日 9:00 提醒（这个月已经存够的不提醒） */
  savings?: {
    plans: Pick<
      SavingPlan,
      | 'id'
      | 'name'
      | 'currency'
      | 'monthlyAmount'
      | 'startMonth'
      | 'endMonth'
      | 'targetAmount'
      | 'saveDay'
      | 'pauses'
      | 'remind'
    >[];
    deposits: Pick<Deposit, 'planId' | 'date' | 'amount'>[];
  };
  jobNames: Map<string, string>;
  now: Date;
  horizonDays?: number;
  max?: number;
}): Reminder[] {
  const { now } = params;
  const until = dayjs(now)
    .add(params.horizonDays ?? REMINDER_HORIZON_DAYS, 'day')
    .toDate();
  const result: Reminder[] = [];
  const add = (r: Omit<Reminder, 'at'>, base: Date, minutesBefore: number) => {
    const at = dayjs(base).subtract(minutesBefore, 'minute').toDate();
    if (at > now && at <= until) result.push({ ...r, at });
  };

  for (const s of params.shifts) {
    if (s.reminderMinutesBefore === null || !s.startTime) continue;
    add(
      {
        id: `shift:${s.id}`,
        kind: 'shift',
        date: s.date,
        time: s.startTime,
        endTime: s.endTime,
        title: params.jobNames.get(s.jobId) ?? '',
      },
      localDateTime(s.date, s.startTime),
      s.reminderMinutesBefore
    );
  }
  for (const e of params.events) {
    if (e.reminderMinutesBefore === null) continue;
    const time = e.allDay ? null : e.startTime;
    add(
      {
        id: `event:${e.id}`,
        kind: 'event',
        date: e.date,
        time,
        endTime: e.allDay ? null : e.endTime,
        title: e.title,
      },
      localDateTime(e.date, time ?? ALL_DAY_BASE_TIME),
      e.reminderMinutesBefore
    );
  }
  for (const t of params.tasks) {
    if (t.reminderMinutesBefore === null) continue;
    add(
      {
        id: `task:${t.id}`,
        kind: 'task',
        date: t.dueDate,
        time: null,
        endTime: null,
        title: t.title,
      },
      localDateTime(t.dueDate, ALL_DAY_BASE_TIME),
      t.reminderMinutesBefore
    );
  }

  const nowDate = dayjs(now).format('YYYY-MM-DD');
  const lastDate = dayjs(until).add(7, 'day').format('YYYY-MM-DD');
  for (const a of params.anniversaries ?? []) {
    if (a.reminderDaysBefore === null) continue;
    for (const o of occurrencesInRange(a, addDays(nowDate, -1), lastDate)) {
      add(
        // 重复的纪念日每年一条，ID 里带上日期
        {
          id: `anniversary:${a.id}:${o.date}`,
          kind: 'anniversary',
          date: o.date,
          time: null,
          endTime: null,
          title: a.title,
        },
        localDateTime(o.date, ALL_DAY_BASE_TIME),
        a.reminderDaysBefore * 1440
      );
    }
  }

  if (params.savings) {
    const { plans, deposits } = params.savings;
    const thisMonth = nowDate.slice(0, 7);
    for (let i = 0; i < 3; i++) {
      const month = addMonths(thisMonth, i);
      const summary = monthSummary({ plans, deposits, month, today: nowDate });
      for (const plan of plans) {
        if (!plan.remind || !isActiveIn(plan, month)) continue;
        const info = summary.plans.find((p) => p.planId === plan.id);
        if (!info || info.status !== 'active' || info.owed === 0) continue;
        const date = saveDate(plan, month);
        add(
          {
            id: `saving:${plan.id}:${month}`,
            kind: 'saving',
            date,
            time: null,
            endTime: null,
            title: plan.name,
            amount: { value: info.owed, currency: plan.currency },
          },
          localDateTime(date, ALL_DAY_BASE_TIME),
          0
        );
      }
    }
  }

  return result
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, params.max ?? MAX_REMINDERS);
}
