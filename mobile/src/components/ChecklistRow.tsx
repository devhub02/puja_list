import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { iconSize, minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export type RowDetail = { label: string; text: string };

type Props = {
  /** Stable key for callbacks and test ids (`samagri:<id>` / `custom:<id>`). */
  rowKey: string;
  name: string;
  checked: boolean;
  /** One line of "why": purpose, or a user's note. */
  summary?: string;
  /** Extra labelled lines (quantity, preparation note, regional note). */
  details?: RowDetail[];
  /** Details are hidden behind "Show more" when this is true and `expanded` is false. */
  collapsible?: boolean;
  expanded?: boolean;
  onToggleExpanded?: (rowKey: string) => void;
  onToggle: (rowKey: string) => void;
  /** Custom items only. */
  onEdit?: (rowKey: string) => void;
  onDelete?: (rowKey: string) => void;
  highlighted?: boolean;
  /** Compact = shopping list: name and one summary line, no details, tighter padding. */
  compact?: boolean;
};

/**
 * One checklist item: a 48dp checkbox row (the whole text area ticks it), optional details with a
 * "Show more" toggle, and for custom items separate Edit/Delete buttons. Checked state is shown by the
 * box icon AND a line through the name (not by colour alone) and announced as a checkbox state.
 */
function ChecklistRowBase({
  rowKey,
  name,
  checked,
  summary,
  details = [],
  collapsible = false,
  expanded = false,
  onToggleExpanded,
  onToggle,
  onEdit,
  onDelete,
  highlighted = false,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const showDetails = !compact && (!collapsible || expanded);
  return (
    <View
      testID={`row-${rowKey}`}
      style={[
        styles.row,
        { backgroundColor: highlighted ? colors.surfaceAlt : colors.surface },
        { borderColor: highlighted ? colors.primary : colors.border },
        highlighted && styles.highlight,
      ]}
    >
      <View style={styles.line}>
        <Pressable
          testID={`check-${rowKey}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => onToggle(rowKey)}
          android_ripple={{ color: colors.pressed }}
          style={({ pressed }) => [
            styles.main,
            compact && styles.mainCompact,
            pressed && { backgroundColor: colors.pressed },
          ]}
        >
          <MaterialCommunityIcons
            name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={iconSize.lg - 4}
            color={checked ? colors.primary : colors.borderStrong}
            importantForAccessibility="no"
          />
          <View style={styles.text}>
            <AppText
              variant="subheading"
              color={checked ? 'textSecondary' : 'text'}
              style={checked ? styles.struck : undefined}
            >
              {name}
            </AppText>
            {summary ? (
              <AppText
                variant="bodySmall"
                color="textSecondary"
                numberOfLines={compact ? 1 : collapsible && !expanded ? 2 : undefined}
              >
                {summary}
              </AppText>
            ) : null}
            {showDetails
              ? details.map((detail) => (
                  <AppText key={detail.label} variant="bodySmall">
                    <AppText variant="bodySmall" color="goldText">
                      {detail.label}:{' '}
                    </AppText>
                    {detail.text}
                  </AppText>
                ))
              : null}
          </View>
        </Pressable>
        {onEdit ? (
          <IconButton
            testID={`edit-${rowKey}`}
            icon="pencil-outline"
            color="textSecondary"
            accessibilityLabel={t('checklist.editNamed', { name })}
            onPress={() => onEdit(rowKey)}
          />
        ) : null}
        {onDelete ? (
          <IconButton
            testID={`delete-${rowKey}`}
            icon="trash-can-outline"
            color="textSecondary"
            accessibilityLabel={t('checklist.deleteNamed', { name })}
            onPress={() => onDelete(rowKey)}
          />
        ) : null}
      </View>
      {collapsible && onToggleExpanded ? (
        <Pressable
          testID={`expand-${rowKey}`}
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? t('checklist.showLessNamed', { name })
              : t('checklist.showMoreNamed', { name })
          }
          accessibilityState={{ expanded }}
          onPress={() => onToggleExpanded(rowKey)}
          style={styles.expand}
        >
          <AppText variant="bodySmall" color="primary" style={styles.expandText}>
            {expanded ? t('checklist.showLess') : t('checklist.showMore')}
          </AppText>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={iconSize.sm}
            color={colors.primary}
            importantForAccessibility="no"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export const ChecklistRow = memo(ChecklistRowBase);

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  highlight: { borderWidth: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start' },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mainCompact: { paddingVertical: spacing.xs, alignItems: 'center' },
  text: { flex: 1, gap: spacing.xxs },
  struck: { textDecorationLine: 'line-through' },
  expand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.sm,
    paddingLeft: spacing.sm + iconSize.lg - 4 + spacing.sm,
  },
  expandText: { textDecorationLine: 'underline' },
});
