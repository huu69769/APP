import { isStale, lastActivityByJob } from '../activity';

describe('isStale', () => {
  const today = '2026-09-30';

  it('is stale when the last record is more than 60 days ago', () => {
    expect(isStale({ createdAt: '2026-01-01T00:00:00', lastActivity: '2026-08-01', today })).toBe(
      false
    );
    expect(isStale({ createdAt: '2026-01-01T00:00:00', lastActivity: '2026-07-31', today })).toBe(
      true
    );
  });

  it('is not stale when there are future records', () => {
    expect(isStale({ createdAt: '2026-01-01T00:00:00', lastActivity: '2026-10-10', today })).toBe(
      false
    );
  });

  it('uses the creation date when there are no records', () => {
    expect(isStale({ createdAt: '2026-09-01T10:00:00', lastActivity: null, today })).toBe(false);
    expect(isStale({ createdAt: '2026-06-01T10:00:00', lastActivity: null, today })).toBe(true);
  });
});

describe('lastActivityByJob', () => {
  it('keeps the latest date per job', () => {
    const m = lastActivityByJob([
      { jobId: 'a', date: '2026-09-01' },
      { jobId: 'a', date: '2026-09-20' },
      { jobId: 'b', date: '2026-08-01' },
      { jobId: 'a', date: '2026-09-05' },
    ]);
    expect(m.get('a')).toBe('2026-09-20');
    expect(m.get('b')).toBe('2026-08-01');
  });
});
