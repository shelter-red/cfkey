import type { VaultItem } from "../shared/types";
import { base64UrlToText, textToBase64Url } from "../shared/base64-url";
import type { VaultItemListRow } from "./types";

export function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().normalize("NFKC").slice(0, maxLength) : "";
}

export function searchable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export function tagsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    const tag = normalizeText(item, 40);
    const key = searchable(tag);
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

function parseTags(value: string): string[] {
  try {
    return tagsFrom(JSON.parse(value));
  } catch {
    return [];
  }
}

export function toVaultItem(row: VaultItemListRow): VaultItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    provider: row.provider,
    category: row.category,
    tags: parseTags(row.tags_json),
    favorite: Boolean(row.favorite),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function encodeCursor(value: { updatedAt?: number; createdAt?: number; id: string }): string {
  return textToBase64Url(JSON.stringify(value));
}

export function decodeCursor<T extends { id: string }>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(value)) as T;
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}
