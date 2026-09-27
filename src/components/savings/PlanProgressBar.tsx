import { View } from 'react-native';

import { makeStyles } from '@/theme';

/** 存钱计划的进度条（0–1） */
export function PlanProgressBar({ ratio, dim }: { ratio: number; dim?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          dim && styles.dim,
          { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dim: { backgroundColor: colors.textFaint },
}));
