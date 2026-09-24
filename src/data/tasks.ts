import type { LocalDate } from '@/lib/date';

import type { Job, NewEntity, Task } from './types';

/** 新建任务。币种默认用兼职的币种 */
export function buildTask(
  job: Job,
  input: Pick<Task, 'title' | 'dueDate' | 'amount'> &
    Partial<Pick<Task, 'currency' | 'deliveredDate' | 'minutesSpent' | 'note'>>
): NewEntity<Task> {
  return {
    jobId: job.id,
    title: input.title,
    dueDate: input.dueDate,
    amount: input.amount,
    currency: input.currency ?? job.currency,
    deliveredDate: input.deliveredDate ?? null,
    minutesSpent: input.minutesSpent ?? null,
    note: input.note ?? '',
    reminderMinutesBefore: null,
  };
}

/** 截止日或交付日是这一天的任务 */
export function tasksOnDate<T extends Pick<Task, 'dueDate' | 'deliveredDate'>>(
  tasks: T[],
  date: LocalDate
): T[] {
  return tasks.filter((t) => t.dueDate === date || t.deliveredDate === date);
}
