// 更新 app 里预先打包的节假日数据（第一次打开、没有网络时的保底）。
// 用法：node scripts/update-holidays.mjs
// 数据来源：
//   中国：https://github.com/NateScarlet/holiday-cn
//   日本：https://github.com/holiday-jp/holiday_jp
import { writeFileSync } from 'node:fs';

const FIRST_YEAR = 2020;
const thisYear = new Date().getFullYear();

const cn = {};
for (let y = FIRST_YEAR; y <= thisYear + 1; y++) {
  const res = await fetch(`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${y}.json`);
  if (!res.ok) continue;
  const json = await res.json();
  const days = (json.days ?? []).map((d) => ({ date: d.date, name: d.name, off: d.isOffDay }));
  if (days.length) cn[y] = days;
}

const yml = await (
  await fetch('https://raw.githubusercontent.com/holiday-jp/holiday_jp/master/holidays.yml')
).text();
const jp = {};
for (const line of yml.split(/\r?\n/)) {
  const m = /^(\d{4})-(\d{2})-(\d{2}):\s*(.+?)\s*$/.exec(line);
  if (!m || Number(m[1]) < FIRST_YEAR) continue;
  (jp[m[1]] ??= []).push({ date: `${m[1]}-${m[2]}-${m[3]}`, name: m[4], off: true });
}

const dir = new URL('../src/holidays/bundled/', import.meta.url);
writeFileSync(new URL('cn.json', dir), JSON.stringify(cn) + '\n');
writeFileSync(new URL('jp.json', dir), JSON.stringify(jp) + '\n');
console.log('CN years:', Object.keys(cn).join(', '));
console.log('JP years:', Object.keys(jp)[0], '…', Object.keys(jp).at(-1));
