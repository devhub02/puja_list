import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { EmptyState } from '@/components/EmptyState';
import { FestivalRow } from '@/components/FestivalRow';
import { IconButton } from '@/components/IconButton';
import { MonthGrid } from '@/components/MonthGrid';
import { SearchBar } from '@/components/SearchBar';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/StateViews';
import type { Festival } from '@/db/types';
import {
  useFestivalCatalog,
  useMonthOccurrences,
  useTodayIso,
  useYearFestivals,
} from '@/hooks/useCalendar';
import { useOpenFestival } from '@/hooks/useOpenFestival';
import { formatCalendarDateLong, formatMonthYear } from '@/i18n/format';
import type { LanguageCode } from '@/i18n/registry';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import {
  buildDayInfo,
  categoryOptions,
  emptyCalendarFilters,
  filterItems,
  groupByMonth,
  hasCalendarFilters,
  occurrencesOnDay,
  regionOptions,
} from '@/utils/calendarLogic';
import type { CalendarFilters, CalendarItem } from '@/utils/calendarLogic';
import { addMonths, parseIso } from '@/utils/dateUtils';
import type { YearMonth } from '@/utils/dateUtils';

const WIDTH_CAP = 640;

type View_ = 'month' | 'all';

type Row = { key: string; item: CalendarItem };

const rowKey = (item: CalendarItem) => `${item.festival.id}:${item.date?.id ?? 'none'}`;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const today = useTodayIso();
  const festivalCatalog = useFestivalCatalog();

  const [view, setView] = useState<View_>('month');
  const [shown, setShown] = useState<YearMonth>(() => {
    const now = parseIso(today);
    return { year: now?.year ?? 2026, month: now?.month ?? 1 };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>(emptyCalendarFilters);
  const [query, setQuery] = useState('');

  const regions = useMemo(
    () => (festivalCatalog.status === 'ready' ? regionOptions(festivalCatalog.data) : []),
    [festivalCatalog],
  );
  const categories = useMemo(
    () => (festivalCatalog.status === 'ready' ? categoryOptions(festivalCatalog.data) : []),
    [festivalCatalog],
  );

  const openFestival = useOpenFestival();

  const goTo = (target: YearMonth) => {
    setShown(target);
    setSelected(null);
  };
  const jumpToToday = () => {
    const now = parseIso(today);
    if (!now) return;
    setShown({ year: now.year, month: now.month });
    setSelected(today);
  };
  const clearFilters = () => {
    setFilters(emptyCalendarFilters);
    setQuery('');
  };

  const controls = (
    <View style={styles.filters}>
      <ChipRow label={t('calendar.regionLabel')}>
        <Chip
          testID="filter-region-all"
          label={t('calendar.allIndia')}
          selected={filters.region === null}
          onPress={() => setFilters((f) => ({ ...f, region: null }))}
        />
        {regions.map((region) => (
          <Chip
            key={region}
            testID={`filter-region-${region}`}
            label={t(`festivalRegions.${region}`)}
            selected={filters.region === region}
            onPress={() => setFilters((f) => ({ ...f, region }))}
          />
        ))}
      </ChipRow>
      {categories.length > 0 ? (
        <ChipRow label={t('calendar.categoryLabel')}>
          <Chip
            testID="filter-category-all"
            label={t('calendar.allCategories')}
            selected={filters.category === null}
            onPress={() => setFilters((f) => ({ ...f, category: null }))}
          />
          {categories.map((category) => (
            <Chip
              key={category}
              testID={`filter-category-${category}`}
              label={t(`festivalCategories.${category}`)}
              selected={filters.category === category}
              onPress={() => setFilters((f) => ({ ...f, category }))}
            />
          ))}
        </ChipRow>
      ) : null}
      {hasCalendarFilters(filters) || query.trim() !== '' ? (
        <Button
          testID="clear-filters"
          variant="outline"
          icon="filter-remove-outline"
          label={t('calendar.clearFilters')}
          onPress={clearFilters}
        />
      ) : null}
    </View>
  );

  const note = (
    <Card tone="alt" testID="date-note">
      <AppText variant="bodySmall">{t('calendar.dateNote')}</AppText>
    </Card>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="title">{t('calendar.title')}</AppText>
        <SearchBar
          testID="calendar-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('calendar.searchPlaceholder')}
        />
        <SegmentedControl
          accessibilityLabel={t('calendar.viewLabel')}
          testIDPrefix="calendar-view"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: t('calendar.viewMonth') },
            { value: 'all', label: t('calendar.viewAll') },
          ]}
        />
      </View>
      {view === 'month' ? (
        <MonthView
          language={language}
          today={today}
          shown={shown}
          selected={selected}
          filters={filters}
          query={query}
          controls={controls}
          note={note}
          onSelect={(iso) => setSelected((current) => (current === iso ? null : iso))}
          onClearDay={() => setSelected(null)}
          onPrev={() => goTo(addMonths(shown, -1))}
          onNext={() => goTo(addMonths(shown, 1))}
          onToday={jumpToToday}
          onOpen={openFestival}
          onClearFilters={clearFilters}
          onOpenAll={() => setView('all')}
        />
      ) : (
        <AllFestivalsView
          language={language}
          today={today}
          year={shown.year}
          filters={filters}
          query={query}
          controls={controls}
          note={note}
          onYear={(delta) => goTo({ year: shown.year + delta, month: shown.month })}
          onOpen={openFestival}
          onClearFilters={clearFilters}
        />
      )}
    </View>
  );
}

