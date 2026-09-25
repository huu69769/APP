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

/**
 * 夜间模式：参考 Material Design / Apple 的深色模式设计原则——
 * - 不用纯黑，用带一点蓝的深藏青色（纯黑配白字对比太刺眼，也显得「空」）
 * - 越靠前的层越亮：页面底色最深，卡片、日历稍亮，弹出层再亮一点（深色下阴影看不出层次）
 * - 文字不用纯白，用略灰的白；强调色调浅、降低饱和度，避免在深底上「发光刺眼」
 * - 按钮等浅色强调色上的文字用深色，保证对比度
 */
export const darkColors: Palette = {
  background: '#1E2939',
  surface: '#151D2A',
  border: '#304058',
  text: '#E3E9F2',
  textMuted: '#98A6BC',
  textFaint: '#56657D',
  primary: '#6AB0FF',
  onPrimary: '#0E1A2B',
  sunday: '#FF8F92',
  saturday: '#72B6FF',
  danger: '#FF8084',
  holidayCN: '#FF8F92',
  holidayJP: '#B9A2FF',
  holidayWork: '#A3B0C2',
  lunarSpecial: '#F4B46E',
  onColor: '#FFFFFF',
  selectedBg: '#2A4466',
  infoBg: '#243552',
  warningBg: '#3A3424',
  warningText: '#F3CF80',
  overlay: 'rgba(6,10,18,0.6)',
  toastBg: '#34435C',
  toastText: '#F0F4FA',
  toastAction: '#8FC6FF',
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
