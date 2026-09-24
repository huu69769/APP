import {
  freeTime,
  isCompleted,
  occupiedMinutesByDay,
  periodStats,
  shiftEnd,
  sumMoney,
  yearIncome,
} from '../stats';

const shift = (
  date: string,
  startTime: string,
  endTime: string,
  extra: Partial<{ jobId: string; breakMinutes: number; wageSnapshot: number; currencySnapshot: 'CNY' | 'JPY' | 'USD' }> = {}
) => ({
  jobId: 'a',
  date,
  startTime,
  endTime,
  breakMinutes: 0,
  wageSnapshot: 1000,
  currencySnapshot: 'CNY' as const,
  ...extra,
});

describe('shiftEnd / isCompleted', () => {
  it('puts overnight shift end on the next day', () => {
    expect(shiftEnd(shift('2026-09-30', '22:00', '06:00'))).toBe('2026-10-01 06:00');
    expect(shiftEnd(shift('2026-09-30', '09:00', '14:00'))).toBe('2026-09-30 14:00');
  });

  it('treats a shift as completed only after it ends', () => {
    const s = shift('2026-09-24', '09:00', '14:00');
    expect(isCompleted(s, { date: '2026-09-24', time: '13:59' })).toBe(false);
    expect(isCompleted(s, { date: '2026-09-24', time: '14:00' })).toBe(false);
    expect(isCompleted(s, { date: '2026-09-24', time: '14:01' })).toBe(true);
    expect(isCompleted(s, { date: '2026-09-25', time: '00:00' })).toBe(true);
  });
});

describe('occupiedMinutesByDay', () => {
  it('includes the break in occupied time', () => {
    const m = occupiedMinutesByDay([shift('2026-09-01', '09:00', '18:00', { breakMinutes: 60 })]);
    expect(m.get('2026-09-01')).toBe(540);
  });

  it('merges overlapping shifts on the same day', () => {
    const m = occupiedMinutesByDay([
      shift('2026-09-01', '09:00', '14:00'),
      shift('2026-09-01', '13:00', '17:00', { jobId: 'b' }),
      shift('2026-09-01', '20:00', '21:00'),
    ]);
    expect(m.get('2026-09-01')).toBe(8 * 60 + 60);
  });

  it('moves the part after midnight to the next day', () => {
    const m = occupiedMinutesByDay([
      shift('2026-09-01', '22:00', '06:00'),
      shift('2026-09-02', '05:00', '08:00'),
    ]);
    expect(m.get('2026-09-01')).toBe(120);
    // 00:00–06:00 与 05:00–08:00 合并 → 8 小时
    expect(m.get('2026-09-02')).toBe(480);
  });

  it('handles a 24h shift', () => {
    const m = occupiedMinutesByDay([shift('2026-09-01', '08:00', '08:00')]);
    expect(m.get('2026-09-01')).toBe(960);
    expect(m.get('2026-09-02')).toBe(480);
  });
});

describe('freeTime', () => {
  it('counts days without shifts and free minutes', () => {
    const range = { from: '2026-09-01', to: '2026-09-03' };
    const result = freeTime(
      [
        shift('2026-08-31', '22:00', '02:00'), // 前一天的跨夜班占用 9/1 的 2 小时
        shift('2026-09-02', '09:00', '14:00'),
      ],
      range
    );
    // 9/1 没有班次（只有前一天的跨夜部分），9/3 没有班次
    expect(result.freeDays).toBe(2);
    expect(result.freeMinutes).toBe(3 * 1440 - 120 - 300);
  });
});

