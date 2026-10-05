import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdSlot } from '@/ads/AdSlot';
import { getLibraryAdInsertPositions } from '@/ads/libraryAdPlacement';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChipRow } from '@/components/ChipRow';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { PujaCard } from '@/components/PujaCard';
import { SearchBar } from '@/components/SearchBar';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useDatabase } from '@/db/DatabaseProvider';
import type { PujaCategory } from '@/db/types';
import { useNextDates } from '@/hooks/useCalendar';
import { useCatalog } from '@/hooks/useCatalog';
import { usePujaSearch } from '@/hooks/usePujaSearch';
import { useUserState } from '@/hooks/useUserState';
import { localize } from '@/i18n/localeMap';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { formatCalendarEntry } from '@/utils/calendarDisplay';
import { certaintyLabelKey } from '@/utils/certainty';
import { buildLibraryItems, emptyFilters, hasActiveFilters } from '@/utils/libraryFilter';
import type { LibraryFilters, LibraryItem } from '@/utils/libraryFilter';
import { categoryOrder } from '@/utils/pujaDisplay';

const WIDTH_CAP = 640;

export default function LibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const catalog = useCatalog();
  const nextDates = useNextDates();
  const { savedIds, recentIds, toggleSaved, noteSearch } = useUserState();
  const params = useLocalSearchParams<{ category?: string; nonce?: string }>();

  const [text, setText] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>(emptyFilters);
  const search = usePujaSearch(text);

  // Home's category cards open the Library with that category selected. Adjusting state while rendering
  // (React's pattern for "a prop changed") avoids an extra render pass through an effect.
  const paramKey = `${params.category ?? ''}:${params.nonce ?? ''}`;
  const [seenParamKey, setSeenParamKey] = useState(':'); // ':' = no category param
  if (paramKey !== seenParamKey) {
    setSeenParamKey(paramKey);
    const wanted = params.category;
    if (wanted && (categoryOrder as readonly string[]).includes(wanted)) {
      setFilters({ ...emptyFilters, category: wanted as PujaCategory });
      setText('');
    }
  }

  // Only offer category chips that have pujas, so no chip leads to an empty list.
  const presentCategories = useMemo(
    () => categoryOrder.filter((c) => catalog.pujas.some((p) => p.category === c)),
    [catalog.pujas],
  );

  const items = useMemo(
    () =>
      buildLibraryItems(catalog.pujas, filters, {
        language,
        savedIds,
        recentIds,
        searchHits: search.hits,
      }),
    [catalog.pujas, filters, language, savedIds, recentIds, search.hits],
  );

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const searching = text.trim() !== '';

  // Inline banners between puja rows: never in search results, never with filters on an under-8 result
  // list, never first/last row (CLAUDE.md "Ads rules").
  type Row = { kind: 'puja'; item: LibraryItem } | { kind: 'ad'; afterIndex: number };
  const rows = useMemo<Row[]>(() => {
    const filterOrSearchActive = searching || hasActiveFilters(filters);
    const adPositions = searching
      ? []
      : getLibraryAdInsertPositions(items.length, filterOrSearchActive);
    const adAfter = new Set(adPositions);
    const result: Row[] = [];
    items.forEach((item, index) => {
      result.push({ kind: 'puja', item });
      if (adAfter.has(index)) result.push({ kind: 'ad', afterIndex: index });
    });
    return result;
  }, [items, searching, filters]);

  const clearAll = () => {
    setFilters(emptyFilters);
    setText('');
  };

  const open = useCallback(
    (id: string) => {
      if (text.trim() !== '') void noteSearch(db, text);
      router.push({ pathname: '/puja/[id]', params: { id } });
    },
    [db, noteSearch, router, text],
  );
  const toggle = useCallback((id: string) => void toggleSaved(db, id), [db, toggleSaved]);

  // Light "Next: <date>" line, only from a bundled date of the puja's festival (never a guess).
  const nextDateText = useCallback(
    (festivalId: string | undefined) => {
      if (!festivalId || nextDates.status !== 'ready') return undefined;
      const date = nextDates.data.get(festivalId);
      if (!date) return undefined;
      return `${t('library.nextDate', { date: formatCalendarEntry(date, language, t) })} · ${t(certaintyLabelKey(date.certainty))}`;
    },
    [nextDates, language, t],
  );

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) => {
      if (row.kind === 'ad') return <AdSlot placement="library_banner" />;
      const item = row.item;
      return (
        <PujaCard
          puja={item.puja}
          language={language}
          saved={savedSet.has(item.puja.id)}
          nextDate={nextDateText(item.puja.festivalId)}
          hint={
            item.matchedSamagri.length > 0
              ? t('library.contains', {
                  items: item.matchedSamagri.map((m) => localize(m, language)).join(', '),
                })
              : undefined
          }
          onOpen={open}
          onToggleSaved={toggle}
        />
      );
    },
    [language, savedSet, open, toggle, nextDateText, t],
  );
  const rowKey = useCallback(
    (row: Row) => (row.kind === 'ad' ? `ad-${row.afterIndex}` : row.item.puja.id),
    [],
  );

  const header = (
    <View style={styles.filters}>
      <ChipRow label={t('library.shortcutsLabel')} radio={false}>
        <Chip
          testID="filter-favorites"
          role="checkbox"
          label={t('library.favorites')}
          selected={filters.scope === 'favorites'}
          onPress={() =>
            setFilters((f) => ({ ...f, scope: f.scope === 'favorites' ? 'all' : 'favorites' }))
          }
        />
        <Chip
          testID="filter-recent"
          role="checkbox"
          label={t('library.recent')}
          selected={filters.scope === 'recent'}
          onPress={() =>
            setFilters((f) => ({ ...f, scope: f.scope === 'recent' ? 'all' : 'recent' }))
          }
        />
      </ChipRow>
      <ChipRow label={t('library.categoryLabel')}>
        <Chip
          testID="filter-category-all"
          label={t('library.all')}
          selected={filters.category === null}
          onPress={() => setFilters((f) => ({ ...f, category: null }))}
        />
        {presentCategories.map((category) => (
          <Chip
            key={category}
            testID={`filter-category-${category}`}
            label={t(`categories.${category}`)}
            selected={filters.category === category}
            onPress={() => setFilters((f) => ({ ...f, category }))}
          />
        ))}
      </ChipRow>
      <ChipRow label={t('library.kindLabel')}>
        <Chip
          testID="filter-kind-all"
          label={t('library.all')}
          selected={filters.kind === null}
          onPress={() => setFilters((f) => ({ ...f, kind: null }))}
        />
        <Chip
          testID="filter-kind-festival"
          label={t('library.kindFestival')}
          selected={filters.kind === 'festival'}
          onPress={() => setFilters((f) => ({ ...f, kind: 'festival' }))}
        />
        <Chip
          testID="filter-kind-household"
          label={t('library.kindHousehold')}
          selected={filters.kind === 'household'}
          onPress={() => setFilters((f) => ({ ...f, kind: 'household' }))}
        />
      </ChipRow>
      <View style={styles.summary}>
        <AppText
          variant="bodySmall"
          color="textSecondary"
          testID="library-count"
          accessibilityLiveRegion="polite"
        >
          {t('library.resultCount', { count: items.length })}
        </AppText>
        {hasActiveFilters(filters) || searching ? (
          <Button
            testID="clear-filters"
            variant="outline"
            label={t('library.clearFilters')}
            onPress={clearAll}
          />
        ) : null}
      </View>
    </View>
  );

  let empty = null;
  if (catalog.status === 'loading') empty = <LoadingState />;
  else if (catalog.status === 'error') empty = <ErrorState onRetry={catalog.retry} />;
  else if (search.error) empty = <ErrorState body={t('search.error')} onRetry={clearAll} />;
  else if (searching && search.pending) empty = <LoadingState label={t('search.searching')} />;
  else if (searching)
    empty = (
      <EmptyState
        icon="magnify-close"
        title={t('search.noResultsTitle', { query: text.trim() })}
        body={t('search.noResultsBody')}
      />
    );
  else if (filters.scope === 'favorites')
    empty = (
      <EmptyState
        icon="heart-outline"
        title={t('library.emptyFavoritesTitle')}
        body={t('library.emptyFavoritesBody')}
      />
    );
  else if (filters.scope === 'recent')
    empty = (
      <EmptyState
        icon="history"
        title={t('library.emptyRecentTitle')}
        body={t('library.emptyRecentBody')}
      />
    );
  else
    empty = (
      <EmptyState
        icon="book-open-page-variant-outline"
        title={t('library.emptyTitle')}
        body={t('library.emptyBody')}
      />
    );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search stays above the list, so it is always reachable while scrolling. */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="title">{t('library.title')}</AppText>
        <SearchBar
          testID="library-search"
          value={text}
          onChangeText={setText}
          onSubmit={(value) => {
            if (value.trim() !== '') void noteSearch(db, value);
          }}
        />
      </View>
      <FlatList
        testID="library-list"
        data={catalog.status === 'ready' && !(searching && search.pending) ? rows : []}
        keyExtractor={rowKey}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    width: '100%',
    maxWidth: WIDTH_CAP,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: WIDTH_CAP,
    alignSelf: 'center',
  },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  separator: { height: spacing.sm },
});
