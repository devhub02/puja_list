/**
 * Phone database schema. Mirrors docs/DB_SCHEMA.md exactly.
 *
 * Content tables are replaced on every re-seed. User-data tables are never touched by seeding and have
 * NO foreign keys to content tables (they hold plain stable content ids).
 * The FTS5 table `search_index` is created by a raw SQL migration (Drizzle cannot model virtual tables).
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------- content tables

export const festival = sqliteTable('festival', {
  id: text('id').primaryKey(),
  nameJson: text('name_json').notNull(),
  altNamesJson: text('alt_names_json'),
  descriptionJson: text('description_json').notNull(),
  significanceJson: text('significance_json').notNull(),
  regionsJson: text('regions_json').notNull(),
  status: text('status').notNull(),
});

export const puja = sqliteTable(
  'puja',
  {
    id: text('id').primaryKey(),
    festivalId: text('festival_id').references(() => festival.id),
    nameJson: text('name_json').notNull(),
    altNamesJson: text('alt_names_json'),
    category: text('category').notNull(),
    regionsJson: text('regions_json').notNull(),
    summaryJson: text('summary_json').notNull(),
    significanceJson: text('significance_json').notNull(),
    reviewStatus: text('review_status').notNull(),
    sourceNoteJson: text('source_note_json').notNull(),
    disclaimerJson: text('disclaimer_json'),
    contentVersion: integer('content_version').notNull(),
    status: text('status').notNull(),
  },
  (t) => [
    index('puja_festival_id_idx').on(t.festivalId),
    index('puja_category_idx').on(t.category),
    index('puja_status_idx').on(t.status),
  ],
);

export const samagri = sqliteTable('samagri', {
  id: text('id').primaryKey(),
  nameJson: text('name_json').notNull(),
  altNamesJson: text('alt_names_json'),
  descriptionJson: text('description_json'),
  status: text('status').notNull(),
});

export const pujaSamagri = sqliteTable(
  'puja_samagri',
  {
    pujaId: text('puja_id')
      .notNull()
      .references(() => puja.id),
    samagriId: text('samagri_id')
      .notNull()
      .references(() => samagri.id),
    classification: text('classification', { enum: ['REQUIRED', 'COMMON', 'OPTIONAL'] }).notNull(),
    purposeJson: text('purpose_json').notNull(),
    quantityGuidanceJson: text('quantity_guidance_json'),
    preparationNoteJson: text('preparation_note_json'),
    regionalNoteJson: text('regional_note_json'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pujaId, t.samagriId] }),
    index('puja_samagri_puja_sort_idx').on(t.pujaId, t.sortOrder),
    index('puja_samagri_samagri_id_idx').on(t.samagriId),
  ],
);

export const vidhiStep = sqliteTable(
  'vidhi_step',
  {
    id: text('id').primaryKey(),
    pujaId: text('puja_id')
      .notNull()
      .references(() => puja.id),
    stepNumber: integer('step_number').notNull(),
    titleJson: text('title_json').notNull(),
    descriptionJson: text('description_json').notNull(),
    relatedSamagriIdsJson: text('related_samagri_ids_json').notNull(),
    isOptional: integer('is_optional').notNull(),
    importantNoteJson: text('important_note_json'),
  },
  (t) => [uniqueIndex('vidhi_step_puja_step_uq').on(t.pujaId, t.stepNumber)],
);

export const regionalVariation = sqliteTable(
  'regional_variation',
  {
    id: text('id').primaryKey(),
    pujaId: text('puja_id')
      .notNull()
      .references(() => puja.id),
    regionsJson: text('regions_json').notNull(),
    titleJson: text('title_json').notNull(),
    descriptionJson: text('description_json').notNull(),
    affectsStepIdsJson: text('affects_step_ids_json'),
    affectsSamagriIdsJson: text('affects_samagri_ids_json'),
  },
  (t) => [index('regional_variation_puja_id_idx').on(t.pujaId)],
);

export const checklistTemplate = sqliteTable(
  'checklist_template',
  {
    id: text('id').primaryKey(),
    pujaId: text('puja_id')
      .notNull()
      .references(() => puja.id),
    textJson: text('text_json').notNull(),
    daysBefore: integer('days_before').notNull(),
  },
  (t) => [index('checklist_template_puja_id_idx').on(t.pujaId)],
);

export const calendarDate = sqliteTable(
  'calendar_date',
  {
    id: text('id').primaryKey(),
    festivalId: text('festival_id')
      .notNull()
      .references(() => festival.id),
    year: integer('year').notNull(),
    date: text('date').notNull(),
    endDate: text('end_date'),
    certainty: text('certainty').notNull(),
    regionNoteJson: text('region_note_json'),
    source: text('source').notNull(),
  },
  (t) => [
    index('calendar_date_festival_year_idx').on(t.festivalId, t.year),
    index('calendar_date_year_date_idx').on(t.year, t.date),
  ],
);

/** key/value: content_version, schema_version, checksum, seeded_at */
export const contentMeta = sqliteTable('content_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ---------------------------------------------------------------- user-data tables (never seeded)

export const savedPuja = sqliteTable(
  'saved_puja',
  {
    pujaId: text('puja_id').primaryKey(),
    savedAt: integer('saved_at').notNull(),
  },
  (t) => [index('saved_puja_saved_at_idx').on(t.savedAt)],
);

export const checklistProgress = sqliteTable(
  'checklist_progress',
  {
    pujaId: text('puja_id').notNull(),
    itemRef: text('item_ref').notNull(),
    itemKind: text('item_kind', { enum: ['samagri', 'template', 'custom'] }).notNull(),
    checked: integer('checked').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pujaId, t.itemKind, t.itemRef] }),
    index('checklist_progress_puja_id_idx').on(t.pujaId),
  ],
);

export const customSamagri = sqliteTable(
  'custom_samagri',
  {
    id: text('id').primaryKey(),
    pujaId: text('puja_id').notNull(),
    name: text('name').notNull(),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('custom_samagri_puja_id_idx').on(t.pujaId)],
);

export const reminder = sqliteTable(
  'reminder',
  {
    id: text('id').primaryKey(),
    pujaId: text('puja_id'),
    festivalId: text('festival_id'),
    title: text('title').notNull(),
    fireAt: integer('fire_at').notNull(),
    notificationId: text('notification_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('reminder_fire_at_idx').on(t.fireAt), index('reminder_puja_id_idx').on(t.pujaId)],
);

export const recentView = sqliteTable(
  'recent_view',
  {
    pujaId: text('puja_id').primaryKey(),
    viewedAt: integer('viewed_at').notNull(),
  },
  (t) => [index('recent_view_viewed_at_idx').on(t.viewedAt)],
);

export const recentSearch = sqliteTable(
  'recent_search',
  {
    query: text('query').primaryKey(),
    searchedAt: integer('searched_at').notNull(),
  },
  (t) => [index('recent_search_searched_at_idx').on(t.searchedAt)],
);
