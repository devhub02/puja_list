import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { SearchBar } from '@/components/SearchBar';
import { SearchResultRow } from '@/components/SearchResultRow';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useDatabase } from '@/db/DatabaseProvider';
import { useCatalog } from '@/hooks/useCatalog';
import { usePujaSearch } from '@/hooks/usePujaSearch';
import { useUserState } from '@/hooks/useUserState';
import { localize } from '@/i18n/localeMap';
import { toSearchRows } from '@/search/searchRows';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { pickFeatured } from '@/utils/pujaDisplay';

/** Instant suggestions shown under the bar while typing; the full list opens on the keyboard's search key. */
export const SUGGESTION_LIMIT = 6;
const SUGGESTION_CHIPS = 4;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const catalog = useCatalog();
  const { recentSearches, noteSearch, clearSearches } = useUserState();

  const [text, setText] = useState('');
  /** The text the user submitted with the keyboard; the full results list shows while it equals `text`. */
  const [submitted, setSubmitted] = useState<string | null>(null);
  const search = usePujaSearch(text);

  const trimmed = text.trim();
  const showFull = submitted !== null && submitted === trimmed;

  const rows = useMemo(
    () =>
      search.hits
        ? toSearchRows(search.hits, language, (puja) => t('search.foundIn', { puja }))
        : [],
    [search.hits, language, t],
  );
  const suggestionChips = useMemo(
    () => pickFeatured(catalog.pujas, SUGGESTION_CHIPS).map((p) => localize(p.name, language)),
    [catalog.pujas, language],
  );

  const submit = (value: string) => {
    const clean = value.trim();
    if (clean === '') return;
    setSubmitted(clean);
    void noteSearch(db, clean);
    Keyboard.dismiss(); // the text stays in the field
  };
  const openPuja = (id: string) => {
    if (trimmed !== '') void noteSearch(db, trimmed);
    router.push({ pathname: '/puja/[id]', params: { id } });
  };
  const fill = (value: string) => {
    setText(value);
    submit(value);
  };

  const shown = showFull ? rows : rows.slice(0, SUGGESTION_LIMIT);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + spacing.xs },
      ]}
    >
      <View style={styles.bar}>
        <IconButton
          testID="search-back"
          icon="arrow-left"
          color="text"
          accessibilityLabel={t('a11y.goBack')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View style={styles.field}>
          <SearchBar
            value={text}
            onChangeText={setText}
            onSubmit={submit}
            autoFocus
            testID="search-screen-bar"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {trimmed === '' ? (
          <>
            {recentSearches.length > 0 ? (
              <View style={styles.section} testID="recent-searches">
                <View style={styles.sectionHead}>
                  <View style={styles.grow}>
                    <SectionHeader title={t('search.recentTitle')} />
                  </View>
                  <Button
                    testID="clear-recent-searches"
                    variant="outline"
                    label={t('search.clearRecent')}
                    onPress={() => void clearSearches(db)}
                  />
                </View>
                <View style={styles.chips}>
                  {recentSearches.map((q) => (
                    <Chip
                      key={q}
                      role="checkbox"
                      testID={`recent-${q}`}
                      label={q}
                      selected={false}
                      onPress={() => fill(q)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {suggestionChips.length > 0 ? (
              <View style={styles.section} testID="search-suggestions">
                <SectionHeader title={t('search.suggestionsTitle')} />
                <View style={styles.chips}>
                  {suggestionChips.map((name) => (
                    <Chip
                      key={name}
                      role="checkbox"
                      label={name}
                      selected={false}
                      onPress={() => fill(name)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : search.error ? (
          <ErrorState body={t('search.error')} onRetry={() => setText('')} />
        ) : search.pending ? (
          <LoadingState label={t('search.searching')} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="magnify-close"
            title={t('search.noResultsTitle', { query: trimmed })}
            body={t('search.noResultsBody')}
          />
        ) : (
          <View style={styles.section} testID={showFull ? 'search-results' : 'search-instant'}>
            {showFull ? <SectionHeader title={t('search.resultsTitle')} /> : null}
            {shown.map((row) => (
              <SearchResultRow
                key={row.pujaId}
                pujaId={row.pujaId}
                title={row.title}
                subtitle={row.subtitle}
                icon={row.kind === 'samagri' ? 'flower-tulip-outline' : 'hands-pray'}
                onOpen={openPuja}
              />
            ))}
            {!showFull && rows.length > SUGGESTION_LIMIT ? (
              <Button
                testID="see-all-results"
                variant="outline"
                label={t('search.seeAll', { query: trimmed })}
                onPress={() => submit(trimmed)}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  field: { flex: 1 },
  content: {
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  section: { gap: spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
