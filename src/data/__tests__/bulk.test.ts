import { deleteItems } from '../bulk';
import { createRepositories } from '../repository';
import {
  applyPendingToDates,
  applyTemplateToDates,
  buildShift,
  createShiftUnlessDuplicate,
  isDuplicateShift,
} from '../shifts';
import { MemoryDriver } from '../storage/memoryDriver';

function setup() {
  let n = 0;
  return createRepositories(new MemoryDriver(), { newId: () => `id-${++n}` });
}

const jobInput = {
  name: 'Cafe',
  color: '#f00',
  hourlyWage: 1000,
  currency: 'JPY' as const,
  cutoffDay: null,
  defaultBreakMinutes: 0,
};

describe('duplicate prevention', () => {
  it('detects the same job, date and times', () => {
    const existing = [{ jobId: 'a', date: '2026-09-23', startTime: '13:00', endTime: '15:00' }];
    expect(isDuplicateShift(existing, existing[0])).toBe(true);
    expect(isDuplicateShift(existing, { ...existing[0], endTime: '16:00' })).toBe(false);
    expect(isDuplicateShift(existing, { ...existing[0], jobId: 'b' })).toBe(false);
    expect(isDuplicateShift(existing, { ...existing[0], date: '2026-09-24' })).toBe(false);
  });

  it('does not add the same shift twice', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const shift = buildShift(job, {
      date: '2026-09-23',
      startTime: '13:00',
      endTime: '15:00',
      breakMinutes: 0,
    });
    expect(await createShiftUnlessDuplicate(repos, shift)).not.toBeNull();
    expect(await createShiftUnlessDuplicate(repos, shift)).toBeNull();
    expect(await repos.shifts.list()).toHaveLength(1);
  });

  it('allows adding again after the shift was deleted', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const shift = buildShift(job, {
      date: '2026-09-23',
      startTime: '13:00',
      endTime: '15:00',
      breakMinutes: 0,
    });
    const created = await createShiftUnlessDuplicate(repos, shift);
    await repos.shifts.remove(created!.id);
    expect(await createShiftUnlessDuplicate(repos, shift)).not.toBeNull();
  });

  it('skips dates that already have the shift when batch scheduling', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const tpl = await repos.shift_templates.create({
      jobId: job.id,
      name: '午後',
      startTime: '13:00',
      endTime: '15:00',
      breakMinutes: 0,
    });
    await applyTemplateToDates(repos, tpl, ['2026-09-23']);
    const r = await applyTemplateToDates(repos, tpl, ['2026-09-23', '2026-09-24']);
    expect(r.created.map((s) => s.date)).toEqual(['2026-09-24']);
    expect(r.skipped).toEqual(['2026-09-23']);

    const p1 = await applyPendingToDates(repos, job, ['2026-09-25']);
    const p2 = await applyPendingToDates(repos, job, ['2026-09-25']);
    expect(p1.created).toHaveLength(1);
    expect(p2.skipped).toEqual(['2026-09-25']);
  });
});

describe('deleteItems', () => {
  it('deletes several items and can undo', async () => {
    const repos = setup();
    const job = await repos.jobs.create(jobInput);
    const a = await repos.shifts.create(
      buildShift(job, { date: '2026-09-23', startTime: '13:00', endTime: '15:00', breakMinutes: 0 })
    );
    const e = await repos.events.create({
      date: '2026-09-23',
      title: '面接',
      allDay: true,
      startTime: null,
      endTime: null,
      color: '#000',
      note: '',
      reminderMinutesBefore: null,
    });
    const undo = await deleteItems(repos, [
      { kind: 'shift', id: a.id },
      { kind: 'event', id: e.id },
    ]);
    expect(await repos.shifts.list()).toHaveLength(0);
    expect(await repos.events.list()).toHaveLength(0);
    await undo();
    expect(await repos.shifts.list()).toHaveLength(1);
    expect((await repos.events.list())[0].deletedAt).toBeNull();
  });
});
