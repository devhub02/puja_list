import bundledJson from '../assets/puja_data/content.json';
import {
  addCustomItem,
  createPreparation,
  getChecklistState,
  getPuja,
  listPujas,
  setItemChecked,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';
import { buildEntries } from '@/utils/checklistEntries';
import { formatChecklistText, selectShareEntries } from '@/utils/shareChecklist';
import type { ShareLabels } from '@/utils/shareChecklist';
import { shareLabelsFor } from '@/components/ShareChecklistDialog';
import { SECTION_ORDER } from '@/utils/preparationProgress';

import { createMigratedDb } from '../testing/nodeSqlDb';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { resetSettings } from '../testing/utils';

const bundled = bundledJson as unknown as ContentBundle;

const EN: ShareLabels = {
  sections: {
    REQUIRED: 'Required',
    COMMON: 'Commonly used',
    OPTIONAL: 'Optional',
    CUSTOM: 'My items',
  },
  footer: 'Puja Saathi - Standard disclaimer.',
};
const HI: ShareLabels = {
  sections: {
    REQUIRED: 'आवश्यक',
    COMMON: 'आम तौर पर इस्तेमाल',
    OPTIONAL: 'वैकल्पिक',
    CUSTOM: 'मेरी चीज़ें',
  },
  footer: 'पूजा साथी - मानक सूचना।',
};

async function richState() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle(), () => 1);
  const puja = (await getPuja(db, RICH_ID))!;
  const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'At home' });
  await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
  await setItemChecked(db, prep.id, 'samagri', 'sm_o2', true);
  const mine = await addCustomItem(db, prep.id, { name: 'Camphor' });
  const mine2 = await addCustomItem(db, prep.id, { name: 'Matchbox' });
  await setItemChecked(db, prep.id, 'custom', mine2.id, true);
  expect(mine.id).toBeTruthy();
  const state = (await getChecklistState(db, prep.id))!;
  return { puja, state, entries: buildEntries(puja.samagri, state) };
}

