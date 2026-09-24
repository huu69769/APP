import type { LocalDate } from '@/lib/date';

import type { Job, NewEntity, Task } from './types';

/** 新建项目。币种默认用客户（工作）的币种 */
export function buildTask(
  job: Job,
  input: Pick<Task, 'title' | 'dueDate' | 'amount'> & Partial<Pick<Task, 'currency' | 'note'>>
): NewEntity<Task> {
  return {
    jobId: job.id,
    title: input.title,
    dueDate: input.dueDate,
    amount: input.amount,
    currency: input.currency ?? job.currency,
    note: input.note ?? '',
    reminderMinutesBefore: null,
  };
}

/** DDL 已经过了（统计里算「已完成」） */
export function isTaskDone(task: Pick<Task, 'dueDate'>, today: LocalDate): boolean {
  return task.dueDate < today;
}

/** DDL 是这一天的项目 */
export function tasksOnDate<T extends Pick<Task, 'dueDate'>>(tasks: T[], date: LocalDate): T[] {
  return tasks.filter((t) => t.dueDate === date);
}
