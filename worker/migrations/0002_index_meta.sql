-- Records when the derived index was last rebuilt from files.
CREATE TABLE index_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
