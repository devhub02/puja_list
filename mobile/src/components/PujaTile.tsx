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

type Props = {
  puja: PujaSummary;
  language: LanguageCode;
  saved: boolean;
  /** Prefix for test ids, so the same puja can appear in several Home rows. */
  section: string;
  onOpen: (pujaId: string) => void;
  onToggleSaved: (pujaId: string) => void;
};

export const TILE_WIDTH = 220;

/** Horizontal-row tile for Home (featured, saved, recent): wide artwork, name, heart. */
function PujaTileBase({ puja, language, saved, section, onOpen, onToggleSaved }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const name = localize(puja.name, language);
  const other = secondaryName(puja.name, language);
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow(1),
      ]}
    >
      <Pressable
        testID={`${section}-${puja.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.openPuja', { name })}
        onPress={() => onOpen(puja.id)}
        android_ripple={{ color: colors.pressed }}
        style={({ pressed }) => pressed && { backgroundColor: colors.pressed }}
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
        </View>
      </Pressable>
      <View style={styles.heart}>
        <FavoriteButton pujaId={puja.id} name={name} saved={saved} onToggle={onToggleSaved} />
      </View>
    </View>
  );
}

export const PujaTile = memo(PujaTileBase);

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 124 },
  text: {
    padding: spacing.sm,
    paddingRight: spacing.xxl + spacing.xs,
    gap: spacing.xxs,
    minHeight: 72,
  },
  heart: { position: 'absolute', right: spacing.xxs, bottom: spacing.xxs },
});