type SharedProps = {
  language: LanguageCode;
  today: string;
  filters: CalendarFilters;
  query: string;
  controls: ReactElement;
  note: ReactElement;
  onOpen: (festival: Festival) => void;
  onClearFilters: () => void;
};

function MonthView({
  language,
  today,
  shown,
  selected,
  filters,
  query,
  controls,
  note,
  onSelect,
  onClearDay,
  onPrev,
  onNext,
  onToday,
  onOpen,
  onClearFilters,
  onOpenAll,
}: SharedProps & {
  shown: YearMonth;
  selected: string | null;
  onSelect: (iso: string) => void;
  onClearDay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenAll: () => void;
}) {
  const { t } = useTranslation();
  const month = useMonthOccurrences(shown.year, shown.month);
  const occurrences = useMemo(() => (month.status === 'ready' ? month.data : []), [month]);
  const visible = useMemo(
    () => filterItems(occurrences, filters, query),
    [occurrences, filters, query],
  );
  const info = useMemo(() => buildDayInfo(visible), [visible]);
  const listed = useMemo(
    () => (selected ? occurrencesOnDay(visible, selected) : visible),
    [visible, selected],
  );
  const rows = useMemo<Row[]>(() => listed.map((item) => ({ key: rowKey(item), item })), [listed]);
  const monthTitle = formatMonthYear(shown.year, shown.month, language);
  const selectedYmd = selected ? parseIso(selected) : null;
  const hasData = occurrences.length > 0;
  const filtering = hasCalendarFilters(filters) || query.trim() !== '';

  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <FestivalRow
        festival={item.item.festival}
        date={item.item.date}
        language={language}
        today={today}
        onOpen={onOpen}
      />
    ),
    [language, today, onOpen],
  );

  const header = (
    <View style={styles.header}>
      {controls}
      <View style={styles.nav}>
        <IconButton
          testID="month-prev"
          icon="chevron-left"
          accessibilityLabel={t('calendar.prevMonth')}
          onPress={onPrev}
        />
        <AppText
          variant="heading"
          style={styles.navTitle}
          testID="month-title"
          accessibilityLiveRegion="polite"
        >
          {monthTitle}
        </AppText>
        <IconButton
          testID="month-next"
          icon="chevron-right"
          accessibilityLabel={t('calendar.nextMonth')}
          onPress={onNext}
        />
      </View>
      <Button
        testID="jump-today"
        variant="outline"
        icon="calendar-today"
        label={t('calendar.today')}
        accessibilityLabel={t('calendar.todayA11y')}
        onPress={onToday}
      />
      <MonthGrid
        year={shown.year}
        month={shown.month}
        language={language}
        today={today}
        selected={selected}
        info={info}
        onSelect={onSelect}
      />
      {month.status === 'ready' && !hasData ? (
        <Card tone="alt" testID="month-no-data">
          <AppText accessibilityRole="alert">{t('calendar.noDataMonth')}</AppText>
        </Card>
      ) : null}
      {note}
      {month.status === 'ready' && hasData ? (
        <View style={styles.listTitle}>
          <AppText variant="subheading" accessibilityRole="header" testID="list-title">
            {selectedYmd
              ? t('calendar.dayListTitle', { date: formatCalendarDateLong(selectedYmd, language) })
              : t('calendar.monthListTitle', { month: monthTitle })}
          </AppText>
          <AppText
            variant="bodySmall"
            color="textSecondary"
            testID="list-count"
            accessibilityLiveRegion="polite"
          >
            {t('calendar.resultCount', { count: listed.length })}
          </AppText>
          {selected ? (
            <Button
              testID="clear-day"
              variant="outline"
              label={t('calendar.clearDay')}
              onPress={onClearDay}
            />
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('calendar.dayListHint')}
            </AppText>
          )}
        </View>
      ) : null}
    </View>
  );

  let empty = null;
  if (month.status === 'loading') empty = <LoadingState />;
  else if (month.status === 'error') empty = <ErrorState onRetry={month.retry} />;
  else if (hasData && listed.length === 0 && selected && !filtering)
    empty = (
      <Card tone="alt" testID="day-empty">
        <AppText>{t('calendar.noFestivalsDay')}</AppText>
      </Card>
    );
  else if (hasData && listed.length === 0)
    empty = (
      <View style={styles.header}>
        <EmptyState
          icon="calendar-search"
          title={t('calendar.noMatchTitle')}
          body={t('calendar.noMatchBody')}
          action={
            filtering ? { label: t('calendar.clearFilters'), onPress: onClearFilters } : undefined
          }
        />
        {filtering ? (
          <Button
            testID="open-all"
            variant="outline"
            icon="calendar-multiple"
            label={t('calendar.openAll')}
            onPress={onOpenAll}
          />
        ) : null}
      </View>
    );

  return (
    <FlatList
      testID="calendar-month-list"
      data={month.status === 'ready' ? rows : []}
      keyExtractor={(row) => row.key}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

type Section = { key: string; title: string; hint?: string; data: Row[] };

function AllFestivalsView({
  language,
  today,
  year,
  filters,
  query,
  controls,
  note,
  onYear,
  onOpen,
  onClearFilters,
}: SharedProps & { year: number; onYear: (delta: number) => void }) {
  const { t } = useTranslation();
  const data = useYearFestivals(year);

  const sections = useMemo<Section[]>(() => {
    if (data.status !== 'ready') return [];
    const dated = filterItems(data.data.dated, filters, query);
    const undated = filterItems(data.data.undated, filters, query);
    const result: Section[] = groupByMonth(dated).map((group) => ({
      key: `month-${group.month}`,
      title: formatMonthYear(year, group.month, language),
      data: group.data.map((item) => ({ key: rowKey(item), item })),
    }));
    // Festivals without a date for this year stay listed (never hidden, never guessed).
    if (undated.length > 0) {
      result.push({
        key: 'no-date',
        title: t('calendar.notAvailableTitle'),
        hint: t('calendar.notAvailableHint', { year }),
        data: undated.map((item) => ({ key: rowKey(item), item })),
      });
    }
    return result;
  }, [data, filters, query, year, language, t]);

  const total = sections.reduce((sum, s) => sum + s.data.length, 0);
  const noDataYear = data.status === 'ready' && data.data.dated.length === 0;
  const filtering = hasCalendarFilters(filters) || query.trim() !== '';

  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <FestivalRow
        festival={item.item.festival}
        date={item.item.date}
        language={language}
        today={today}
        onOpen={onOpen}
      />
    ),
    [language, today, onOpen],
  );

  const header = (
    <View style={styles.header}>
      {controls}
      <View style={styles.nav}>
        <IconButton
          testID="year-prev"
          icon="chevron-left"
          accessibilityLabel={t('calendar.prevYear')}
          onPress={() => onYear(-1)}
        />
        <AppText
          variant="heading"
          style={styles.navTitle}
          testID="year-title"
          accessibilityLiveRegion="polite"
        >
          {String(year)}
        </AppText>
        <IconButton
          testID="year-next"
          icon="chevron-right"
          accessibilityLabel={t('calendar.nextYear')}
          onPress={() => onYear(1)}
        />
      </View>
      {noDataYear ? (
        <Card tone="alt" testID="year-no-data">
          <AppText accessibilityRole="alert">{t('calendar.noDataYear', { year })}</AppText>
        </Card>
      ) : null}
      {note}
      {data.status === 'ready' ? (
        <AppText
          variant="bodySmall"
          color="textSecondary"
          testID="list-count"
          accessibilityLiveRegion="polite"
        >
          {t('calendar.resultCount', { count: total })}
        </AppText>
      ) : null}
    </View>
  );

  let empty = null;
  if (data.status === 'loading') empty = <LoadingState />;
  else if (data.status === 'error') empty = <ErrorState onRetry={data.retry} />;
  else if (total === 0)
    empty = (
      <EmptyState
        icon="calendar-search"
        title={t('calendar.noMatchTitle')}
        body={t('calendar.noMatchBody')}
        action={
          filtering ? { label: t('calendar.clearFilters'), onPress: onClearFilters } : undefined
        }
      />
    );

  return (
    <SectionList
      testID="calendar-all-list"
      sections={data.status === 'ready' ? sections : []}
      keyExtractor={(row) => row.key}
      renderItem={renderItem}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader} testID={`section-${section.key}`}>
          <AppText variant="subheading" accessibilityRole="header">
            {section.title}
          </AppText>
          {section.hint ? (
            <AppText variant="bodySmall" color="textSecondary">
              {section.hint}
            </AppText>
          ) : null}
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={Separator}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // Each section also counts its header and footer as cells, so this is about 6 rows.
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
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
  header: { gap: spacing.sm, paddingBottom: spacing.md },
  filters: { gap: spacing.sm },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { flex: 1, textAlign: 'center' },
  listTitle: { gap: spacing.xxs },
  sectionHeader: { gap: spacing.xxs, paddingTop: spacing.md, paddingBottom: spacing.xs },
  separator: { height: spacing.sm },
});
