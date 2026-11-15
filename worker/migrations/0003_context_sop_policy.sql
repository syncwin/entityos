-- Contexts, SOPs and policies: Markdown files are canonical; these tables are derived (files win). Additive only.
CREATE TABLE contexts (
  id        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  title     TEXT NOT NULL,
  status    TEXT NOT NULL,
  updated   TEXT NOT NULL,
  body      TEXT NOT NULL DEFAULT ''
);
CREATE TABLE sops (
  id        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  title     TEXT NOT NULL,
  status    TEXT NOT NULL,
  updated   TEXT NOT NULL,
  body      TEXT NOT NULL DEFAULT ''
);
CREATE TABLE policies (
  id        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  title     TEXT NOT NULL,
  status    TEXT NOT NULL,
  updated   TEXT NOT NULL,
  body      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_contexts_entity ON contexts(entity_id);
CREATE INDEX idx_sops_entity ON sops(entity_id);
CREATE INDEX idx_policies_entity ON policies(entity_id);
