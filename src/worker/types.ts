export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  VAULT_MASTER_SECRET: string;
  VAULT_MASTER_SECRET_PREVIOUS?: string;
};

export type VaultItemRow = {
  id: string;
  name: string;
  name_normalized: string;
  type: string;
  provider: string;
  provider_normalized: string;
  category: string;
  category_normalized: string;
  tags_json: string;
  favorite: number;
  ciphertext: string;
  encryption_iv: string;
  encryption_version: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

export type AuditEventRow = {
  id: string;
  action: string;
  item_id: string | null;
  item_name: string | null;
  detail: string;
  created_at: number;
};
