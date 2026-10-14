import { base64UrlToBytes, bytesToBase64Url } from "./base64-url";
import type { VaultSecretData } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const BACKUP_FORMAT = "cfkey.backup";
export const BACKUP_VERSION = 1;
export const BACKUP_CIPHER = "AES-256-GCM";
export const BACKUP_KDF_NAME = "PBKDF2-SHA256";
export const BACKUP_AAD = "cfkey:backup:v1";
export const BACKUP_KDF_ITERATIONS = 250_000;
export const BACKUP_MIN_ITERATIONS = 1_000;
export const BACKUP_MAX_ITERATIONS = 2_000_000;
export const BACKUP_SALT_BYTES = 16;
export const BACKUP_KEY_BYTES = 32;
export const BACKUP_MAX_ITEMS = 1_000;
export const BACKUP_MAX_BYTES = 8 * 1024 * 1024;

export type BackupKdf = {
  name: typeof BACKUP_KDF_NAME;
  salt: string;
  iterations: number;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: number;
  kdf: BackupKdf;
  cipher: typeof BACKUP_CIPHER;
  iv: string;
  itemCount: number;
  ciphertext: string;
};

export type BackupItem = {
  id: string;
  name: string;
  type: string;
  provider: string;
  category: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  secretData: VaultSecretData;
};

export type BackupPayload = {
  items: BackupItem[];
};

export type ImportMode = "merge" | "overwrite";

const BASE64_URL = /^[A-Za-z0-9_-]+$/;

export function isBase64Url(value: string): boolean {
  return value.length > 0 && BASE64_URL.test(value);
}

export async function deriveBackupKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: BACKUP_KEY_BYTES * 8 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportBackupKey(key: CryptoKey): Promise<string> {
  const raw = (await crypto.subtle.exportKey("raw", key)) as ArrayBuffer;
  return bytesToBase64Url(new Uint8Array(raw));
}

export async function importBackupKey(raw: string): Promise<CryptoKey> {
  const bytes = base64UrlToBytes(raw);
  if (bytes.byteLength !== BACKUP_KEY_BYTES) throw new Error("BACKUP_PARAMS_INVALID");
  return crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptBackupPayload(key: CryptoKey, payload: BackupPayload): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(BACKUP_AAD) as BufferSource },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return { iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(encrypted)) };
}

export async function decryptBackupPayload(key: CryptoKey, iv: string, ciphertext: string): Promise<unknown> {
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(iv) as BufferSource, additionalData: encoder.encode(BACKUP_AAD) as BufferSource },
      key,
      base64UrlToBytes(ciphertext) as BufferSource,
    );
  } catch {
    throw new Error("BACKUP_DECRYPT_FAILED");
  }
  try {
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  } catch {
    throw new Error("BACKUP_PAYLOAD_INVALID");
  }
}

export function parseBackupFile(value: unknown): BackupFile {
  if (!value || typeof value !== "object") throw new Error("BACKUP_FILE_INVALID");
  const record = value as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT || record.version !== BACKUP_VERSION) throw new Error("BACKUP_FILE_INVALID");
  if (record.cipher !== BACKUP_CIPHER) throw new Error("BACKUP_FILE_INVALID");
  const kdf = record.kdf;
  if (!kdf || typeof kdf !== "object") throw new Error("BACKUP_FILE_INVALID");
  const kdfRecord = kdf as Record<string, unknown>;
  if (kdfRecord.name !== BACKUP_KDF_NAME) throw new Error("BACKUP_FILE_INVALID");
  if (typeof kdfRecord.salt !== "string" || !isBase64Url(kdfRecord.salt)) throw new Error("BACKUP_FILE_INVALID");
  const iterations = kdfRecord.iterations;
  if (typeof iterations !== "number" || !Number.isInteger(iterations)) throw new Error("BACKUP_FILE_INVALID");
  if (iterations < BACKUP_MIN_ITERATIONS || iterations > BACKUP_MAX_ITERATIONS) throw new Error("BACKUP_FILE_INVALID");
  if (typeof record.iv !== "string" || !isBase64Url(record.iv)) throw new Error("BACKUP_FILE_INVALID");
  if (typeof record.ciphertext !== "string" || !isBase64Url(record.ciphertext)) throw new Error("BACKUP_FILE_INVALID");
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    kdf: { name: BACKUP_KDF_NAME, salt: kdfRecord.salt, iterations },
    cipher: BACKUP_CIPHER,
    iv: record.iv,
    itemCount: typeof record.itemCount === "number" ? record.itemCount : 0,
    ciphertext: record.ciphertext,
  };
}

export function validateBackupPayload(value: unknown): BackupPayload {
  if (!value || typeof value !== "object") throw new Error("BACKUP_PAYLOAD_INVALID");
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) throw new Error("BACKUP_PAYLOAD_INVALID");
  if (items.length > BACKUP_MAX_ITEMS) throw new Error("BACKUP_TOO_LARGE");
  return { items: items as BackupItem[] };
}

export function backupPayloadSize(payload: BackupPayload): number {
  return encoder.encode(JSON.stringify(payload)).byteLength;
}

export function createBackupFile(artifact: { iv: string; ciphertext: string }, params: { salt: string; iterations: number; itemCount: number }): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    kdf: { name: BACKUP_KDF_NAME, salt: params.salt, iterations: params.iterations },
    cipher: BACKUP_CIPHER,
    iv: artifact.iv,
    itemCount: params.itemCount,
    ciphertext: artifact.ciphertext,
  };
}
