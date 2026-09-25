import { buildDayItems } from '../dayItems';

const base = { createdAt: 'x', updatedAt: 'x', deletedAt: null };
const shift = (id: string, startTime: string | null, endTime: string | null) => ({
  ...base,
  id,
  jobId: 'j',
  date: '2026-09-25',
  startTime,
  endTime,
  breakMinutes: 0,
  wageSnapshot: 1000,
  currencySnapshot: 'CNY' as const,
  note: '',
  reminderMinutesBefore: null,
});
const event = (id: string, allDay: boolean, startTime: string | null) => ({
  ...base,
  id,
  date: '2026-09-25',
  title: id,
  allDay,
  startTime,
  endTime: null,
  color: '#000',
  note: '',
  reminderMinutesBefore: allDay ? null : 30,
});

describe('buildDayItems', () => {
  it('orders all-day, pending, DDL, then by start time', () => {
    const items = buildDayItems({
      date: '2026-09-25',
      today: '2026-09-26',
      shifts: [
        shift('late', '18:00', '22:00'),
        shift('pending', null, null),
        shift('night', '22:00', '06:00'),
      ],
      events: [event('meeting', false, '14:00'), event('trip', true, null)],
      tasks: [
        {
          ...base,
          id: 't',
          jobId: 'c',
          title: '翻译',
          dueDate: '2026-09-25',
          amount: 1,
          currency: 'CNY',
          note: '',
          reminderMinutesBefore: null,
        },
      ],
      jobsById: new Map([
        ['j', { name: '便利店', color: '#f00' }],
        ['c', { name: 'A 公司', color: '#0f0' }],
      ]),
    });
    expect(items.map((i) => i.key)).toEqual([
      'event:trip',
      'shift:pending',
      'task:t',
      'event:meeting',
      'shift:late',
      'shift:night',
    ]);
    expect(items[2]).toMatchObject({
      title: '翻译',
      subtitle: 'A 公司',
      done: true,
      color: '#0f0',
    });
    expect(items[5].slot).toEqual({ start: '22:00', end: '06:00', overnight: true });
    expect(items[3].reminder).toBe(true);
  });

  it('ignores items on other dates', () => {
    expect(
      buildDayItems({
        date: '2026-09-24',
        today: '2026-09-24',
        shifts: [shift('a', '09:00', '10:00')],
        events: [],
        tasks: [],
        jobsById: new Map(),
      })
    ).toEqual([]);
  });
});
