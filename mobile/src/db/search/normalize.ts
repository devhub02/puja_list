/**
 * Text normalisation shared by the index builder and the query builder, so both sides see the same tokens.
 *
 * Deliberately small: NFC (so a matra typed as one or two code points compares equal) and removal of
 * zero-width joiners. Spelling variants (लक्ष्मी / लक्षमी, Lakshmi / Laxmi) are NOT guessed in code; they
 * come from the `alternateNames` field of the content.
 * (Latin accent folding and lower-casing are done by the FTS5 tokenizer itself.)
 */
const ZERO_WIDTH = /[​‌‍﻿]/g;

export function normalizeSearchText(text: string): string {
  return text.normalize('NFC').replace(ZERO_WIDTH, '');
}

/** Characters that never belong inside a search word (ASCII punctuation, quotes and the danda signs). */
const SEPARATORS = /[\s"'`*()[\]{}<>:;,.!?/\\|+=&^~@#$%_\-।॥‘’“”]+/;

const MAX_TERMS = 8;

/**
 * Turns what the user typed into a safe FTS5 MATCH expression: every word becomes a quoted prefix term,
 * all words must match ("lak pu" finds "Lakshmi Puja"). Returns null when there is nothing to search for.
 */
export function buildMatchQuery(input: string): string | null {
  const terms = normalizeSearchText(input)
    .split(SEPARATORS)
    .filter((term) => term.length > 0)
    .slice(0, MAX_TERMS);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(' ');
}
