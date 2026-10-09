PRAGMA foreign_keys = ON;

CREATE TABLE vault_item (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  name_normalized TEXT NOT NULL,
  type TEXT NOT NULL CHECK (length(type) BETWEEN 1 AND 40),
  provider TEXT NOT NULL DEFAULT '' CHECK (length(provider) <= 120),
  provider_normalized TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 80),
  category_normalized TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  ciphertext TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX vault_item_list_idx
ON vault_item(deleted_at, updated_at DESC, id DESC);

CREATE INDEX vault_item_name_idx
ON vault_item(deleted_at, name_normalized, updated_at DESC, id DESC);

CREATE INDEX vault_item_provider_idx
ON vault_item(deleted_at, provider_normalized, updated_at DESC, id DESC);

CREATE INDEX vault_item_type_idx
ON vault_item(deleted_at, type, updated_at DESC, id DESC);

CREATE INDEX vault_item_category_idx
ON vault_item(deleted_at, category_normalized, updated_at DESC, id DESC);

CREATE INDEX vault_item_favorite_idx
ON vault_item(deleted_at, favorite, updated_at DESC, id DESC);

CREATE TABLE vault_item_tag (
  item_id TEXT NOT NULL REFERENCES vault_item(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (length(tag) BETWEEN 1 AND 40),
  tag_normalized TEXT NOT NULL,
  PRIMARY KEY (item_id, tag_normalized)
);

CREATE INDEX vault_item_tag_lookup_idx
ON vault_item_tag(tag_normalized, item_id);

CREATE TABLE audit_event (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX audit_event_time_idx
ON audit_event(created_at DESC, id DESC);

CREATE TABLE schema_migration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
