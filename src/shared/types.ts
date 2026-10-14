export type SecretFieldKind = "text" | "password" | "textarea" | "url" | "number" | "mnemonic";

export type SecretFieldOption = {
  label: string;
  value: string;
};

export type SecretFieldDefinition = {
  id: string;
  label: string;
  kind: SecretFieldKind;
  required?: boolean;
  sensitive?: boolean;
  copyable?: boolean;
  placeholder?: string;
  options?: SecretFieldOption[];
  hidden?: boolean;
  generate?: "random";
  uploadAccept?: string;
};

export type SecretTemplate = {
  id: string;
  name: string;
  description: string;
  fields: SecretFieldDefinition[];
};

export type VaultSecretData = {
  fields: Record<string, string>;
  notes: string;
};

export type VaultItem = {
  id: string;
  name: string;
  type: string;
  provider: string;
  category: string;
  tags: string[];
  favorite: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VaultItemPage = {
  items: VaultItem[];
  nextCursor: string | null;
};

export type ItemInput = {
  name: string;
  type: string;
  provider?: string;
  category?: string;
  tags?: string[];
  favorite?: boolean;
  secretData?: VaultSecretData;
};
