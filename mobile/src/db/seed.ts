/**
 * Seed loader: copies the bundled content into the content tables.
 *
 * Rules (docs/DB_SCHEMA.md section 6): one transaction; only content tables (and the search index) are
 * written; user-data tables are never touched; any failure rolls everything back and the previous
 * content stays in place.
 */
import { buildSearchRows } from './search/indexRows';
import type { SqlDb, SqlValue } from './sqlDb';
import { withTransaction } from './sqlDb';
import type { ContentBundle } from './types';

/** Highest content `schemaVersion` this build of the app can read. */
export const SUPPORTED_SCHEMA_VERSION = 2;

export type SeedOutcome = 'seeded' | 'unchanged';

/** Content tables in dependency order: children before parents when deleting. */
const CONTENT_TABLES_DELETE_ORDER = [
  'search_index',
  'puja_samagri',
  'vidhi_step',
  'regional_variation',
  'checklist_template',
  'calendar_date',
  'puja',
  'samagri',
  'festival',
] as const;

const json = (value: unknown): string => JSON.stringify(value);
const jsonOrNull = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value);

type MetaRow = { key: string; value: string };

async function readMeta(db: SqlDb): Promise<Record<string, string>> {
  const rows = await db.all<MetaRow>('SELECT key, value FROM content_meta');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/**
 * Re-seed when nothing was seeded yet, or the bundled contentVersion, schemaVersion or checksum differs
 * from what is stored. (The checksum catches a rebuilt bundle whose version was not bumped, e.g. in dev.)
 */
export async function needsSeed(db: SqlDb, bundle: ContentBundle): Promise<boolean> {
  const meta = await readMeta(db);
  return (
    meta.content_version !== String(bundle.contentVersion) ||
    meta.schema_version !== String(bundle.schemaVersion) ||
    meta.checksum !== bundle.checksum
  );
}

function assertReadable(bundle: ContentBundle): void {
  if (bundle.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Bundled content schemaVersion ${bundle.schemaVersion} is newer than this app supports (${SUPPORTED_SCHEMA_VERSION})`,
    );
  }
  for (const key of ['festivals', 'pujas', 'samagri', 'calendar'] as const) {
    if (!Array.isArray(bundle[key]))
      throw new Error(`Bundled content is malformed: "${key}" is missing`);
  }
}

export async function seedContentIfNeeded(
  db: SqlDb,
  bundle: ContentBundle,
  now: () => number = Date.now,
): Promise<SeedOutcome> {
  assertReadable(bundle);
  if (!(await needsSeed(db, bundle))) return 'unchanged';

  await withTransaction(db, async () => {
    for (const table of CONTENT_TABLES_DELETE_ORDER) {
      await db.run(`DELETE FROM ${table}`);
    }

    for (const f of bundle.festivals) {
      await db.run(
        `INSERT INTO festival (id, name_json, alt_names_json, short_description_json, significance_json,
           regions_json, states_json, category, date_type, observance_json, linked_puja_ids_json,
           review_status, source_note_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id,
          json(f.name),
          jsonOrNull(f.alternateNames),
          json(f.shortDescription),
          jsonOrNull(f.significance),
          json(f.regions),
          jsonOrNull(f.states?.length ? f.states : undefined),
          f.category,
          f.dateType,
          jsonOrNull(f.observanceDescription),
          json(f.linkedPujaIds ?? []),
          f.reviewStatus,
          json(f.sourceNote),
          f.status,
        ],
      );
    }

    for (const s of bundle.samagri) {
      await db.run(
        `INSERT INTO samagri (id, name_json, alt_names_json, description_json, status) VALUES (?, ?, ?, ?, ?)`,
        [s.id, json(s.name), jsonOrNull(s.alternateNames), jsonOrNull(s.description), s.status],
      );
    }

    for (const p of bundle.pujas) {
      await db.run(
        `INSERT INTO puja (id, festival_id, name_json, alt_names_json, category, regions_json, summary_json,
           significance_json, review_status, source_note_json, disclaimer_json, content_version, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.festivalId ?? null,
          json(p.name),
          jsonOrNull(p.alternateNames),
          p.category,
          json(p.regions),
          json(p.summary),
          json(p.significance),
          p.reviewStatus,
          json(p.sourceNote),
          jsonOrNull(p.disclaimer),
          p.contentVersion,
          p.status,
        ],
      );
      for (const u of p.samagri) {
        await db.run(
          `INSERT INTO puja_samagri (puja_id, samagri_id, classification, purpose_json, quantity_guidance_json,
             preparation_note_json, regional_note_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            u.samagriId,
            u.classification,
            json(u.purpose),
            jsonOrNull(u.quantityGuidance),
            jsonOrNull(u.preparationNote),
            jsonOrNull(u.regionalNote),
            u.sortOrder,
          ],
        );
      }
      for (const step of p.steps) {
        await db.run(
          `INSERT INTO vidhi_step (id, puja_id, step_number, title_json, description_json,
             related_samagri_ids_json, is_optional, important_note_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            step.id,
            p.id,
            step.stepNumber,
            json(step.title),
            json(step.description),
            json(step.relatedSamagriIds ?? []),
            step.isOptional ? 1 : 0,
            jsonOrNull(step.importantNote),
          ],
        );
      }
      for (const v of p.variations) {
        await db.run(
          `INSERT INTO regional_variation (id, puja_id, regions_json, title_json, description_json,
             affects_step_ids_json, affects_samagri_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            v.id,
            p.id,
            json(v.regions),
            json(v.title),
            json(v.description),
            json(v.affectsStepIds ?? []),
            json(v.affectsSamagriIds ?? []),
          ],
        );
      }
      for (const c of p.preparationChecklist ?? []) {
        await db.run(
          `INSERT INTO checklist_template (id, puja_id, text_json, days_before) VALUES (?, ?, ?, ?)`,
          [c.id, p.id, json(c.text), c.daysBefore],
        );
      }
    }

    for (const calendarYear of bundle.calendar) {
      for (const e of calendarYear.entries) {
        await db.run(
          `INSERT INTO calendar_date (id, festival_id, year, date, end_date, region, certainty, region_note_json, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.festivalId,
            calendarYear.year,
            e.date,
            e.endDate ?? null,
            e.region ?? 'all',
            e.certainty,
            jsonOrNull(e.regionNote),
            e.source ?? '', // the column is NOT NULL; '' means "no source"
          ],
        );
      }
    }

    for (const row of buildSearchRows(bundle)) {
      await db.run(
        `INSERT INTO search_index (entity_type, entity_id, names, alt_names, extra) VALUES (?, ?, ?, ?, ?)`,
        row as SqlValue[],
      );
    }

    const meta: [string, string][] = [
      ['content_version', String(bundle.contentVersion)],
      ['schema_version', String(bundle.schemaVersion)],
      ['checksum', bundle.checksum],
      ['seeded_at', String(now())],
    ];
    for (const [key, value] of meta) {
      await db.run('INSERT OR REPLACE INTO content_meta (key, value) VALUES (?, ?)', [key, value]);
    }
  });

  return 'seeded';
}
