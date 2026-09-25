/**
 * 全 app 的颜色都在这里（以后做「颜色套装」时，每一套就是这里的一组配色）。
 * 界面代码不要直接写色号，统一从这里取。兼职颜色（JOB_COLORS）是数据的一部分，不随套装改变。
 */
export const colors = {
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
} as const;

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
