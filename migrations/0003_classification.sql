-- Backfill classification for rows created before the cascading category model.
UPDATE vault_item
SET category = CASE type
  WHEN 'api-key' THEN 'development.api-key'
  WHEN 'login' THEN 'account.login'
  WHEN 'database' THEN 'database.legacy'
  WHEN 'object-storage' THEN 'cloud.object-storage'
  WHEN 'ssh' THEN 'cloud.ssh'
  WHEN 'tls' THEN 'cloud.tls'
  WHEN 'cloud' THEN 'cloud.cloud-platform'
  WHEN 'oauth' THEN 'development.oauth'
  WHEN 'webhook' THEN 'development.webhook'
  WHEN 'kubernetes' THEN 'cloud.kubernetes'
  WHEN 'recovery-phrase' THEN 'crypto.recovery-phrase'
  WHEN 'generic' THEN 'other.generic'
  ELSE 'other.generic'
END
WHERE category IS NULL OR NOT (
  (type = 'api-key' AND category = 'development.api-key')
  OR (type = 'login' AND category = 'account.login')
  OR (type = 'database' AND category IN (
    'database.postgresql', 'database.mysql', 'database.mariadb', 'database.sqlserver',
    'database.oracle', 'database.sqlite', 'database.mongodb', 'database.redis',
    'database.clickhouse', 'database.tidb', 'database.cockroachdb', 'database.opengauss',
    'database.dm', 'database.kingbase', 'database.legacy'
  ))
  OR (type = 'object-storage' AND category = 'cloud.object-storage')
  OR (type = 'ssh' AND category = 'cloud.ssh')
  OR (type = 'tls' AND category = 'cloud.tls')
  OR (type = 'cloud' AND category = 'cloud.cloud-platform')
  OR (type = 'oauth' AND category = 'development.oauth')
  OR (type = 'webhook' AND category = 'development.webhook')
  OR (type = 'kubernetes' AND category = 'cloud.kubernetes')
  OR (type = 'recovery-phrase' AND category = 'crypto.recovery-phrase')
  OR (type = 'generic' AND category = 'other.generic')
);

CREATE INDEX IF NOT EXISTS vault_item_category_idx
ON vault_item(deleted_at, category, updated_at DESC, id DESC);
