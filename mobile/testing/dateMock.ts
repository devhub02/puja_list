/**
 * Test-only stand-in for '@/utils/dateUtils' that lets a test choose the device's "today" (a plain YYYY-MM-DD).
 * Use via jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock). All other helpers
 * are the real ones.
 */
let today = '2026-10-04';

export function setToday(iso: string) {
  today = iso;
}

export const dateMock = {
  ...jest.requireActual('../src/utils/dateUtils'),
  localIsoDate: () => today,
};
