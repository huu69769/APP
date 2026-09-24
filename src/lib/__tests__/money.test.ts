import { formatMoney, formatMoneyMulti, moneyToInput, parseMoney } from '../money';

describe('parseMoney', () => {
  it('parses CNY/USD into cents without floating point', () => {
    expect(parseMoney('12.5', 'CNY')).toBe(1250);
    expect(parseMoney('12.05', 'CNY')).toBe(1205);
    expect(parseMoney('0.1', 'USD')).toBe(10);
    expect(parseMoney('20', 'USD')).toBe(2000);
    expect(parseMoney('1,234.56', 'CNY')).toBe(123456);
    expect(parseMoney('12.', 'CNY')).toBe(1200);
  });

  it('parses JPY as whole yen', () => {
    expect(parseMoney('1200', 'JPY')).toBe(1200);
    expect(parseMoney('1200.5', 'JPY')).toBeNull();
  });

  it('rejects invalid input', () => {
    expect(parseMoney('', 'CNY')).toBeNull();
    expect(parseMoney('abc', 'CNY')).toBeNull();
    expect(parseMoney('1.234', 'CNY')).toBeNull();
    expect(parseMoney('-5', 'CNY')).toBeNull();
  });
});

describe('moneyToInput', () => {
  it('round-trips with parseMoney', () => {
    expect(moneyToInput(1205, 'CNY')).toBe('12.05');
    expect(moneyToInput(1200, 'JPY')).toBe('1200');
    for (const v of [0, 5, 99, 100, 123456]) {
      expect(parseMoney(moneyToInput(v, 'USD'), 'USD')).toBe(v);
    }
  });
});

describe('formatMoney', () => {
  it('shows two decimals for CNY/USD and whole numbers for JPY', () => {
    expect(formatMoney(320000, 'CNY')).toBe('¥3,200.00');
    expect(formatMoney(5000, 'USD')).toBe('$50.00');
    expect(formatMoney(1234567, 'JPY')).toBe('1,234,567円');
    expect(formatMoney(5, 'CNY')).toBe('¥0.05');
    expect(formatMoney(0, 'JPY')).toBe('0円');
    expect(formatMoney(-150, 'USD')).toBe('-$1.50');
  });
});

describe('formatMoneyMulti', () => {
  it('joins currencies without converting', () => {
    expect(formatMoneyMulti({ CNY: 320000, USD: 5000 }, 'CNY')).toBe('¥3,200.00 + $50.00');
    expect(formatMoneyMulti({ USD: 5000, JPY: 1200 }, 'CNY')).toBe('1,200円 + $50.00');
    expect(formatMoneyMulti({}, 'JPY')).toBe('0円');
  });
});
