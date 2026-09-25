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
