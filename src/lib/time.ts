import type { TimeOfDay } from '@/data/types';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const MINUTES_PER_DAY = 24 * 60;

/** "HH:mm" 是否合法（00:00–23:59） */
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** "HH:mm" → 从 0 点开始的分钟数 */
export function timeToMinutes(value: TimeOfDay): number {
  const m = TIME_RE.exec(value);
  if (!m) throw new Error(`Invalid time: ${value}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 分钟数 → "HH:mm"（超过 24 小时会取余） */
export function minutesToTime(minutes: number): TimeOfDay {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * 输入框里用的自动格式化：只保留数字，并在第 2 位后插入冒号。
 * "930" → "9:30" 不自动补零；"0930" → "09:30"。
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

/** 把用户输入的 "9:30"、"930"、"0930" 规范成 "09:30"；无法识别返回 null */
export function normalizeTime(raw: string): TimeOfDay | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 4) {
    if (/^\d{1,2}$/.test(raw.trim())) {
      const h = Number(raw.trim());
      return h <= 23 ? `${String(h).padStart(2, '0')}:00` : null;
    }
    return null;
  }
  const value = `${digits.slice(0, -2).padStart(2, '0')}:${digits.slice(-2)}`;
  return isValidTime(value) ? value : null;
}

/** 分钟数拆成小时和分钟，用于显示 */
export function splitMinutes(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** 分钟数 → 小时数文字，最多一位小数："12.5"、"8"、"0.3" */
export function formatHours(minutes: number): string {
  const tenths = Math.round((minutes / 60) * 10);
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

/** "2.5" 小时 → 150 分钟；空字符串 → null；非法 → undefined */
export function parseHoursInput(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 60);
}
