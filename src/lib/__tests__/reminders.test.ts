import { computeReminders } from '../reminders';

const now = new Date(2026, 8, 25, 8, 0); // 2026-09-25 08:00 本地时间

const shift = (id: string, date: string, startTime: string | null, reminder: number | null) => ({
  id,
  jobId: 'j',
  date,
  startTime,
  endTime: startTime ? '14:00' : null,
  reminderMinutesBefore: reminder,
});

describe('computeReminders', () => {
  it('schedules shifts before their start time', () => {
    const r = computeReminders({
      shifts: [shift('a', '2026-09-25', '09:00', 30), shift('b', '2026-09-26', '09:00', 1440)],
      events: [],
      tasks: [],
      jobNames: new Map([['j', '便利店']]),
      now,
    });
    expect(r.map((x) => [x.id, x.at])).toEqual([
      ['shift:a', new Date(2026, 8, 25, 8, 30)],
      ['shift:b', new Date(2026, 8, 25, 9, 0)],
    ]);
    expect(r[0]).toMatchObject({ kind: 'shift', title: '便利店', time: '09:00', endTime: '14:00' });
  });

  it('skips shifts without reminder, pending shifts and past reminders', () => {
    const r = computeReminders({
      shifts: [
        shift('none', '2026-09-26', '09:00', null),
        shift('pending', '2026-09-26', null, 30),
        shift('past', '2026-09-25', '08:10', 30), // 07:40 已经过了
      ],
      events: [],
      tasks: [],
      jobNames: new Map(),
      now,
    });
    expect(r).toEqual([]);
  });

  it('uses 09:00 for all-day events and project DDLs', () => {
    const r = computeReminders({
      shifts: [],
      events: [
        {
          id: 'e1',
          date: '2026-09-27',
          title: '聚餐',
          allDay: true,
          startTime: null,
          endTime: null,
          reminderMinutesBefore: 0,
        },
        {
          id: 'e2',
          date: '2026-09-27',
          title: '面试',
          allDay: false,
          startTime: '15:00',
          endTime: '16:00',
          reminderMinutesBefore: 60,
        },
      ],
      tasks: [
        { id: 't1', title: '说明书翻译', dueDate: '2026-09-30', reminderMinutesBefore: 1440 },
      ],
      jobNames: new Map(),
      now,
    });
    expect(r.map((x) => [x.id, x.at])).toEqual([
      ['event:e1', new Date(2026, 8, 27, 9, 0)],
      ['event:e2', new Date(2026, 8, 27, 14, 0)],
      ['task:t1', new Date(2026, 8, 29, 9, 0)],
    ]);
  });

  it('only schedules within the horizon and caps the count', () => {
    const r = computeReminders({
      shifts: [
        shift('near', '2026-09-26', '09:00', 0),
        shift('far', '2027-01-01', '09:00', 0),
        shift('near2', '2026-09-27', '09:00', 0),
      ],
      events: [],
      tasks: [],
      jobNames: new Map(),
      now,
      horizonDays: 60,
      max: 1,
    });
    expect(r.map((x) => x.id)).toEqual(['shift:near']);
  });
});

describe('anniversary reminders', () => {
  it('schedules the next yearly occurrence at 9:00 minus the days before', () => {
    const r = computeReminders({
      shifts: [],
      events: [],
      tasks: [],
      anniversaries: [
        {
          id: 'a1',
          title: '妈妈生日',
          date: '1970-10-07',
          repeat: true,
          lunar: false,
          reminderDaysBefore: 3,
        },
        {
          id: 'a2',
          title: '不提醒',
          date: '1970-10-08',
          repeat: true,
          lunar: false,
          reminderDaysBefore: null,
        },
        {
          id: 'a3',
          title: '已过去',
          date: '2026-01-01',
          repeat: false,
          lunar: false,
          reminderDaysBefore: 0,
        },
      ],
      jobNames: new Map(),
      now: new Date(2026, 8, 25, 12, 0),
    });
    expect(r.map((x) => [x.id, x.at.getMonth() + 1, x.at.getDate(), x.at.getHours()])).toEqual([
      ['anniversary:a1:2026-10-07', 10, 4, 9],
    ]);
  });
});
