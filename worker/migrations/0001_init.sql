-- Derived index. Markdown+YAML files are canonical; this is rebuilt from them (files win).
-- Migrations are additive-only: never edit or drop in a numbered file; add a new one.
CREATE TABLE entities (
  id   TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE sources (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL REFERENCES entities(id),
  title       TEXT NOT NULL,
  url         TEXT,
  type        TEXT NOT NULL,
  status      TEXT,
  verified_at TEXT,
  body        TEXT NOT NULL DEFAULT ''
);
CREATE TABLE claims (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL REFERENCES entities(id),
  statement   TEXT NOT NULL,
  status      TEXT NOT NULL,
  source_id   TEXT NOT NULL REFERENCES sources(id),
  verified_at TEXT,
  body        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_claims_entity_status ON claims(entity_id, status);
CREATE INDEX idx_sources_entity ON sources(entity_id);
-- Full-text index over claims and sources. Filter columns are UNINDEXED (not tokenised).
CREATE VIRTUAL TABLE search_fts USING fts5(
  id UNINDEXED, entity_id UNINDEXED, type UNINDEXED, text,
  tokenize = 'unicode61'
);
