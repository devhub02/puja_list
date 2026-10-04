import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PujaSummary } from '@/db/types';
import { localize } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { secondaryName } from '@/utils/pujaDisplay';

import { AppText } from './AppText';
import { FavoriteButton } from './FavoriteButton';
import { PujaImage } from './PujaImage';
import { ReviewBadge } from './ReviewBadge';

type Props = {
  puja: PujaSummary;
  language: LanguageCode;
  saved: boolean;
  /** e.g. "Contains: Diya/lamp" when the puja matched a samagri search. */
  hint?: string;
  /** e.g. "Next: 8 Nov 2026 · Date confirmed"; only when the linked festival has a bundled upcoming date. */
  nextDate?: string;
  onOpen: (pujaId: string) => void;
  onToggleSaved: (pujaId: string) => void;
};

/**
 * Library row: artwork, name (+ the other language), category, review label, heart. Memoised and free of
 * per-render work so long lists stay smooth. The heart is a sibling of the row button, never nested in it.
 */
function PujaCardBase({ puja, language, saved, hint, nextDate, onOpen, onToggleSaved }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const name = localize(puja.name, language);
  const other = secondaryName(puja.name, language);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow(1),
      ]}
    >
      <Pressable
        testID={`puja-card-${puja.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.openPuja', { name })}
        onPress={() => onOpen(puja.id)}
        android_ripple={{ color: colors.pressed }}
        style={({ pressed }) => [styles.main, pressed && { backgroundColor: colors.pressed }]}
      >
        <PujaImage pujaId={puja.id} category={puja.category} style={styles.image} />
        <View style={styles.text}>
          <AppText variant="subheading" numberOfLines={2}>
            {name}
          </AppText>
          {other ? (
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {other}
            </AppText>
          ) : null}
          <AppText variant="caption" color="goldText" numberOfLines={1}>
            {t(`categories.${puja.category}`)}
          </AppText>
          {nextDate ? (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={2}
              testID={`next-date-${puja.id}`}
            >
              {nextDate}
            </AppText>
          ) : null}
          {hint ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {hint}
            </AppText>
          ) : null}
          {puja.reviewStatus !== 'expert_verified' ? (
            <ReviewBadge status={puja.reviewStatus} />
          ) : null}
        </View>
      </Pressable>
      <FavoriteButton pujaId={puja.id} name={name} saved={saved} onToggle={onToggleSaved} />
    </View>
  );
}

export const PujaCard = memo(PujaCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingRight: spacing.xxs,
  },
  main: { flex: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  image: { width: 88, height: 88, borderRadius: radius.md },
  text: { flex: 1, gap: spacing.xxs, justifyContent: 'center' },
});
