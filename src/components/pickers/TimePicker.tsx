import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayjs, DATE_FORMAT, isValidLocalDate } from '@/lib/date';
import { isValidTime } from '@/lib/time';
import { colors } from '@/theme/colors';

/**
 * 手机上的时间 / 日期选择：点一下弹出系统的选择器（Android 是转盘 / 日历）。
 * 网页版见 TimePicker.web.tsx（浏览器自带的时间 / 日期输入框）。
 */
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

export function TimePicker(props: Props) {
  return <Picker mode="time" {...props} />;
}

export function DatePicker(props: Props) {
  return <Picker mode="date" {...props} />;
}

function Picker({
  mode,
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: Props & { mode: 'time' | 'date' }) {
  const [iosOpen, setIosOpen] = useState(false);
  const valid = mode === 'time' ? isValidTime(value) : isValidLocalDate(value);
  const current = valid
    ? mode === 'time'
      ? dayjs(`2000-01-01 ${value}`, 'YYYY-MM-DD HH:mm').toDate()
      : dayjs(value, DATE_FORMAT).toDate()
    : mode === 'time'
      ? dayjs().hour(9).minute(0).toDate()
      : new Date();

  const format = (d: Date) => dayjs(d).format(mode === 'time' ? 'HH:mm' : DATE_FORMAT);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode,
        value: current,
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(format(date));
        },
      });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.box,
          mode === 'time' ? styles.time : styles.date,
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.text, !valid && styles.placeholder]}>
          {valid ? value : placeholder}
        </Text>
      </Pressable>
      {iosOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)} />
          <View style={styles.sheet}>
            <DateTimePicker
              mode={mode}
              value={current}
              display="spinner"
              is24Hour
              onChange={(_, date) => date && onChange(format(date))}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  time: { width: 96 },
  date: { width: 140 },
  pressed: { opacity: 0.6 },
  text: { fontSize: 16, color: colors.text },
  placeholder: { color: colors.textFaint },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, paddingBottom: 32 },
});
