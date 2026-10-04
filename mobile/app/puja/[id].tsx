import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { PujaImage } from '@/components/PujaImage';
import { ReviewBadge } from '@/components/ReviewBadge';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useDatabase } from '@/db/DatabaseProvider';
import { getPuja } from '@/db/repositories';
import type { PujaDetail } from '@/db/types';
import { useUserState } from '@/hooks/useUserState';
import { localize } from '@/i18n/localeMap';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStateStore } from '@/store/userStateStore';
import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { countByClassification, extractSafetyNotes, secondaryName } from '@/utils/pujaDisplay';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; puja: PujaDetail };

export default function PujaDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const { savedIds, toggleSaved } = useUserState();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [attempt, setAttempt] = useState(0);
  // The result belongs to one (id, attempt); anything else means "still loading" (no setState in the effect body).
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
    getPuja(db, id).then(
      (puja) => {
        if (cancelled) return;
        if (puja === null || puja.status !== 'active') {
          setLoaded({ key, result: { status: 'notFound' } });
          return;
        }
        setLoaded({ key, result: { status: 'ready', puja } });
        void useUserStateStore.getState().noteView(db, puja.id);
      },
      (error: unknown) => {
        console.error('Could not load the puja', error);
        if (!cancelled) setLoaded({ key, result: { status: 'error' } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, id, key]);

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/')),
    [router],
  );

  const body = (() => {
    if (state.status === 'loading') return <LoadingState />;
    if (state.status === 'error') {
      return <ErrorState onRetry={() => setAttempt((n) => n + 1)} />;
    }
    if (state.status === 'notFound') {
      return (
        <ErrorState
          title={t('details.notFoundTitle')}
          body={t('details.notFoundBody')}
          actionLabel={t('details.openLibrary')}
          onRetry={() => router.navigate('/library')}
        />
      );
    }
    const { puja } = state;
    const name = localize(puja.name, language);
    const other = secondaryName(puja.name, language);
    const saved = savedIds.includes(puja.id);
    const counts = countByClassification(puja.samagri);
    const safety = extractSafetyNotes(puja.steps);
    const reviewed = puja.reviewStatus !== 'expert_verified';
    const regionLabel = (regions: readonly string[]) =>
      regions.map((r) => t(`regions.${r as 'north'}`)).join(', ');

    return (
      <>
        <PujaImage pujaId={puja.id} category={puja.category} style={styles.hero} />

        <View style={styles.titleBlock}>
          <AppText variant="title" testID="details-name">
            {name}
          </AppText>
          {other ? (
            <AppText variant="subheading" color="textSecondary" testID="details-other-name">
              {other}
            </AppText>
          ) : null}
          <View style={styles.badges}>
            <AppText variant="label" color="goldText">
              {t(`categories.${puja.category}`)}
            </AppText>
            <ReviewBadge status={puja.reviewStatus} testID="review-badge" />
          </View>
        </View>

        <Button
          testID="save-button"
          variant={saved ? 'primary' : 'outline'}
          icon={saved ? 'heart' : 'heart-outline'}
          label={saved ? t('details.saved') : t('details.save')}
          accessibilityLabel={
            saved ? t('a11y.favoriteRemove', { name }) : t('a11y.favoriteAdd', { name })
          }
          selected={saved}
          onPress={() => void toggleSaved(db, puja.id)}
        />

        {reviewed ? (
          <Card tone="alt" style={styles.review}>
            <AppText variant="subheading" accessibilityRole="header">
              {t('details.reviewTitle')}
            </AppText>
            <AppText testID="review-explain">{t(`review.${puja.reviewStatus}_explain`)}</AppText>
          </Card>
        ) : null}

        <Section title={t('details.introTitle')}>
          <AppText>{localize(puja.summary, language)}</AppText>
        </Section>

        <Section title={t('details.significanceTitle')}>
          <AppText>{localize(puja.significance, language)}</AppText>
        </Section>

        <Section title={t('details.whenTitle')}>
          <AppText color="textSecondary" testID="date-unavailable">
            {t('details.dateUnavailable')}
          </AppText>
        </Section>

        {safety.length > 0 ? (
          <Card
            tone="alt"
            style={[styles.safety, { borderColor: colors.primary }]}
            testID="safety-notes"
          >
            <View style={styles.safetyHead}>
              <MaterialCommunityIcons
                name="shield-alert-outline"
                size={iconSize.md}
                color={colors.primary}
                importantForAccessibility="no"
              />
              <AppText variant="subheading" accessibilityRole="header" style={styles.flex}>
                {t('details.safetyTitle')}
              </AppText>
            </View>
            {safety.map((note) => (
              <View key={note.id} style={styles.note}>
                <AppText variant="subheading">{localize(note.title, language)}</AppText>
                <AppText>{localize(note.description, language)}</AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {puja.variations.length > 0 ? (
          <View style={styles.section} testID="variations">
            <SectionHeader
              title={t('details.variationsTitle')}
              description={t('details.variationsIntro')}
            />
            {puja.variations.map((variation) => (
              <Card key={variation.id}>
                <AppText variant="subheading">{localize(variation.title, language)}</AppText>
                <AppText variant="caption" color="goldText">
                  {regionLabel(variation.regions)}
                </AppText>
                <AppText>{localize(variation.description, language)}</AppText>
              </Card>
            ))}
          </View>
        ) : null}

        <Section title={t('details.prepTitle')}>
          <AppText variant="subheading">{t('details.samagriTitle')}</AppText>
          {puja.samagri.length > 0 ? (
            <AppText testID="samagri-counts">
              {[
                t('details.required', { count: counts.REQUIRED }),
                t('details.common', { count: counts.COMMON }),
                t('details.optional', { count: counts.OPTIONAL }),
              ].join(', ')}
            </AppText>
          ) : (
            <AppText color="textSecondary">{t('details.noSamagri')}</AppText>
          )}
          {puja.steps.length > 0 ? (
            <AppText testID="step-count">
              {t('details.steps', { count: puja.steps.length })}
            </AppText>
          ) : null}
          <AppText variant="bodySmall" color="textSecondary">
            {t('details.detailsLater')}
          </AppText>
        </Section>

        <Section title={t('details.sourceTitle')}>
          <AppText variant="bodySmall" color="textSecondary">
            {localize(puja.sourceNote, language)}
          </AppText>
        </Section>

        <Card tone="alt" testID="disclaimer">
          <AppText variant="subheading" accessibilityRole="header">
            {t('settings.disclaimer.title')}
          </AppText>
          <AppText>{t('settings.disclaimer.body')}</AppText>
          {puja.disclaimer ? (
            <AppText variant="bodySmall" color="textSecondary" testID="puja-disclaimer">
              {localize(puja.disclaimer, language)}
            </AppText>
          ) : null}
        </Card>
      </>
    );
  })();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconButton
          testID="details-back"
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
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
  titleBlock: { gap: spacing.xxs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.sm },
  review: { gap: spacing.xs },
  safety: { borderWidth: 1.5, gap: spacing.sm },
  safetyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { gap: spacing.xxs },
  flex: { flex: 1 },
});
