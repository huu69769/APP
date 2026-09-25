// lunar-javascript 没有自带类型，这里只声明用到的部分
declare module 'lunar-javascript' {
  export class Lunar {
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getJieQi(): string;
    getFestivals(): string[];
  }
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
  }
}
