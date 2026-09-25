import { isTaskDone } from './tasks';
import { isTimed, type CalendarEvent, type Job, type Shift, type Task } from './types';
import { isOvernight } from '@/lib/shift';
import type { LocalDate } from '@/lib/date';

/** 首页下方列表里的一行：班次、日程或项目 */
export interface DayItem {
  key: string;
  kind: 'shift' | 'event' | 'task';
  id: string;
  /** 左边的时间栏：'allDay' / 'pending' / 'ddl'，或者开始、结束时间 */
  slot: 'allDay' | 'pending' | 'ddl' | { start: string; end: string | null; overnight: boolean };
  color: string;
  title: string;
  subtitle: string | null;
  /** 项目：DDL 已过 */
  done?: boolean;
  /** 日程：设了提醒 */
  reminder?: boolean;
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
  jobsById: Map<string, Pick<Job, 'name' | 'color'>>;
}): DayItem[] {
  const { date, shifts, events, tasks, jobsById } = params;
  const untimed: DayItem[] = [];
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
        slot: { start: e.startTime, end: e.endTime, overnight: false },
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

  const order = { allDay: 0, pending: 1, ddl: 2 } as Record<string, number>;
  untimed.sort((a, b) => order[a.slot as string] - order[b.slot as string]);
  timed.sort((a, b) => a.sort.localeCompare(b.sort));
  return [...untimed, ...timed.map(({ sort: _sort, ...item }) => item)];
}
