import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { CURRENCIES, type Currency } from '@/data/types';
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money';
import type { MoneyByCurrency } from '@/lib/stats';
import { niceCeil, targetProgress, type IncomeTarget, type MonthBar } from '@/lib/target';
import { makeStyles, useColors } from '@/theme';

import { Button, Field, Input, Segmented } from './form';

type Wage = { completed: MoneyByCurrency; total: MoneyByCurrency };

/** 环形进度图：深色弧 = 已赚，浅色弧 = 已排班还没上 */
function Ring({ earned, expected, size }: { earned: number; expected: number; size: number }) {
  const colors = useColors();
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const len = 2 * Math.PI * r;
  const arc = (ratio: number, color: string) =>
    ratio > 0 ? (
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${len * ratio} ${len}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    ) : null;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={colors.surface} strokeWidth={stroke} fill="none" />
      {arc(expected, colors.selectedBg)}
      {arc(earned, colors.primary)}
    </Svg>
  );
}

/** 统计页：这个月的目标（环形图）。没设目标时显示「设置」和「沿用上个月」 */
export function MonthTargetCard({
  label,
  target,
  prevTarget,
  wage,
  onEdit,
  onCopyPrev,
}: {
  /** 「9月」或「本期」 */
  label: string;
  target: IncomeTarget | undefined;
  prevTarget: IncomeTarget | undefined;
  wage: Wage | undefined;
  onEdit: () => void;
  onCopyPrev: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (!target) {
    return (
      <View style={styles.card}>
        <Pressable onPress={onEdit} accessibilityRole="button">
          <Text style={styles.setText}>＋ {t('target.setMonth', { month: label })}</Text>
        </Pressable>
        {prevTarget && (
          <Pressable onPress={onCopyPrev} accessibilityRole="button">
            <Text style={styles.copyText}>
              {t('target.copyPrev', {
                amount: formatMoney(prevTarget.amount, prevTarget.currency),
              })}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
  const p = wage ? targetProgress(target, wage) : null;
  const money = (v: number) => formatMoney(v, target.currency);
  return (
    <Pressable onPress={onEdit} accessibilityRole="button" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('target.monthTitle', { month: label })}</Text>
        <Text style={styles.edit}>✏️</Text>
      </View>
      {p && (
        <View style={styles.ringRow}>
          <View style={styles.ringWrap}>
            <Ring earned={p.earnedRatio} expected={p.expectedRatio} size={150} />
            <View style={styles.ringCenter}>
              <Text style={styles.ringPercent}>{p.percent}%</Text>
              <Text style={styles.ringSub}>{money(p.earned)}</Text>
            </View>
          </View>
          <View style={styles.ringInfo}>
            <Info label={t('target.target')} value={money(target.amount)} />
            <Info label={t('target.earnedLabel')} value={money(p.earned)} swatch="earned" />
            <Info label={t('target.expectedLabel')} value={money(p.expected)} swatch="expected" />
            <Text style={styles.status}>
              {p.remaining === 0
                ? t('target.reached')
                : t('target.remaining', { amount: money(p.remaining) })}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Info({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: 'earned' | 'expected';
}) {
  const styles = useStyles();
  return (
    <View style={styles.info}>
      <View style={styles.infoLabelRow}>
        {swatch && (
          <View
            style={[styles.swatch, swatch === 'earned' ? styles.swEarned : styles.swExpected]}
          />
        )}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const CHART_HEIGHT = 150;
const TOP = 16;
const BOTTOM = 20;

/** 顶部圆角、底部直角的柱子 */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * 全年柱状图：每个月一根柱子（深色 = 已赚，浅色 = 已排班还没上），短横线 = 那个月的目标，
 * 达标的月份上面有 ✓。点一根柱子切换到那个月。
 */
export function YearTargetChart({
  bars,
  currency,
  selectedMonth,
  onSelectMonth,
}: {
  bars: MonthBar[];
  currency: Currency;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const max = niceCeil(Math.max(0, ...bars.map((b) => Math.max(b.expected, b.target ?? 0))));
  const plotH = CHART_HEIGHT - TOP - BOTTOM;
  const slot = width / 12;
  const barW = Math.min(20, slot * 0.6);
  const y = (v: number) => TOP + plotH - (v / max) * plotH;

  return (
    <View>
      <View style={styles.axisRow}>
        <Text style={styles.axisText}>{formatMoney(max, currency)}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line x1={0} x2={width} y1={TOP} y2={TOP} stroke={colors.border} strokeWidth={1} />
            <Line
              x1={0}
              x2={width}
              y1={TOP + plotH}
              y2={TOP + plotH}
              stroke={colors.border}
              strokeWidth={1}
            />
            {bars.map((b, i) => {
              const cx = slot * i + slot / 2;
              const x = cx - barW / 2;
              const selected = b.month === selectedMonth;
              return (
                <GLike key={b.month}>
                  {selected && (
                    <Rect
                      x={slot * i + 1}
                      y={TOP - 12}
                      width={slot - 2}
                      height={plotH + 12 + BOTTOM}
                      rx={6}
                      fill={colors.surface}
                    />
                  )}
                  {b.expected > 0 && (
                    <Path
                      d={barPath(x, y(b.expected), barW, (b.expected / max) * plotH)}
                      fill={colors.selectedBg}
                    />
                  )}
                  {b.earned > 0 && (
                    <Path
                      d={barPath(x, y(b.earned), barW, (b.earned / max) * plotH)}
                      fill={colors.primary}
                    />
                  )}
                  {b.target !== null && (
                    <Line
                      x1={x - 3}
                      x2={x + barW + 3}
                      y1={y(b.target)}
                      y2={y(b.target)}
                      stroke={colors.text}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  )}
                  {b.reached && (
                    <SvgText
                      x={cx}
                      y={Math.min(y(b.earned), y(b.target ?? 0)) - 4}
                      fontSize={10}
                      fill={colors.text}
                      textAnchor="middle">
                      ✓
                    </SvgText>
                  )}
                  <SvgText
                    x={cx}
                    y={CHART_HEIGHT - 5}
                    fontSize={10}
                    fill={selected ? colors.text : colors.textMuted}
                    fontWeight={selected ? 'bold' : 'normal'}
                    textAnchor="middle">
                    {String(i + 1)}
                  </SvgText>
                </GLike>
              );
            })}
          </Svg>
        )}
        {/* 点击区域比柱子大：每个月一整列 */}
        <View style={styles.hitRow} pointerEvents="box-none">
          {bars.map((b, i) => (
            <Pressable
              key={b.month}
              onPress={() => onSelectMonth(b.month)}
              accessibilityRole="button"
              accessibilityLabel={t('target.barA11y', {
                month: i + 1,
                earned: formatMoney(b.earned, currency),
                target: b.target === null ? '—' : formatMoney(b.target, currency),
              })}
              style={styles.hit}
            />
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        <Legend
          swatch={<View style={[styles.swatch, styles.swEarned]} />}
          label={t('target.earnedLabel')}
        />
        <Legend
          swatch={<View style={[styles.swatch, styles.swExpected]} />}
          label={t('target.expectedLabel')}
        />
        <Legend swatch={<View style={styles.swLine} />} label={t('target.target')} />
        <Legend swatch={<Text style={styles.check}>✓</Text>} label={t('target.reachedShort')} />
      </View>
    </View>
  );
}

/** react-native-svg 的 G 在这里只用来分组，用 Fragment 就够了 */
function GLike({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      {swatch}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/** 首页统计栏下面的细进度条（只有这个月设了目标才显示） */
export function TargetBar({
  target,
  wage,
  onPress,
}: {
  target: IncomeTarget;
  wage: Wage | undefined;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  if (!wage) return null;
  const p = targetProgress(target, wage);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('target.a11y', { percent: p.percent })}
      style={styles.bar}>
      <View style={styles.barTrack}>
        <View style={[styles.barExpected, { width: `${p.expectedRatio * 100}%` }]} />
        <View style={[styles.barEarned, { width: `${p.earnedRatio * 100}%` }]} />
      </View>
      <Text style={styles.barText}>{p.percent}%</Text>
    </Pressable>
  );
}

/** 设置某个月的目标：金额 + 币种；「不设目标」清除 */
export function TargetEditor({
  visible,
  title,
  value,
  defaultCurrency,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: IncomeTarget | undefined;
  defaultCurrency: Currency;
  onSave: (target: IncomeTarget | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [currency, setCurrency] = useState<Currency>(value?.currency ?? defaultCurrency);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrency(value?.currency ?? defaultCurrency);
    setText(value ? moneyToInput(value.amount, value.currency) : '');
    setError(false);
  }, [visible, value, defaultCurrency]);

  const save = () => {
    const amount = parseMoney(text, currency);
    if (amount === null || amount <= 0) {
      setError(true);
      return;
    }
    onSave({ amount, currency });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Field label={t('target.currency')}>
            <Segmented
              options={CURRENCIES.map((c) => ({ value: c, label: `${t(`currency.${c}`)} ${c}` }))}
              value={currency}
              onChange={setCurrency}
            />
          </Field>
          <Field label={t('target.amount')} error={error ? t('target.amountInvalid') : null}>
            <Input
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={currency === 'JPY' ? '50000' : '5000'}
            />
          </Field>
          <Text style={styles.hint}>{t('target.currencyHint')}</Text>
          <Button title={t('common.save')} onPress={save} />
          {value && (
            <Button
              variant="secondary"
              title={t('target.clear')}
              onPress={() => {
                onSave(null);
                onClose();
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  setText: { fontSize: 15, color: colors.primary },
  copyText: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  edit: { fontSize: 14 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPercent: { fontSize: 26, fontWeight: '700', color: colors.text },
  ringSub: { fontSize: 12, color: colors.textMuted },
  ringInfo: { flex: 1, gap: 8 },
  info: { gap: 1 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoLabel: { fontSize: 12, color: colors.textMuted },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  status: { fontSize: 13, color: colors.text },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  swEarned: { backgroundColor: colors.primary },
  swExpected: { backgroundColor: colors.selectedBg },
  swLine: { width: 12, height: 2, borderRadius: 1, backgroundColor: colors.text },
  check: { fontSize: 11, color: colors.text },
  axisRow: { flexDirection: 'row' },
  axisText: { fontSize: 10, color: colors.textMuted },
  hitRow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  hit: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barExpected: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.selectedBg,
  },
  barEarned: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  barText: { fontSize: 11, color: colors.textMuted, minWidth: 30, textAlign: 'right' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted },
}));
