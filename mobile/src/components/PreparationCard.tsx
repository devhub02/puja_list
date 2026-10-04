import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PreparationSummary } from '@/db/repositories';
import { formatShortDate } from '@/i18n/format';
import type { LanguageCode } from '@/i18n/registry';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';

type Props = {
  summary: PreparationSummary;
  /** Null when the puja no longer exists in the content. */
  pujaName: string | null;
  language: LanguageCode;
  onOpenChecklist: (id: string) => void;
  onOpenVidhi: (id: string) => void;
  onMore: (id: string) => void;
  onRemind: (id: string) => void;
};

/** One of the user's checklists: puja, label, progress (required first), vidhi position, actions. */
function PreparationCardBase({
  summary,
  pujaName,
  language,
  onOpenChecklist,
  onOpenVidhi,
  onMore,
  onRemind,
}: Props) {
  const { t } = useTranslation();
  const { progress, vidhi } = summary;
  const name = pujaName ?? t('preparation.pujaUnavailable');
  const label = summary.title ? `${name}, ${summary.title}` : name;
  const available = pujaName !== null;
  const hasItems = progress.overall.total > 0;
  return (
    <Card testID={`prep-card-${summary.id}`} style={styles.card}>
      <View style={styles.head}>
        <AppText variant="subheading" numberOfLines={2} testID={`prep-name-${summary.id}`}>
          {name}
        </AppText>
        {summary.title ? (
          <AppText variant="bodySmall" color="goldText" testID={`prep-title-${summary.id}`}>
            {summary.title}
          </AppText>
        ) : null}
      </View>

      {available ? (
        hasItems ? (
          <View style={styles.progress}>
            <ProgressBar
              value={progress.overall.checked / progress.overall.total}
              label={t('preparation.progressLabel', { name: label })}
              valueText={t('preparation.overallShort', progress.overall)}
            />
            <AppText variant="subheading" testID={`prep-required-${summary.id}`}>
              {progress.required.total > 0
                ? t('preparation.requiredShort', progress.required)
                : t('preparation.overallShort', progress.overall)}
            </AppText>
            {progress.required.total > 0 ? (
              <AppText variant="bodySmall" color="textSecondary">
                {t('preparation.overallShort', progress.overall)}
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="bodySmall" color="textSecondary">
            {t('preparation.noItems')}
          </AppText>
        )
      ) : null}

      {vidhi ? (
        <AppText variant="bodySmall" color="textSecondary" testID={`prep-vidhi-${summary.id}`}>
          {vidhi.completedAt !== null
            ? t('preparation.vidhiDone')
            : t('preparation.vidhiAt', { n: vidhi.lastStepNumber })}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {t('preparation.lastOpened', { date: formatShortDate(summary.lastOpenedAt, language) })}
      </AppText>

      <View style={styles.actions}>
        {available ? (
          <>
            <View style={styles.cell}>
              <Button
                testID={`prep-open-${summary.id}`}
                variant="outline"
                icon="basket-outline"
                label={t('preparation.openChecklist')}
                accessibilityLabel={`${t('preparation.openChecklist')}: ${label}`}
                onPress={() => onOpenChecklist(summary.id)}
              />
            </View>
            <View style={styles.cell}>
              <Button
                testID={`prep-vidhi-open-${summary.id}`}
                variant="outline"
                icon="book-open-variant"
                label={t('preparation.openVidhi')}
                accessibilityLabel={`${t('preparation.openVidhi')}: ${label}`}
                onPress={() => onOpenVidhi(summary.id)}
              />
            </View>
          </>
        ) : (
          <View style={styles.cell} />
        )}
        {available ? (
          <IconButton
            testID={`prep-remind-${summary.id}`}
            icon="bell-plus-outline"
            color="primary"
            accessibilityLabel={t('reminders.remindMeFor', { name: label })}
            onPress={() => onRemind(summary.id)}
          />
        ) : null}
        <IconButton
          testID={`prep-more-${summary.id}`}
          icon="dots-vertical"
          color="text"
          accessibilityLabel={t('preparation.moreFor', { name: label })}
          onPress={() => onMore(summary.id)}
        />
      </View>
    </Card>
  );
}

export const PreparationCard = memo(PreparationCardBase);

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  head: { gap: spacing.xxs },
  progress: { gap: spacing.xxs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  cell: { flex: 1 },
});
