// lunar-javascript 没有自带类型，这里只声明用到的部分
declare module 'lunar-javascript' {
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getYear(): number;
    /** 闰月是负数（比如闰六月 = -6） */
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getJieQi(): string;
    getFestivals(): string[];
    getSolar(): Solar;
  }
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    toYmd(): string;
  }
  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth;
    getDayCount(): number;
  }
}
