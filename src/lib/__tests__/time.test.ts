import {
  formatHours,
  isValidTime,
  minutesToTime,
  normalizeTime,
  splitMinutes,
  timeToMinutes,
} from '../time';

describe('time helpers', () => {
  it('validates HH:mm', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
  });

  it('converts between HH:mm and minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(1440 + 60)).toBe('01:00');
  });

  it('normalizes loose input', () => {
    expect(normalizeTime('9:30')).toBe('09:30');
    expect(normalizeTime('0930')).toBe('09:30');
    expect(normalizeTime('9')).toBe('09:00');
    expect(normalizeTime('22')).toBe('22:00');
    expect(normalizeTime('25')).toBeNull();
    expect(normalizeTime('9:75')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });

  it('splits minutes', () => {
    expect(splitMinutes(390)).toEqual({ hours: 6, minutes: 30 });
  });
});

describe('formatHours', () => {
  it('shows at most one decimal', () => {
    expect(formatHours(0)).toBe('0');
    expect(formatHours(480)).toBe('8');
    expect(formatHours(750)).toBe('12.5');
    expect(formatHours(20)).toBe('0.3');
    expect(formatHours(59)).toBe('1');
  });
});
