import { buildMatchQuery, normalizeSearchText } from '@/db/search/normalize';

describe('search query builder', () => {
  it('quotes every word as a prefix term', () => {
    expect(buildMatchQuery('lak pu')).toBe('"lak"* "pu"*');
    expect(buildMatchQuery('  लक्ष्मी   पूजा ')).toBe('"लक्ष्मी"* "पूजा"*');
  });

  it('strips FTS syntax and punctuation, including the Devanagari danda', () => {
    expect(buildMatchQuery('lak" OR (x)*')).toBe('"lak"* "OR"* "x"*');
    expect(buildMatchQuery('पूजा।')).toBe('"पूजा"*');
  });

  it('returns null when nothing searchable is left', () => {
    expect(buildMatchQuery('')).toBeNull();
    expect(buildMatchQuery(' "* () ')).toBeNull();
  });

  it('caps the number of terms', () => {
    expect(buildMatchQuery('a b c d e f g h i j')?.split(' ')).toHaveLength(8);
  });

  it('normalises to NFC and drops zero-width joiners', () => {
    expect(normalizeSearchText('क‍्ष')).toBe('क्ष');
    expect(normalizeSearchText('é')).toBe('é');
  });
});
