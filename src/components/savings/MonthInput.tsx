import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Input } from '@/components/form';
import { makeStyles } from '@/theme';

/** 年、月两个数字输入框：「[2028] 年 [1] 月」 */
export function MonthInput({
  year,
  month,
  onChangeYear,
  onChangeMonth,
  label,
}: {
  year: string;
  month: string;
  onChangeYear: (v: string) => void;
  onChangeMonth: (v: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const digits = (v: string) => v.replace(/\D/g, '');
  return (
    <View style={styles.row}>
      <Input
        value={year}
        onChangeText={(v) => onChangeYear(digits(v).slice(0, 4))}
        keyboardType="number-pad"
        accessibilityLabel={`${label} ${t('anniv.lunarYear')}`}
        style={styles.year}
      />
      <Text style={styles.unit}>{t('anniv.lunarYear')}</Text>
      <Input
        value={month}
        onChangeText={(v) => onChangeMonth(digits(v).slice(0, 2))}
        keyboardType="number-pad"
        accessibilityLabel={`${label} ${t('anniv.lunarMonth')}`}
        style={styles.month}
      />
      <Text style={styles.unit}>{t('anniv.lunarMonth')}</Text>
    </View>
  );
}

/** 输入框的年、月 → "YYYY-MM"；不合法返回 null */
export function toYearMonth(year: string, month: string): string | null {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  year: { width: 80, textAlign: 'center' },
  month: { width: 56, textAlign: 'center' },
  unit: { fontSize: 15, color: colors.text },
}));
