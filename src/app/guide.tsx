import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FormScreen } from '@/components/form';
import { makeStyles, useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** 使用指南：每个功能一行标题 + 一行操作路径，不写长说明 */
const STEPS: { key: string; icon: IconName }[] = [
  { key: 'job', icon: 'briefcase-outline' },
  { key: 'shift', icon: 'add-circle-outline' },
  { key: 'recurring', icon: 'repeat-outline' },
  { key: 'batch', icon: 'checkbox-outline' },
  { key: 'week', icon: 'calendar-outline' },
  { key: 'income', icon: 'stats-chart-outline' },
  { key: 'savings', icon: 'wallet-outline' },
  { key: 'anniversary', icon: 'gift-outline' },
  { key: 'backup', icon: 'cloud-download-outline' },
];

export default function GuideScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  return (
    <FormScreen>
      <Stack.Screen options={{ title: t('guide.title') }} />
      {STEPS.map(({ key, icon }, i) => (
        <View key={key} style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              {i + 1}. {t(`guide.${key}.title`)}
            </Text>
            <Text style={styles.how}>{t(`guide.${key}.how`)}</Text>
          </View>
        </View>
      ))}
    </FormScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  how: { fontSize: 13, color: colors.textMuted },
}));