describe('periodStats', () => {
  const now = { date: '2026-09-15', time: '12:00' };

  it('sums hours, wages by currency and free time in a calendar month', () => {
    const shifts = [
      shift('2026-09-01', '09:00', '14:00', { wageSnapshot: 2500 }), // 5h ¥125
      shift('2026-09-20', '18:00', '22:00', { jobId: 'b', wageSnapshot: 1200, currencySnapshot: 'JPY', breakMinutes: 60 }), // 3h 3600円
      shift('2026-08-31', '09:00', '10:00'), // 不在本月
    ];
    const jobs = [
      { id: 'a', cutoffDay: null },
      { id: 'b', cutoffDay: null },
    ];
    const s = periodStats({ shifts, jobs, activeJobs: jobs, mode: 'calendarMonth', month: '2026-09', now });
    expect(s.totalMinutes).toBe(8 * 60);
    expect(s.wage.total).toEqual({ CNY: 12500, JPY: 3600 });
    expect(s.wage.completed).toEqual({ CNY: 12500 });
    expect(s.wage.expected).toEqual({ JPY: 3600 });
    expect(s.freeDays).toBe(28);
    expect(s.freeMinutes).toBe(30 * 1440 - 300 - 240);
    expect(s.jobs.find((j) => j.jobId === 'a')).toMatchObject({ minutes: 300, days: 1 });
    expect(s.jobs.find((j) => j.jobId === 'b')).toMatchObject({ minutes: 180, days: 1 });
  });

  it('uses each job’s own cutoff in pay period mode', () => {
    const shifts = [
      shift('2026-08-28', '09:00', '10:00'), // a（25 日截止）的 9 月期
      shift('2026-09-27', '09:00', '10:00'), // a 的 10 月期
      shift('2026-08-28', '09:00', '10:00', { jobId: 'b' }), // b（月末）的 8 月期
      shift('2026-09-27', '09:00', '10:00', { jobId: 'b' }), // b 的 9 月期
    ];
    const jobs = [
      { id: 'a', cutoffDay: 25 },
      { id: 'b', cutoffDay: null },
    ];
    const s = periodStats({ shifts, jobs, activeJobs: jobs, mode: 'payPeriod', month: '2026-09', now });
    expect(s.jobs.find((j) => j.jobId === 'a')).toMatchObject({
      range: { from: '2026-08-26', to: '2026-09-25' },
      minutes: 60,
    });
    expect(s.jobs.find((j) => j.jobId === 'b')).toMatchObject({
      range: { from: '2026-09-01', to: '2026-09-30' },
      minutes: 60,
    });
    expect(s.totalMinutes).toBe(120);
    // 截止日不同 → 空闲时间用自然月
    expect(s.freeRange).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('uses the shared pay period for free time when all cutoffs match', () => {
    const jobs = [{ id: 'a', cutoffDay: 25 }];
    const s = periodStats({ shifts: [], jobs, activeJobs: jobs, mode: 'payPeriod', month: '2026-09', now });
    expect(s.freeRange).toEqual({ from: '2026-08-26', to: '2026-09-25' });
    expect(s.freeDays).toBe(31);
  });

  it('still counts shifts of deleted jobs', () => {
    const s = periodStats({
      shifts: [shift('2026-09-02', '09:00', '10:00', { jobId: 'gone' })],
      jobs: [{ id: 'gone', cutoffDay: null }],
      activeJobs: [],
      mode: 'calendarMonth',
      month: '2026-09',
      now,
    });
    expect(s.totalMinutes).toBe(60);
    expect(s.jobs.map((j) => j.jobId)).toEqual(['gone']);
  });
});

describe('yearIncome', () => {
  it('groups income into months per currency', () => {
    const shifts = [
      shift('2026-01-10', '09:00', '10:00', { wageSnapshot: 1000 }),
      shift('2026-01-20', '09:00', '11:00', { wageSnapshot: 1000 }),
      shift('2026-03-05', '09:00', '10:00', { wageSnapshot: 1500, currencySnapshot: 'USD' }),
      shift('2025-12-31', '09:00', '10:00'), // 去年
    ];
    const r = yearIncome({ shifts, jobs: [{ id: 'a', cutoffDay: null }], mode: 'calendarMonth', year: 2026 });
    expect(r.months[0].wage).toEqual({ CNY: 3000 });
    expect(r.months[2].wage).toEqual({ USD: 1500 });
    expect(r.months[1].wage).toEqual({});
    expect(r.total).toEqual({ CNY: 3000, USD: 1500 });
  });

  it('assigns shifts to the pay period month across year boundaries', () => {
    const shifts = [
      shift('2025-12-28', '09:00', '10:00'), // 2026 年 1 月期（12/26–1/25）
      shift('2026-12-28', '09:00', '10:00'), // 2027 年 1 月期，不计入 2026
      shift('2026-02-26', '09:00', '10:00'), // 3 月期
    ];
    const r = yearIncome({ shifts, jobs: [{ id: 'a', cutoffDay: 25 }], mode: 'payPeriod', year: 2026 });
    expect(r.months[0].wage).toEqual({ CNY: 1000 });
    expect(r.months[2].wage).toEqual({ CNY: 1000 });
    expect(r.total).toEqual({ CNY: 2000 });
  });
});

describe('sumMoney', () => {
  it('adds per currency without converting', () => {
    expect(sumMoney({ CNY: 100 }, { CNY: 50, USD: 5 }, {})).toEqual({ CNY: 150, USD: 5 });
  });
});

describe('pending shifts in stats', () => {
  const pending = (date: string, jobId = 'a') => ({
    jobId,
    date,
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    wageSnapshot: 1000,
    currencySnapshot: 'CNY' as const,
  });

  it('are excluded from hours and wages but make the day not free', () => {
    const jobs = [{ id: 'a', cutoffDay: null }];
    const s = periodStats({
      shifts: [shift('2026-09-01', '09:00', '10:00'), pending('2026-09-02'), pending('2026-09-03')],
      jobs,
      activeJobs: jobs,
      mode: 'calendarMonth',
      month: '2026-09',
      now: { date: '2026-09-30', time: '23:00' },
    });
    expect(s.totalMinutes).toBe(60);
    expect(s.wage.total).toEqual({ CNY: 1000 });
    expect(s.pending).toBe(2);
    expect(s.jobs[0]).toMatchObject({ minutes: 60, days: 3, pending: 2 });
    expect(s.freeDays).toBe(27);
    // 空闲时间只扣已定时间的 1 小时
    expect(s.freeMinutes).toBe(30 * 1440 - 60);
  });

  it('are ignored by yearly income and occupied time', () => {
    const r = yearIncome({
      shifts: [pending('2026-01-05')],
      jobs: [{ id: 'a', cutoffDay: null }],
      mode: 'calendarMonth',
      year: 2026,
    });
    expect(r.total).toEqual({});
    expect(occupiedMinutesByDay([pending('2026-01-05')]).size).toBe(0);
  });
});
