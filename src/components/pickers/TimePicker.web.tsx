import { createElement } from 'react';

import { useColors, useIsDark } from '@/theme';

/**
 * 网页版：用浏览器自带的时间 / 日期输入框（点开会有选择器，也可以直接输入）。
 */
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

export function TimePicker(props: Props) {
  return <NativeInput type="time" width={132} {...props} />;
}

export function DatePicker(props: Props) {
  return <NativeInput type="date" width={170} {...props} />;
}

function NativeInput({
  type,
  width,
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: Props & { type: 'time' | 'date'; width: number }) {
  const colors = useColors();
  const dark = useIsDark();
  return createElement('input', {
    type,
    value,
    placeholder,
    'aria-label': accessibilityLabel ?? placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      width,
      boxSizing: 'border-box',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '9px 10px',
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      fontFamily: 'inherit',
      // 让浏览器自带的时钟、日历图标也跟着变成深色模式
      colorScheme: dark ? 'dark' : 'light',
    },
  });
}
