/**
 * TEST FIXTURE, not real dates and not real festivals.
 * Made-up festivals and dates in the year 2031 that exist only to exercise the Calendar, the repositories
 * and Home. Nothing here is shipped (it lives in testing/, not in content/ or assets/).
 *
 * Layout (all in 2031, device "today" is set by the tests):
 *   alpha  pan_india            deity_festival    2031-03-14 (single day, confirmed) + 2032-03-03 (provisional)
 *   beta   south                harvest_seasonal  2031-03-12 .. 2031-03-16 (multi-day, varies_by_region)
 *   gamma  north + west         vrat_fasting      2031-03-31 .. 2031-04-02 (crosses a month, unknown certainty)
 *   delta  east                 nature_ritual     no date at all ("Date not available")
 *   lamps  pan_india (base)     deity_festival    2031-10-30 .. 2031-11-02 (from makeFixtureBundle), linked puja
 *   old    (deprecated, base)   has a date in March that must never be listed
 */
import type { BundleFestival, ContentBundle, DateCertainty } from '@/db/types';

import { makeFixtureBundle } from './contentFixture';

function festival(
  id: string,
  en: string,
  hi: string,
  overrides: Partial<BundleFestival> = {},
): BundleFestival {
  return {
    id,
    name: { en, hi },
    shortDescription: { en: 'TEST FIXTURE, not real content.', hi: 'परीक्षण, असली सामग्री नहीं।' },
    regions: ['pan_india'],
    category: 'deity_festival',
    dateType: 'lunar',
    linkedPujaIds: [],
    reviewStatus: 'ai_drafted',
    sourceNote: { en: 'TEST FIXTURE, not real content.', hi: 'परीक्षण, असली सामग्री नहीं।' },
    status: 'active',
    ...overrides,
  };
}

let counter = 0;
function entry(festivalId: string, date: string, endDate: string | undefined, certainty: string) {
  counter += 1;
  return {
    id: `cal_fixture_${counter}`,
    festivalId,
    date,
    ...(endDate ? { endDate } : {}),
    certainty: certainty as DateCertainty,
  };
}

export function makeCalendarBundle(): ContentBundle {
  counter = 0;
  const base = makeFixtureBundle();
  return {
    ...base,
    contentVersion: 2,
    checksum: 'sha256:calendar-fixture',
    festivals: [
      ...base.festivals,
      festival('fest_cal_alpha', 'Calendar Test Alpha', 'कैलेंडर परीक्षण अल्फा'),
      festival('fest_cal_beta', 'Calendar Test Beta', 'कैलेंडर परीक्षण बीटा', {
        regions: ['south'],
        category: 'harvest_seasonal',
        observanceDescription: {
          en: 'TEST FIXTURE: check a local panchang for the exact date.',
          hi: 'परीक्षण: सही तारीख़ के लिए स्थानीय पंचांग देखें।',
        },
      }),
      festival('fest_cal_gamma', 'Calendar Test Gamma', 'कैलेंडर परीक्षण गामा', {
        regions: ['north', 'west'],
        category: 'vrat_fasting',
        states: [{ en: 'Test State', hi: 'परीक्षण राज्य' }],
      }),
      festival('fest_cal_delta', 'Calendar Test Delta', 'कैलेंडर परीक्षण डेल्टा', {
        regions: ['east'],
        category: 'nature_ritual',
      }),
    ],
    calendar: [
      {
        year: 2031,
        entries: [
          entry('fest_cal_alpha', '2031-03-14', undefined, 'confirmed'),
          entry('fest_cal_beta', '2031-03-12', '2031-03-16', 'varies_by_region'),
          entry('fest_cal_gamma', '2031-03-31', '2031-04-02', 'mystery'),
          entry('fest_test_old', '2031-03-20', undefined, 'confirmed'),
          { ...base.calendar[0].entries[0] },
        ],
      },
      { year: 2032, entries: [entry('fest_cal_alpha', '2032-03-03', undefined, 'provisional')] },
    ],
  };
}
