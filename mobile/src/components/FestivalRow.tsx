import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CalendarDate, Festival } from '@/db/types';
import { localize } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { festivalRegionsText, formatCalendarEntry, isOngoing } from '@/utils/calendarDisplay';
import { certaintyLabelKey } from '@/utils/certainty';

import { AppText } from './AppText';
import { ReviewBadge } from './ReviewBadge';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const certaintyIcons: Record<string, IconName> = {
  'calendar.certainty.confirmed': 'check-circle-outline',
  'calendar.certainty.provisional': 'help-circle-outline',
  'calendar.certainty.varies_by_region': 'map-marker-multiple-outline',
  'calendar.certainty.unknown': 'information-outline',
};

type Props = {
  festival: Festival;
  /** Absent = no bundled date: the row says "Date not available" (never a guess). */
  date?: CalendarDate;
  language: LanguageCode;
  /** Device-local date; only used to mark a multi-day festival that is on now. */
  today?: string;
  onOpen: (festival: Festival) => void;
  testID?: string;
};

/**
 * One festival in the calendar: name, date or range, a visible certainty label, the review status
 * and the regions from the catalog. The whole card is one 48dp+ button. Memoised for long lists.
 */
function FestivalRowBase({ festival, date, language, today, onOpen, testID }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const rowId = testID ?? `festival-row-${festival.id}`;
  const name = localize(festival.name, language);
  const dateText = date ? formatCalendarEntry(date, language, t) : t('calendar.dateNotAvailable');
  const certaintyKey = date ? certaintyLabelKey(date.certainty) : null;
  const certainty = certaintyKey ? t(certaintyKey) : null;
  const ongoing = date && today ? isOngoing(date, today) : false;
  const regions = festivalRegionsText(festival.regions, t);
  const label = [name, dateText, certainty, ongoing ? t('calendar.ongoing') : null]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      testID={rowId}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('calendar.openFestival', { name })}
      onPress={() => onOpen(festival)}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.pressed : colors.surface, borderColor: colors.border },
        shadow(1),
      ]}
    >
      <View style={styles.body}>
        <AppText variant="subheading" numberOfLines={2}>
          {name}
        </AppText>
        <View style={styles.line}>
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={iconSize.sm}
            color={colors.primary}
            importantForAccessibility="no"
          />
          <AppText
            style={styles.flex}
            color={date ? 'text' : 'textSecondary'}
            testID={`${rowId}-date`}
          >
            {dateText}
          </AppText>
          {ongoing ? (
            <AppText variant="label" color="goldText">
              {t('calendar.ongoing')}
            </AppText>
          ) : null}
        </View>
        {certainty && certaintyKey ? (
          <View style={styles.line}>
            <MaterialCommunityIcons
              name={certaintyIcons[certaintyKey] ?? 'information-outline'}
              size={iconSize.sm}
              color={colors.textSecondary}
              importantForAccessibility="no"
            />
            <AppText
              variant="bodySmall"
              color="textSecondary"
              style={styles.flex}
              testID={`${rowId}-certainty`}
            >
              {certainty}
            </AppText>
          </View>
        ) : null}
        <AppText variant="caption" color="textSecondary">
          {t('calendar.observedIn', { regions })}
        </AppText>
        {festival.reviewStatus !== 'expert_verified' ? (
          <ReviewBadge status={festival.reviewStatus} />
        ) : null}
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

export const FestivalRow = memo(FestivalRowBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing.xxs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
