/**
 * 全 app 的颜色都在这里。每一套配色（浅色、深色，以后的「颜色套装」）是一组同样键名的颜色。
 * 界面代码不要直接写色号：样式用 makeStyles((colors) => ...)，组件里用 useColors()（见 theme/index.ts）。
 * 兼职颜色（JOB_COLORS）是数据的一部分，不随配色改变。
 */
export const lightColors = {
  background: '#FFFFFF',
  surface: '#F5F7FA',
  border: '#E3E7ED',
  text: '#1F2328',
  textMuted: '#8A919C',
  textFaint: '#C3C8D0',
  primary: '#208AEF',
  onPrimary: '#FFFFFF',
  sunday: '#E5484D',
  saturday: '#208AEF',
  danger: '#E5484D',
  /** 节假日：中国（红）、日本（紫）、调休上班（灰）、农历节日 / 节气（橙） */
  holidayCN: '#E5484D',
  holidayJP: '#7C5CD6',
  holidayWork: '#6B7280',
  lunarSpecial: '#C2620C',
  /** 彩色色块、小标上的文字 */
  onColor: '#FFFFFF',
  /** 批量排班选中的日期背景 */
  selectedBg: '#DCEBFD',
  /** 提示卡片（首页引导） */
  infoBg: '#EAF3FE',
  /** 提醒卡片（该备份了、很久没用了） */
  warningBg: '#FFF4E5',
  warningText: '#8A5A00',
  /** 底部弹出菜单后面的半透明遮罩 */
  overlay: 'rgba(0,0,0,0.3)',
  /** 底部的短暂提示（Toast） */
  toastBg: '#2B2F36',
  toastText: '#FFFFFF',
  toastAction: '#7CC0FF',
  shadow: '#000000',
};

export type Palette = { [K in keyof typeof lightColors]: string };

/** 夜间模式 */
export const darkColors: Palette = {
  background: '#15171B',
  surface: '#1E2126',
  border: '#2E333A',
  text: '#E6E8EB',
  textMuted: '#9AA1AB',
  textFaint: '#50565F',
  primary: '#3B9BFF',
  onPrimary: '#FFFFFF',
  sunday: '#FF6B6F',
  saturday: '#4DA3FF',
  danger: '#FF6B6F',
  holidayCN: '#FF6B6F',
  holidayJP: '#A78BFA',
  holidayWork: '#9CA3AF',
  lunarSpecial: '#F0A050',
  onColor: '#FFFFFF',
  selectedBg: '#1C3656',
  infoBg: '#1A2A3F',
  warningBg: '#3A2E14',
  warningText: '#F2C46B',
  overlay: 'rgba(0,0,0,0.6)',
  toastBg: '#2F343B',
  toastText: '#FFFFFF',
  toastAction: '#7CC0FF',
  shadow: '#000000',
};

/** 兼职可选的颜色 */
export const JOB_COLORS = [
  '#E5484D',
  '#F76B15',
  '#FFB224',
  '#30A46C',
  '#12A594',
  '#208AEF',
  '#3E63DD',
  '#8E4EC6',
  '#D6409F',
  '#8D8D86',
] as const;
