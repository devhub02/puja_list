import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { ReviewBadge } from '@/components/ReviewBadge';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useDatabase } from '@/db/DatabaseProvider';
import { getFestival } from '@/db/repositories';
import type { FestivalWithDates } from '@/db/types';
import { useCatalog } from '@/hooks/useCatalog';
import { useTodayIso } from '@/hooks/useCalendar';
import { localize } from '@/i18n/localeMap';
import { useSettingsStore } from '@/store/settingsStore';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { festivalRegionsText, formatCalendarEntry, isOngoing } from '@/utils/calendarDisplay';
import { certaintyLabelKey } from '@/utils/certainty';
import { secondaryName } from '@/utils/pujaDisplay';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; festival: FestivalWithDates };

/** Festival Details: for festivals that have no (single) puja guide to open, and the hub of a festival with several. */
export default function FestivalDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const today = useTodayIso();
  const catalog = useCatalog();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [attempt, setAttempt] = useState(0);
  const key = `${id ?? ''}:${attempt}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    result: Exclude<State, { status: 'loading' }>;
  } | null>(null);
  const state: State = !id
    ? { status: 'notFound' }
    : loaded?.key === key
      ? loaded.result
      : { status: 'loading' };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getFestival(db, id).then(
      (festival) => {
        if (cancelled) return;
        if (festival === null || festival.status !== 'active') {
          setLoaded({ key, result: { status: 'notFound' } });
          return;
        }
        setLoaded({ key, result: { status: 'ready', festival } });
      },
      (error: unknown) => {
        console.error('Could not load the festival', error);
        if (!cancelled) setLoaded({ key, result: { status: 'error' } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, id, key]);

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/calendar')),
    [router],
  );

  const body = (() => {
    if (state.status === 'loading') return <LoadingState />;
    if (state.status === 'error') return <ErrorState onRetry={() => setAttempt((n) => n + 1)} />;
    if (state.status === 'notFound') {
      return (
        <ErrorState
          title={t('festival.notFoundTitle')}
          body={t('festival.notFoundBody')}
          actionLabel={t('festival.openCalendar')}
          onRetry={() => router.navigate('/calendar')}
        />
      );
    }
    const { festival } = state;
    const name = localize(festival.name, language);
    const other = secondaryName(festival.name, language);
    const pujaById = new Map(catalog.pujas.map((p) => [p.id, p]));
    const linked = festival.linkedPujaIds.flatMap((pujaId) => {
      const puja = pujaById.get(pujaId);
      return puja ? [puja] : [];
    });
    const states = festival.states.map((s) => localize(s, language));

    return (
      <>
        <View style={styles.titleBlock}>
          <AppText variant="title" testID="festival-name">
            {name}
          </AppText>
          {other ? (
            <AppText variant="subheading" color="textSecondary">
              {other}
            </AppText>
          ) : null}
          <View style={styles.badges}>
            <AppText variant="label" color="goldText">
              {t(`festivalCategories.${festival.category}`)}
            </AppText>
            <ReviewBadge status={festival.reviewStatus} testID="festival-review-badge" />
          </View>
        </View>

        {festival.reviewStatus !== 'expert_verified' ? (
          <Card tone="alt">
            <AppText variant="subheading" accessibilityRole="header">
              {t('festival.reviewTitle')}
            </AppText>
            <AppText>{t(`review.${festival.reviewStatus}_explain`)}</AppText>
          </Card>
        ) : null}

        <Section title={t('festival.aboutTitle')}>
          <AppText>{localize(festival.shortDescription, language)}</AppText>
        </Section>

        {festival.significance ? (
          <Section title={t('festival.significanceTitle')}>
            <AppText>{localize(festival.significance, language)}</AppText>
          </Section>
        ) : null}

        <Section title={t('festival.whenTitle')}>
          {festival.observanceDescription ? (
            <AppText testID="festival-observance">
              {localize(festival.observanceDescription, language)}
            </AppText>
          ) : null}
          <AppText variant="subheading">{t('festival.datesTitle')}</AppText>
          {festival.dates.length > 0 ? (
            festival.dates.map((date) => (
              <View key={date.id} style={styles.dateBlock} testID={`festival-date-${date.id}`}>
                <AppText testID="festival-date-text">
                  {formatCalendarEntry(date, language, t)}
                </AppText>
                <AppText variant="bodySmall" color="textSecondary">
                  {t(certaintyLabelKey(date.certainty))}
                  {isOngoing(date, today) ? ` · ${t('calendar.ongoing')}` : ''}
                </AppText>
              </View>
            ))
          ) : (
            <AppText color="textSecondary" testID="festival-no-dates">
              {t('festival.noDates')}
            </AppText>
          )}
          <AppText variant="bodySmall" color="textSecondary">
            {t('calendar.dateNote')}
          </AppText>
        </Section>

        <Section title={t('festival.regionsTitle')}>
          <AppText testID="festival-regions">{festivalRegionsText(festival.regions, t)}</AppText>
          {states.length > 0 ? (
            <AppText color="textSecondary">
              {t('festival.statesTitle')}: {states.join(', ')}
            </AppText>
          ) : null}
        </Section>

        <View style={styles.section}>
          <SectionHeader title={t('festival.pujasTitle')} />
          {linked.length > 0 ? (
            linked.map((puja) => (
              <Button
                key={puja.id}
                testID={`open-puja-${puja.id}`}
                variant="outline"
                icon="hands-pray"
                label={localize(puja.name, language)}
                accessibilityLabel={t('festival.openPuja', { name: localize(puja.name, language) })}
                onPress={() => router.push({ pathname: '/puja/[id]', params: { id: puja.id } })}
              />
            ))
          ) : (
            <Card tone="alt">
              <AppText color="textSecondary" testID="festival-no-pujas">
                {t('festival.noPujas')}
              </AppText>
            </Card>
          )}
        </View>

        <Section title={t('festival.sourceTitle')}>
          <AppText variant="bodySmall" color="textSecondary">
            {localize(festival.sourceNote, language)}
          </AppText>
        </Section>

        <Card tone="alt" testID="disclaimer">
          <AppText variant="subheading" accessibilityRole="header">
            {t('settings.disclaimer.title')}
          </AppText>
          <AppText>{t('settings.disclaimer.body')}</AppText>
        </Card>
      </>
    );
  })();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton
          testID="festival-back"
          icon="arrow-left"
          color="text"
          accessibilityLabel={t('a11y.goBack')}
          onPress={goBack}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <Card>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  titleBlock: { gap: spacing.xxs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.sm },
  dateBlock: { gap: 2 },
});