describe('share formatter', () => {
  it('writes name, label, then sections in the fixed order with [ ] / [x] markers and quantity guidance', async () => {
    const { puja, entries } = await richState();
    const text = formatChecklistText({
      pujaName: puja.name,
      label: 'At home',
      entries,
      mode: 'all',
      language: 'en',
      labels: EN,
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('Rich Puja (fixture)');
    expect(lines[1]).toBe('At home');
    expect(lines[2]).toBe('');
    const headings = lines.filter((l) => Object.values(EN.sections).includes(l));
    expect(headings).toEqual(['Required', 'Commonly used', 'Optional', 'My items']);
    expect(text).toContain('[x] Item r1 (fixture) (As needed)');
    expect(text).toContain('[ ] Item r2 (fixture)');
    expect(text).toContain('[ ] Item o1 (fixture) (Quantity per family custom)');
    expect(text).toContain('[x] Item o2 (fixture)');
    expect(text).toContain('[ ] Camphor');
    expect(text).toContain('[x] Matchbox');
    expect(lines[lines.length - 1]).toBe(EN.footer);
    // no purpose / regional / preparation notes in the shared text
    expect(text).not.toMatch(/Purpose of|Followed in some regions|long preparation note/);
  });

  it('writes Hindi names, quantity fallback to English, and the Hindi labels and footer', async () => {
    const { puja, entries } = await richState();
    const text = formatChecklistText({
      pujaName: puja.name,
      label: null,
      entries,
      mode: 'all',
      language: 'hi',
      labels: HI,
    });
    expect(text.split('\n')[0]).toBe('Rich Puja (परीक्षण)');
    expect(text).toContain('आवश्यक');
    expect(text).toContain('[x] Item r1 (परीक्षण) (As needed)'); // quantity has only an English text: falls back
    expect(text.trimEnd().endsWith(HI.footer)).toBe(true);
  });

  it('"only items I still need" leaves out the checked ones and omits sections that become empty', async () => {
    const { puja, entries } = await richState();
    const text = formatChecklistText({
      pujaName: puja.name,
      entries,
      mode: 'needed',
      language: 'en',
      labels: EN,
    });
    expect(text).not.toContain('[x]');
    expect(text).toContain('[ ] Item r2 (fixture)');
    expect(text).not.toContain('Item r1');
    expect(text).not.toContain('Matchbox');
    expect(text).toContain('[ ] Camphor');
  });

  it('omits empty sections and the label line when there is no label', () => {
    const entries = buildEntries([], {
      checkedSamagriIds: [],
      checkedCustomIds: [],
      customItems: [{ id: 'usr_1', name: 'Only mine', note: 'x', createdAt: 1 }],
    });
    const text = formatChecklistText({
      pujaName: { en: 'P' },
      label: '  ',
      entries,
      mode: 'all',
      language: 'en',
      labels: EN,
    });
    expect(text).toBe(['P', '', 'My items', '[ ] Only mine', '', EN.footer].join('\n'));
  });

  it('a puja whose items are all checked, in needed mode, has only the header and footer', async () => {
    const { puja, entries } = await richState();
    const allChecked = entries.map((e) => ({ ...e, checked: true }));
    expect(selectShareEntries(allChecked, 'needed')).toEqual([]);
    const text = formatChecklistText({
      pujaName: puja.name,
      entries: allChecked,
      mode: 'needed',
      language: 'en',
      labels: EN,
    });
    expect(text).toBe(['Rich Puja (fixture)', '', EN.footer].join('\n'));
  });

  it('handles a long list and a custom name containing odd characters', () => {
    const custom = Array.from({ length: 300 }, (_, i) => ({
      id: `usr_${i}`,
      name: `Item ${i} ✓ सामग्री`,
      note: null,
      createdAt: i,
    }));
    const entries = buildEntries([], {
      checkedSamagriIds: [],
      checkedCustomIds: ['usr_7'],
      customItems: custom,
    });
    const text = formatChecklistText({
      pujaName: { en: 'Long' },
      entries,
      mode: 'all',
      language: 'en',
      labels: EN,
    });
    expect(text.split('\n')).toHaveLength(1 + 1 + 1 + 300 + 1 + 1);
    expect(text).toContain('[x] Item 7 ✓');
  });

  it('uses the app locale files for the labels and the standard disclaimer in both languages', async () => {
    await resetSettings('en');
    const en = shareLabelsFor('en');
    expect(SECTION_ORDER.map((s) => en.sections[s])).toEqual([
      'Required',
      'Commonly used',
      'Optional',
      'My items',
    ]);
    expect(en.footer).toMatch(/^Puja Saathi - Vidhi and samagri can differ by region/);
    const hi = shareLabelsFor('hi');
    expect(hi.footer.startsWith('पूजा साथी - विधि और सामग्री क्षेत्र')).toBe(true);
    expect(hi.sections.REQUIRED).not.toBe(en.sections.REQUIRED);
  });
});

describe('REAL content.json', () => {
  it('formats the checklist of EVERY puja, in English and Hindi, without crashing', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, bundled, () => 1);
    const summaries = await listPujas(db);
    expect(summaries).toHaveLength(16);
    for (const summary of summaries) {
      const puja = (await getPuja(db, summary.id))!;
      const prep = await createPreparation(db, { pujaId: puja.id, title: 'Test' });
      // tick the first item and add one custom item so every shape is exercised
      if (puja.samagri[0])
        await setItemChecked(db, prep.id, 'samagri', puja.samagri[0].samagriId, true);
      await addCustomItem(db, prep.id, { name: 'My extra item' });
      const state = (await getChecklistState(db, prep.id))!;
      const entries = buildEntries(puja.samagri, state);
      for (const language of ['en', 'hi'] as const) {
        for (const mode of ['all', 'needed'] as const) {
          const text = formatChecklistText({
            pujaName: puja.name,
            label: state.preparation.title,
            entries,
            mode,
            language,
            labels: language === 'en' ? EN : HI,
          });
          expect(text.split('\n')[0]).toBe(puja.name[language] || puja.name.en);
          expect(text).toContain(language === 'en' ? EN.footer : HI.footer);
          expect(text).toContain('My extra item');
          // every shared item line is a checkbox line and nothing says "undefined"
          expect(text).not.toMatch(/undefined|null|\[object/);
          const itemLines = text.split('\n').filter((l) => /^\[( |x)\] /.test(l));
          const expected = selectShareEntries(entries, mode).length;
          expect(itemLines).toHaveLength(expected);
        }
      }
    }
  });
});
