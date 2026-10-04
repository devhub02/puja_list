import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function LibraryScreen() {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <AppText variant="title">{t('library.title')}</AppText>
      <EmptyState
        icon="book-open-page-variant-outline"
        title={t('library.emptyTitle')}
        body={t('library.emptyBody')}
      />
    </ScreenContainer>
  );
}
