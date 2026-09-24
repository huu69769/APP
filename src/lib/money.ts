import type { Currency, MinorUnits } from '@/data/types';

/** 每种币种的小数位数：JPY 0 位，CNY/USD 2 位 */
export const CURRENCY_DECIMALS: Record<Currency, number> = { CNY: 2, JPY: 0, USD: 2 };

/**
 * 用户输入的金额文字 → 最小单位整数。不经过浮点数计算。
 * "12.5" (CNY) → 1250；"1200" (JPY) → 1200；非法返回 null。
 */
export function parseMoney(input: string, currency: Currency): MinorUnits | null {
  const text = input.trim().replace(/,/g, '');
  const decimals = CURRENCY_DECIMALS[currency];
  const re = decimals > 0 ? new RegExp(`^(\\d+)(?:\\.(\\d{0,${decimals}}))?$`) : /^(\d+)$/;
  const m = re.exec(text);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = (m[2] ?? '').padEnd(decimals, '0');
  const value = whole * 10 ** decimals + (frac ? Number(frac) : 0);
  return Number.isSafeInteger(value) ? value : null;
}

/** 最小单位整数 → 输入框里显示的文字（不带符号、不带千分位） */
export function moneyToInput(amount: MinorUnits, currency: Currency): string {
  const decimals = CURRENCY_DECIMALS[currency];
  if (decimals === 0) return String(amount);
  const abs = Math.abs(amount);
  const s = `${Math.floor(abs / 10 ** decimals)}.${String(abs % 10 ** decimals).padStart(decimals, '0')}`;
  return amount < 0 ? `-${s}` : s;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 显示金额。JPY 显示整数，CNY/USD 显示两位小数。PRD 5.7
 * CNY: ¥1,234.50　JPY: 1,234円　USD: $1,234.50
 */
export function formatMoney(amount: MinorUnits, currency: Currency): string {
  const decimals = CURRENCY_DECIMALS[currency];
  const abs = Math.abs(amount);
  const whole = groupThousands(String(Math.floor(abs / 10 ** decimals)));
  const body =
    decimals > 0 ? `${whole}.${String(abs % 10 ** decimals).padStart(decimals, '0')}` : whole;
  const sign = amount < 0 ? '-' : '';
  switch (currency) {
    case 'CNY':
      return `${sign}¥${body}`;
    case 'JPY':
      return `${sign}${body}円`;
    case 'USD':
      return `${sign}$${body}`;
  }
}

const CURRENCY_ORDER: Currency[] = ['CNY', 'JPY', 'USD'];

/**
 * 多币种金额：不同币种不换算、不相加，按币种分别显示，比如「¥3,200.00 + $50.00」。
 * 没有任何金额时显示 fallback 币种的 0。
 */
export function formatMoneyMulti(
  money: Partial<Record<Currency, MinorUnits>>,
  fallback: Currency
): string {
  const parts = CURRENCY_ORDER.filter((c) => money[c] !== undefined).map((c) =>
    formatMoney(money[c]!, c)
  );
  return parts.length ? parts.join(' + ') : formatMoney(0, fallback);
}
