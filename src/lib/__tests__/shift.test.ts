import {
  isOvernight,
  shiftWage,
  ShiftValidationError,
  spanMinutes,
  validateShift,
  workedMinutes,
} from '../shift';

describe('spanMinutes', () => {
  it('computes same-day spans', () => {
    expect(spanMinutes('09:00', '14:00')).toBe(300);
    expect(spanMinutes('09:15', '09:45')).toBe(30);
  });

  it('crosses midnight when end <= start (overnight shift)', () => {
    expect(spanMinutes('22:00', '06:00')).toBe(480);
    expect(spanMinutes('23:30', '00:15')).toBe(45);
    expect(isOvernight('22:00', '06:00')).toBe(true);
    expect(isOvernight('09:00', '17:00')).toBe(false);
  });

  it('treats equal start and end as 24 hours', () => {
    expect(spanMinutes('08:00', '08:00')).toBe(1440);
    expect(isOvernight('08:00', '08:00')).toBe(true);
  });
});

describe('workedMinutes', () => {
  it('subtracts the break', () => {
    expect(workedMinutes({ startTime: '09:00', endTime: '18:00', breakMinutes: 60 })).toBe(480);
  });

  it('subtracts the break on overnight shifts', () => {
    expect(workedMinutes({ startTime: '22:00', endTime: '05:00', breakMinutes: 30 })).toBe(390);
  });

  it('rejects a break that is as long as the shift', () => {
    expect(() => workedMinutes({ startTime: '09:00', endTime: '10:00', breakMinutes: 60 })).toThrow(
      ShiftValidationError
    );
    expect(validateShift({ startTime: '09:00', endTime: '10:00', breakMinutes: 90 })).toBe(
      'breakTooLong'
    );
  });

  it('rejects negative or fractional breaks and bad times', () => {
    expect(validateShift({ startTime: '09:00', endTime: '10:00', breakMinutes: -5 })).toBe(
      'invalidBreak'
    );
    expect(validateShift({ startTime: '09:00', endTime: '10:00', breakMinutes: 1.5 })).toBe(
      'invalidBreak'
    );
    expect(validateShift({ startTime: '9:00', endTime: '10:00', breakMinutes: 0 })).toBe(
      'invalidTime'
    );
    expect(validateShift({ startTime: '09:00', endTime: '24:00', breakMinutes: 0 })).toBe(
      'invalidTime'
    );
  });

  it('accepts a valid shift', () => {
    expect(validateShift({ startTime: '09:00', endTime: '14:00', breakMinutes: 0 })).toBeNull();
  });
});

describe('shiftWage', () => {
  it('multiplies worked hours by the wage snapshot in minor units', () => {
    // 5 小时 × 25.00 元 = 125.00 元
    expect(
      shiftWage({ startTime: '09:00', endTime: '14:00', breakMinutes: 0, wageSnapshot: 2500 })
    ).toBe(12500);
  });

  it('does not pay for the break', () => {
    // 8 小时 × 1200 円
    expect(
      shiftWage({ startTime: '09:00', endTime: '18:00', breakMinutes: 60, wageSnapshot: 1200 })
    ).toBe(9600);
  });

  it('rounds partial minutes to the nearest minor unit', () => {
    // 50 分钟 × 1111 円/小时 = 925.83… → 926
    expect(
      shiftWage({ startTime: '09:00', endTime: '09:50', breakMinutes: 0, wageSnapshot: 1111 })
    ).toBe(926);
  });

  it('pays overnight shifts for the full span', () => {
    expect(
      shiftWage({ startTime: '22:00', endTime: '06:00', breakMinutes: 60, wageSnapshot: 1500 })
    ).toBe(10500);
  });
});
