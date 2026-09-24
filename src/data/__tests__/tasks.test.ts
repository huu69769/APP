import { primaryTask, tasksOnDate } from '../tasks';

const task = (
  id: string,
  jobId: string,
  createdAt: string,
  dueDate = '2026-09-30',
  deliveredDate: string | null = null
) => ({
  id,
  jobId,
  createdAt,
  dueDate,
  deliveredDate,
});

describe('primaryTask', () => {
  it('returns the earliest created task of the job', () => {
    const tasks = [
      task('b', 'j1', '2026-09-02T00:00:00Z'),
      task('a', 'j1', '2026-09-01T00:00:00Z'),
      task('c', 'j2', '2026-08-01T00:00:00Z'),
    ];
    expect(primaryTask(tasks, 'j1')?.id).toBe('a');
    expect(primaryTask(tasks, 'j3')).toBeUndefined();
  });
});

describe('tasksOnDate', () => {
  it('matches the due date or the delivered date', () => {
    const tasks = [
      task('a', 'j', 'x', '2026-09-30'),
      task('b', 'j', 'x', '2026-10-05', '2026-09-30'),
      task('c', 'j', 'x', '2026-10-01'),
    ];
    expect(tasksOnDate(tasks, '2026-09-30').map((t) => t.id)).toEqual(['a', 'b']);
  });
});
