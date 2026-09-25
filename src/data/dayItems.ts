import { isTaskDone } from './tasks';
import { isTimed, type CalendarEvent, type Job, type Shift, type Task } from './types';
import { isOvernight } from '@/lib/shift';
import type { LocalDate } from '@/lib/date';

/** 首页下方列表里的一行：班次、日程或项目 */
export interface DayItem {
  key: string;
  kind: 'shift' | 'event' | 'task' | 'anniversary';
  id: string;
  /** 左边的时间栏：'allDay' / 'pending' / 'ddl' / 'anniv'（纪念日），或者开始、结束时间 */
  slot:
    | 'allDay'
    | 'pending'
    | 'ddl'
    | 'anniv'
    | { start: string; end: string | null; overnight: boolean };
  color: string;
  title: string;
  subtitle: string | null;
  /** 项目：DDL 已过 */
  done?: boolean;
  /** 日程：设了提醒 */
  reminder?: boolean;
  /** 纪念日：第几周年（0 = 最初那天） */
  years?: number;
}

/** 某一天出现的纪念日（重复的已经算好了那一年的日期） */
export interface AnniversaryOccurrence {
  id: string;
  title: string;
  color: string;
  date: LocalDate;
  years: number;
  note: string;
}

const FALLBACK_COLOR = '#8A919C';

/**
 * 某一天的所有安排，排序：全天日程 → 时间待定的班次 → 项目 DDL → 按开始时间的班次和日程。
 */
export function buildDayItems(params: {
  date: LocalDate;
  today: LocalDate;
  shifts: Shift[];
  events: CalendarEvent[];
  tasks: Task[];
  anniversaries?: AnniversaryOccurrence[];
  jobsById: Map<string, Pick<Job, 'name' | 'color'>>;
}): DayItem[] {
  const { date, shifts, events, tasks, jobsById } = params;
  const untimed: DayItem[] = [];

  for (const a of (params.anniversaries ?? []).filter((x) => x.date === date)) {
    untimed.push({
      key: `anniversary:${a.id}`,
      kind: 'anniversary',
      id: a.id,
      slot: 'anniv',
      color: a.color,
      title: a.title,
      subtitle: a.note || null,
      years: a.years,
    });
  }
  const timed: (DayItem & { sort: string })[] = [];

  for (const e of events.filter((x) => x.date === date)) {
    const base = {
      key: `event:${e.id}`,
      kind: 'event' as const,
      id: e.id,
      color: e.color,
      title: e.title,
      subtitle: e.note || null,
      reminder: e.reminderMinutesBefore !== null,
    };
    if (e.allDay || !e.startTime) untimed.push({ ...base, slot: 'allDay' });
    else
      timed.push({
        ...base,
        slot: {
          start: e.startTime,
          end: e.endTime,
          overnight: e.endTime ? isOvernight(e.startTime, e.endTime) : false,
        },
        sort: e.startTime,
      });
  }
  for (const s of shifts.filter((x) => x.date === date)) {
    const job = jobsById.get(s.jobId);
    const base = {
      key: `shift:${s.id}`,
      kind: 'shift' as const,
      id: s.id,
      color: job?.color ?? FALLBACK_COLOR,
      title: job?.name ?? '',
      subtitle: s.note || null,
    };
    if (!isTimed(s)) untimed.push({ ...base, slot: 'pending' });
    else
      timed.push({
        ...base,
        slot: {
          start: s.startTime,
          end: s.endTime,
          overnight: isOvernight(s.startTime, s.endTime),
        },
        sort: s.startTime,
      });
  }
  for (const t of tasks.filter((x) => x.dueDate === date)) {
    const job = jobsById.get(t.jobId);
    untimed.push({
      key: `task:${t.id}`,
      kind: 'task',
      id: t.id,
      slot: 'ddl',
      color: job?.color ?? FALLBACK_COLOR,
      title: t.title,
      subtitle: job?.name ?? null,
      done: isTaskDone(t, params.today),
    });
  }

  const order = { anniv: 0, allDay: 1, pending: 2, ddl: 3 } as Record<string, number>;
  untimed.sort((a, b) => order[a.slot as string] - order[b.slot as string]);
  timed.sort((a, b) => a.sort.localeCompare(b.sort));
  return [...untimed, ...timed.map(({ sort: _sort, ...item }) => item)];
}
