import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { makeStyles, useColors, JOB_COLORS } from '@/theme';

/** 表单页面：可滚动，点输入框外不会收起按钮点击 */
export function FormScreen({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Section({
  title,
  children,
  right,
}: {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      {(title || right) && (
        <View style={styles.sectionHeader}>
          {title ? <Text style={styles.sectionTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'normal',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** small：连在一起的小切换（首页的视图切换） */
  size?: 'normal' | 'small';
}) {
  const styles = useStyles();
  if (size === 'small') {
    return (
      <View style={styles.segmentedSmall}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={[styles.segmentSmall, active && styles.segmentSmallActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.segmentSmallText, active && styles.segmentTextActive]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 可以选多个的切换（比如星期几） */
export function MultiSelect<T extends string | number>({
  options,
  values,
  onChange,
}: {
  options: { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.multi}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() =>
              onChange(active ? values.filter((v) => v !== o.value) : [...values, o.value])
            }
            style={[styles.segment, styles.multiItem, active && styles.segmentActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.colors}>
      {JOB_COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === c }}
          accessibilityLabel={c}
        />
      ))}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && styles.buttonPressed,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'danger' && styles.buttonTextDanger,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** 列表中的一行，左侧可以有色条 */
export function ListRow({
  color,
  title,
  subtitle,
  right,
  onPress,
  selected,
}: {
  color?: string;
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  /** 传入时显示勾选框（选择模式） */
  selected?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {selected !== undefined && <CheckCircle checked={selected} />}
      {color && <View style={[styles.rowColor, { backgroundColor: color }]} />}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
    </Pressable>
  );
}

/** 选择模式里的圆形勾选框 */
export function CheckCircle({ checked }: { checked: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.check, checked && styles.checkOn]}>
      {checked && <Text style={styles.checkMark}>✓</Text>}
    </View>
  );
}

export function EmptyText({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.empty}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  screenContent: { padding: 16, gap: 16, paddingBottom: 48 },
  section: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.danger },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  multi: { flexDirection: 'row', gap: 6 },
  multiItem: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  segmentedSmall: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  segmentSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  segmentSmallActive: { backgroundColor: colors.primary },
  segmentSmallText: { fontSize: 13, color: colors.primary },
  segmentText: { color: colors.text, fontSize: 14 },
  segmentTextActive: { color: colors.onPrimary },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.danger },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextPrimary: { color: colors.onPrimary },
  buttonTextSecondary: { color: colors.primary },
  buttonTextDanger: { color: colors.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowPressed: { opacity: 0.6 },
  rowColor: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
  rowRight: { fontSize: 14, color: colors.text },
  empty: { color: colors.textMuted, fontSize: 14 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontSize: 13, fontWeight: '700', lineHeight: 15 },
}));
