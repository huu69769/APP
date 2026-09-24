import { isTaskDone, tasksOnDate } from '../tasks';

describe('tasksOnDate', () => {
  it('matches the due date', () => {
    const tasks = [
      { id: 'a', dueDate: '2026-09-30' },
      { id: 'b', dueDate: '2026-10-01' },
    ];
    expect(tasksOnDate(tasks, '2026-09-30').map((t) => t.id)).toEqual(['a']);
  });
});

describe('isTaskDone', () => {
  it('is done only after the due date has passed', () => {
    expect(isTaskDone({ dueDate: '2026-09-29' }, '2026-09-30')).toBe(true);
    expect(isTaskDone({ dueDate: '2026-09-30' }, '2026-09-30')).toBe(false);
    expect(isTaskDone({ dueDate: '2026-10-01' }, '2026-09-30')).toBe(false);
  });
});
