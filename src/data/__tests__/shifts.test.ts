import { ShiftValidationError } from '@/lib/shift';

import { createRepositories } from '../repository';
import { applyTemplateToDates, buildShift, sortShifts } from '../shifts';
import { MemoryDriver } from '../storage/memoryDriver';

function setup() {
  let n = 0;
  return createRepositories(new MemoryDriver(), { newId: () => `id-${++n}` });
}

const jobInput = {
  name: 'Cafe',
  color: '#E5484D',
  hourlyWage: 2500,
  currency: 'CNY' as const,
  cutoffDay: null,
  defaultBreakMinutes: 0,
};

describe('buildShift', () => {
  it('snapshots the wage and currency', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const shift = await repos.shifts.create(
      buildShift(job, { date: '2026-09-01', startTime: '09:00', endTime: '14:00', breakMinutes: 0 })
    );
    await repos.jobs.update(job.id, { hourlyWage: 3000, currency: 'USD' });
    const stored = await repos.shifts.get(shift.id);
    expect(stored).toMatchObject({ wageSnapshot: 2500, currencySnapshot: 'CNY' });
  });

  it('refuses a shift whose break is too long', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    expect(() =>
      buildShift(job, { date: '2026-09-01', startTime: '09:00', endTime: '10:00', breakMinutes: 60 })
    ).toThrow(ShiftValidationError);
  });
});

describe('applyTemplateToDates', () => {
  it('creates one shift per selected date from the template', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const template = await repos.shift_templates.create({
      jobId: job.id,
      name: '早班',
      startTime: '09:00',
      endTime: '14:00',
      breakMinutes: 15,
    });
    await applyTemplateToDates(repos, template, ['2026-09-03', '2026-09-01']);
    const shifts = sortShifts(await repos.shifts.list());
    expect(shifts.map((s) => s.date)).toEqual(['2026-09-01', '2026-09-03']);
    expect(shifts[0]).toMatchObject({
      jobId: job.id,
      startTime: '09:00',
      endTime: '14:00',
      breakMinutes: 15,
      wageSnapshot: 2500,
    });
  });
});

describe('repository change notifications', () => {
  it('calls onChange after writes', async () => {
    const changes: string[] = [];
    const repos = createRepositories(new MemoryDriver(), {
      newId: () => 'x',
      onChange: (t) => changes.push(t),
    });
    const job = await repos.jobs.create(jobInput);
    await repos.jobs.update(job.id, { name: 'B' });
    await repos.jobs.remove(job.id);
    expect(changes).toEqual(['jobs', 'jobs', 'jobs']);
    expect(await repos.jobs.list()).toHaveLength(0);
    expect(await repos.jobs.listWithDeleted()).toHaveLength(1);
  });
});
