import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CategoryCard } from '@/components/CategoryCard';
import { EmptyState } from '@/components/EmptyState';
import { PujaTile } from '@/components/PujaTile';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useDatabase } from '@/db/DatabaseProvider';
import type { PujaCategory, PujaSummary } from '@/db/types';
import { useCatalog } from '@/hooks/useCatalog';
import { useUserState } from '@/hooks/useUserState';
import { formatToday } from '@/i18n/format';
import { useSettingsStore } from '@/store/settingsStore';
import { appIconImage } from '@/theme/images';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { categoryOrder, pickFeatured } from '@/utils/pujaDisplay';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const language = useSettingsStore((s) => s.language);
  const catalog = useCatalog();
  const { savedIds, recentIds, toggleSaved } = useUserState();

  const byId = useMemo(() => new Map(catalog.pujas.map((p) => [p.id, p])), [catalog.pujas]);
  const featured = useMemo(() => pickFeatured(catalog.pujas), [catalog.pujas]);
  const counts = useMemo(() => {
    const result = new Map<PujaCategory, number>();
    for (const p of catalog.pujas) result.set(p.category, (result.get(p.category) ?? 0) + 1);
    return result;
  }, [catalog.pujas]);
  // Ids whose content no longer exists are dropped at read time, never deleted.
  const resolve = (ids: readonly string[]): PujaSummary[] =>
    ids.flatMap((id) => {
      const puja = byId.get(id);
      return puja ? [puja] : [];
    });
  const saved = resolve(savedIds);
  const recent = resolve(recentIds);
  const savedSet = new Set(savedIds);

  const openPuja = (id: string) => router.push({ pathname: '/puja/[id]', params: { id } });
  const toggle = (id: string) => void toggleSaved(db, id);
  const openCategory = (category: PujaCategory) =>
    router.navigate({
      pathname: '/library',
      params: { category, nonce: String(Date.now()) },
    });

  const row = (items: PujaSummary[], section: string) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Content scrolls edge to edge inside the screen gutter.
      style={styles.rowBleed}
    >
      {items.map((puja) => (
        <PujaTile
          key={puja.id}
          puja={puja}
          language={language}
          saved={savedSet.has(puja.id)}
          section={section}
          onOpen={openPuja}
          onToggleSaved={toggle}
        />
      ))}
    </ScrollView>
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Image
          source={appIconImage}
          style={[styles.logo, { borderColor: colors.gold }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('a11y.appLogo')}
        />
        <View style={styles.headerText}>
          <AppText variant="title">{t('app.name')}</AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('app.tagline')}
          </AppText>
        </View>
      </View>

      <View style={styles.today}>
        <AppText variant="label" color="goldText">
          {t('home.todayLabel')}
        </AppText>
        <AppText variant="subheading" testID="home-date">
          {formatToday(new Date(), language)}
        </AppText>
      </View>

      <SearchBar
        value=""
        placeholder={t('home.searchPlaceholder')}
        onPress={() => router.push('/search')}
      />

      {catalog.status === 'loading' ? <LoadingState /> : null}
      {catalog.status === 'error' ? <ErrorState onRetry={catalog.retry} /> : null}
      {catalog.status === 'ready' && catalog.pujas.length === 0 ? (
        <EmptyState icon="hands-pray" title={t('home.emptyTitle')} body={t('home.emptyBody')} />
      ) : null}

      {catalog.status === 'ready' && catalog.pujas.length > 0 ? (
        <>
          <View style={styles.section}>
            <SectionHeader
              title={t('home.featuredTitle')}
              description={t('home.featuredDescription')}
            />
            {row(featured, 'featured')}
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('home.categoriesTitle')} />
            <View style={styles.grid}>
              {categoryOrder.map((category) => (
                <View key={category} style={styles.gridCell}>
                  <CategoryCard
                    category={category}
                    count={counts.get(category) ?? 0}
                    onPress={openCategory}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('home.savedTitle')} />
            {saved.length > 0 ? (
              row(saved, 'saved')
            ) : (
              <Card tone="alt">
                <AppText color="textSecondary">{t('home.savedEmpty')}</AppText>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('home.recentTitle')} />
            {recent.length > 0 ? (
              row(recent, 'recent')
            ) : (
              <Card tone="alt">
                <AppText color="textSecondary">{t('home.recentEmpty')}</AppText>
              </Card>
            )}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  logo: { width: 64, height: 64, borderRadius: radius.lg, borderWidth: 1.5 },
  today: { gap: spacing.xxs },
  section: { gap: spacing.sm },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  rowBleed: { marginHorizontal: -spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { width: '47.5%', flexGrow: 1 },
});
