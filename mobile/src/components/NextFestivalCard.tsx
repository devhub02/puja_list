import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CalendarDate, Festival } from '@/db/types';
import { localize } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCalendarEntry } from '@/utils/calendarDisplay';
import { certaintyLabelKey } from '@/utils/certainty';
import { countdownFor } from '@/utils/upcoming';

import { AppText } from './AppText';

type Props = {
  festival: Festival;
  date: CalendarDate;
  language: LanguageCode;
  /** Device-local date (YYYY-MM-DD). */
  today: string;
  onOpen: (festival: Festival) => void;
};

/**
 * The Home "Next festival" hero: name, date or range, a countdown pill and the certainty label. Deliberately
 * has no review-status badge (that stays on the detail screens and the lists). The whole card is one button.
 */
export function NextFestivalCard({ festival, date, language, today, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const name = localize(festival.name, language);
  const dateText = formatCalendarEntry(date, language, t);
  const certainty = t(certaintyLabelKey(date.certainty));
  const countdown = countdownFor(date.date, date.endDate, today);
  const countdownText = !countdown
    ? null
    : countdown.kind === 'today'
      ? t('home.countdownToday')
      : countdown.kind === 'ongoing'
        ? t('home.countdownOngoing')
        : t('home.countdownIn', { count: countdown.days });

  return (
    <Pressable
      testID="next-festival-card"
      accessibilityRole="button"
      accessibilityLabel={[t('home.nextFestivalA11y', { name }), dateText, countdownText, certainty]
        .filter(Boolean)
        .join('. ')}
      onPress={() => onOpen(festival)}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.pressed : colors.surface, borderColor: colors.gold },
        shadow(1),
      ]}
    >
      <View style={styles.body}>
        <View style={styles.top}>
          <AppText variant="label" color="goldText" style={styles.flex}>
            {t('home.nextFestival')}
          </AppText>
          {countdownText ? (
            <View
              testID="next-festival-countdown-pill"
              style={[
                styles.pill,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <AppText
                variant="bodySmall"
                color="primary"
                style={styles.pillText}
                testID="next-festival-countdown"
              >
                {countdownText}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="heading" numberOfLines={2} testID="next-festival-name">
          {name}
        </AppText>
        <AppText testID="next-festival-date">{dateText}</AppText>
        <AppText variant="bodySmall" color="textSecondary" testID="next-festival-certainty">
          {certainty}
        </AppText>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={iconSize.md}
        color={colors.textSecondary}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  body: { flex: 1, gap: spacing.xxs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: { fontWeight: '700' },
});
