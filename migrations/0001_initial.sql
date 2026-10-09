PRAGMA foreign_keys = ON;

CREATE TABLE vault_item (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  name_normalized TEXT NOT NULL,
  type TEXT NOT NULL CHECK (length(type) BETWEEN 1 AND 40),
  provider TEXT NOT NULL DEFAULT '' CHECK (length(provider) <= 120),
  provider_normalized TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 80),
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

CREATE INDEX vault_item_favorite_idx
ON vault_item(deleted_at, favorite, updated_at DESC, id DESC);
