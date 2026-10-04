import type { LocaleMap } from '@/i18n/localeMap';

import type { SqlDb } from '../sqlDb';
import type {
  AltNames,
  ChecklistTemplateItem,
  EntityStatus,
  PujaCategory,
  PujaDetail,
  PujaSamagriItem,
  PujaSummary,
  Region,
  RegionalVariation,
  ReviewStatus,
  VidhiStep,
  Classification,
} from '../types';
import { parseJson, parseOptionalJson } from './json';

export type PujaFilter = {
  category?: PujaCategory;
  /** Only pujas whose festival has a bundled date inside this month. No date is ever computed. */
  month?: { year: number; month: number };
  /** Deprecated pujas are hidden unless asked for. */
  includeDeprecated?: boolean;
};

type PujaRow = {
  id: string;
  festival_id: string | null;
  name_json: string;
  alt_names_json: string | null;
  category: PujaCategory;
  regions_json: string;
  summary_json: string;
  significance_json: string;
  review_status: ReviewStatus;
  source_note_json: string;
  disclaimer_json: string | null;
  content_version: number;
  status: EntityStatus;
};

function toSummary(row: PujaRow): PujaSummary {
  return {
    id: row.id,
    festivalId: row.festival_id ?? undefined,
    name: parseJson<LocaleMap>(row.name_json),
    alternateNames: parseOptionalJson<AltNames>(row.alt_names_json),
    category: row.category,
    regions: parseJson<Region[]>(row.regions_json),
    summary: parseJson<LocaleMap>(row.summary_json),
    reviewStatus: row.review_status,
    status: row.status,
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Lists pujas, ordered by English name. */
export async function listPujas(db: SqlDb, filter: PujaFilter = {}): Promise<PujaSummary[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!filter.includeDeprecated) where.push(`status = 'active'`);
  if (filter.category) {
    where.push('category = ?');
    params.push(filter.category);
  }
  if (filter.month) {
    // ISO dates compare correctly as strings; "-31" is an upper bound for every month.
    const prefix = `${filter.month.year}-${pad(filter.month.month)}`;
    where.push(
      `festival_id IN (SELECT festival_id FROM calendar_date WHERE date <= ? AND COALESCE(end_date, date) >= ?)`,
    );
    params.push(`${prefix}-31`, `${prefix}-01`);
  }
  const rows = await db.all<PujaRow>(
    `SELECT * FROM puja ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY json_extract(name_json, '$.en') COLLATE NOCASE, id`,
    params,
  );
  return rows.map(toSummary);
}

/** One puja with its samagri (in sortOrder), steps (in order), regional variations and checklist. */
export async function getPuja(db: SqlDb, id: string): Promise<PujaDetail | null> {
  const [row] = await db.all<PujaRow>('SELECT * FROM puja WHERE id = ?', [id]);
  if (!row) return null;

  const samagriRows = await db.all<{
    samagri_id: string;
    classification: Classification;
    purpose_json: string;
    quantity_guidance_json: string | null;
    preparation_note_json: string | null;
    regional_note_json: string | null;
    sort_order: number;
    name_json: string;
    description_json: string | null;
  }>(
    `SELECT ps.*, s.name_json, s.description_json
       FROM puja_samagri ps JOIN samagri s ON s.id = ps.samagri_id
      WHERE ps.puja_id = ? ORDER BY ps.sort_order`,
    [id],
  );
  const stepRows = await db.all<{
    id: string;
    step_number: number;
    title_json: string;
    description_json: string;
    related_samagri_ids_json: string;
    is_optional: number;
    important_note_json: string | null;
  }>('SELECT * FROM vidhi_step WHERE puja_id = ? ORDER BY step_number', [id]);
  const variationRows = await db.all<{
    id: string;
    regions_json: string;
    title_json: string;
    description_json: string;
    affects_step_ids_json: string | null;
    affects_samagri_ids_json: string | null;
  }>('SELECT * FROM regional_variation WHERE puja_id = ? ORDER BY id', [id]);
  const checklistRows = await db.all<{ id: string; text_json: string; days_before: number }>(
    'SELECT * FROM checklist_template WHERE puja_id = ? ORDER BY days_before DESC, id',
    [id],
  );

  const samagri: PujaSamagriItem[] = samagriRows.map((r) => ({
    samagriId: r.samagri_id,
    name: parseJson<LocaleMap>(r.name_json),
    description: parseOptionalJson<LocaleMap>(r.description_json),
    classification: r.classification,
    purpose: parseJson<LocaleMap>(r.purpose_json),
    quantityGuidance: parseOptionalJson<LocaleMap>(r.quantity_guidance_json),
    preparationNote: parseOptionalJson<LocaleMap>(r.preparation_note_json),
    regionalNote: parseOptionalJson<LocaleMap>(r.regional_note_json),
    sortOrder: r.sort_order,
  }));
  const steps: VidhiStep[] = stepRows.map((r) => ({
    id: r.id,
    stepNumber: r.step_number,
    title: parseJson<LocaleMap>(r.title_json),
    description: parseJson<LocaleMap>(r.description_json),
    relatedSamagriIds: parseJson<string[]>(r.related_samagri_ids_json),
    isOptional: r.is_optional === 1,
    importantNote: parseOptionalJson<LocaleMap>(r.important_note_json),
  }));
  const variations: RegionalVariation[] = variationRows.map((r) => ({
    id: r.id,
    regions: parseJson<Region[]>(r.regions_json),
    title: parseJson<LocaleMap>(r.title_json),
    description: parseJson<LocaleMap>(r.description_json),
    affectsStepIds: parseOptionalJson<string[]>(r.affects_step_ids_json) ?? [],
    affectsSamagriIds: parseOptionalJson<string[]>(r.affects_samagri_ids_json) ?? [],
  }));
  const checklist: ChecklistTemplateItem[] = checklistRows.map((r) => ({
    id: r.id,
    text: parseJson<LocaleMap>(r.text_json),
    daysBefore: r.days_before,
  }));

  return {
    ...toSummary(row),
    significance: parseJson<LocaleMap>(row.significance_json),
    sourceNote: parseJson<LocaleMap>(row.source_note_json),
    disclaimer: parseOptionalJson<LocaleMap>(row.disclaimer_json),
    contentVersion: row.content_version,
    samagri,
    steps,
    variations,
    checklist,
  };
}
