export type Env = {
  DB: D1Database;
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
  tags_json: string;
  favorite: number;
  ciphertext: string;
  encryption_iv: string;
  encryption_version: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

export type VaultItemListRow = Pick<
  VaultItemRow,
  "id" | "name" | "type" | "provider" | "category" | "tags_json" | "favorite" | "deleted_at" | "created_at" | "updated_at"
>;

export type VaultCipherRow = Pick<
  VaultItemRow,
  "id" | "type" | "ciphertext" | "encryption_iv" | "encryption_version"
>;
