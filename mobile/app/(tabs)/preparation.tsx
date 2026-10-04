import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function PreparationScreen() {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <AppText variant="title">{t('preparation.title')}</AppText>
      <EmptyState
        icon="clipboard-check-multiple-outline"
        title={t('preparation.emptyTitle')}
        body={t('preparation.emptyBody')}
      />
    </ScreenContainer>
  );
}
