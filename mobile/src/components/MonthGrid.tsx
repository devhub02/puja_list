import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatCalendarDateLong, formatWeekdayLong, formatWeekdayShort } from '@/i18n/format';
import type { LanguageCode } from '@/i18n/registry';
import { minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import type { DayInfo } from '@/utils/calendarLogic';
import { monthGrid, parseIso, weekdayOrder } from '@/utils/dateUtils';
import type { GridCell, WeekStart } from '@/utils/dateUtils';

import { AppText } from './AppText';

const MAX_DOTS = 3;

type CellProps = {
  cell: GridCell;
  info: DayInfo | undefined;
  isToday: boolean;
  isSelected: boolean;
  language: LanguageCode;
  onSelect: (iso: string) => void;
};

function DayCellBase({ cell, info, isToday, isSelected, language, onSelect }: CellProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const ymd = parseIso(cell.iso);
  const count = info?.count ?? 0;
  const dateText = ymd ? formatCalendarDateLong(ymd, language) : cell.iso;
  const label = [
    count > 0
      ? t('calendar.dayLabel', { date: dateText, count })
      : t('calendar.dayLabelNone', { date: dateText }),
    isToday ? t('calendar.todayMark') : null,
  ]
    .filter(Boolean)
    .join(', ');

  const marker = isSelected ? colors.onPrimary : colors.primary;
  const spansLeft = info?.ranges.some((r) => r.start < cell.iso) ?? false;
  const spansRight = info?.ranges.some((r) => r.end > cell.iso) ?? false;
  const dots = Math.min(info?.singles ?? 0, MAX_DOTS);

  return (
    <Pressable
      testID={`day-${cell.iso}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(cell.iso)}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: isSelected ? colors.primary : pressed ? colors.pressed : 'transparent',
          borderColor: isToday ? colors.primary : 'transparent',
        },
      ]}
    >
      <AppText
        variant="bodySmall"
        color={isSelected ? 'onPrimary' : 'text'}
        style={[styles.number, (isToday || isSelected) && styles.bold]}
        maxFontSizeMultiplier={1.3}
      >
        {cell.day}
      </AppText>
      <View style={styles.markers} importantForAccessibility="no-hide-descendants">
        {dots > 0
          ? Array.from({ length: dots }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: marker }]} />
            ))
          : null}
        {info && info.ranges.length > 0 ? (
          <View
            testID={`span-${cell.iso}`}
            style={[
              styles.bar,
              {
                backgroundColor: marker,
                marginLeft: spansLeft ? -2 : 0,
                marginRight: spansRight ? -2 : 0,
                borderTopLeftRadius: spansLeft ? 0 : radius.pill,
                borderBottomLeftRadius: spansLeft ? 0 : radius.pill,
                borderTopRightRadius: spansRight ? 0 : radius.pill,
                borderBottomRightRadius: spansRight ? 0 : radius.pill,
              },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const DayCell = memo(DayCellBase);

type Props = {
  year: number;
  month: number;
  language: LanguageCode;
  /** Device-local date, to mark "today". */
  today: string;
  selected: string | null;
  info: Map<string, DayInfo>;
  onSelect: (iso: string) => void;
  weekStart?: WeekStart;
};

/**
 * Month grid: a week per row, a dot for each single-day festival and a bar through the days of a multi-day
 * one. Days of neighbouring months are left blank (the bundle is queried per month, so showing them with
 * no markers would wrongly suggest "no festival"). Today has a ring, the selected day is filled.
 */
export function MonthGrid({
  year,
  month,
  language,
  today,
  selected,
  info,
  onSelect,
  weekStart = 0,
}: Props) {
  const { colors } = useTheme();
  const weeks = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const header = useMemo(
    () =>
      weekdayOrder(weekStart).map((weekday) => ({
        weekday,
        short: formatWeekdayShort(weekday, language),
        long: formatWeekdayLong(weekday, language),
      })),
    [weekStart, language],
  );

  return (
    <View testID="month-grid" style={styles.grid}>
      <View style={styles.row}>
        {header.map((h) => (
          <View key={h.weekday} style={styles.headCell} accessible accessibilityLabel={h.long}>
            <AppText variant="caption" color="textSecondary" maxFontSizeMultiplier={1.2}>
              {h.short}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]?.iso} style={styles.row}>
          {week.map((cell) =>
            cell.inMonth ? (
              <DayCell
                key={cell.iso}
                cell={cell}
                info={info.get(cell.iso)}
                isToday={cell.iso === today}
                isSelected={cell.iso === selected}
                language={language}
                onSelect={onSelect}
              />
            ) : (
              <View
                key={cell.iso}
                style={styles.cell}
                importantForAccessibility="no-hide-descendants"
              />
            ),
          )}
        </View>
      ))}
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 2 },
  row: { flexDirection: 'row' },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xxs },
  // 48dp tall; about 47dp wide at 360dp (seven columns inside the 16dp gutters).
  cell: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    gap: 2,
  },
  number: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  markers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 6,
    alignSelf: 'stretch',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bar: { flex: 1, height: 4 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: spacing.xxs },
});
