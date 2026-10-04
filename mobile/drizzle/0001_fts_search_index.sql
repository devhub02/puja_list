-- FTS5 search index (derived content, rebuilt by the seed loader; see docs/DB_SCHEMA.md section 5).
-- The default unicode61 tokenizer treats Devanagari vowel signs (Mc) and the virama / anusvara (Mn) as
-- separators, which splits "लक्ष्मी" into fragments. Adding Mn and Mc to the token categories keeps
-- whole Devanagari words intact. remove_diacritics 2 still folds Latin accents.
CREATE VIRTUAL TABLE `search_index` USING fts5(
  `entity_type` UNINDEXED,
  `entity_id` UNINDEXED,
  `names`,
  `alt_names`,
  `extra`,
  tokenize = "unicode61 remove_diacritics 2 categories 'L* N* Co Mn Mc'"
);
