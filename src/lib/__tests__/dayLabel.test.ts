import { dayLabel } from '../dayLabel';

const lunar = { date: '八月十四', special: null, short: '十四' };

describe('dayLabel', () => {
  it('shows the holiday name and off badge', () => {
    const l = dayLabel([{ country: 'CN', date: '2026-10-01', name: '国庆节', off: true }], lunar);
    expect(l).toEqual({ badges: ['cnOff'], text: '国庆节', tone: 'CN', off: true, workday: false });
  });

  it('marks make-up work days with 班 and keeps the lunar text', () => {
    const l = dayLabel([{ country: 'CN', date: '2026-10-10', name: '国庆节', off: false }], lunar);
    expect(l).toEqual({
      badges: ['cnWork'],
      text: '十四',
      tone: 'lunar',
      off: false,
      workday: true,
    });
  });

  it('distinguishes countries when both are shown', () => {
    const l = dayLabel(
      [
        { country: 'CN', date: '2026-01-01', name: '元旦', off: true },
        { country: 'JP', date: '2026-01-01', name: '元日', off: true },
      ],
      null
    );
    expect(l.badges).toEqual(['cnOff', 'jpOff']);
    expect(l.text).toBe('元旦');
  });

  it('uses lunar festivals and plain lunar days', () => {
    expect(dayLabel([], { date: '八月十五', special: '中秋节', short: '中秋节' })).toMatchObject({
      text: '中秋节',
      tone: 'lunarSpecial',
    });
    expect(dayLabel([], null)).toEqual({
      badges: [],
      text: null,
      tone: null,
      off: false,
      workday: false,
    });
  });
});
