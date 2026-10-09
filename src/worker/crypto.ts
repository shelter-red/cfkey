import type { VaultSecretData } from "../shared/types";
import { base64UrlToBytes, base64UrlToText, bytesToBase64Url, textToBase64Url } from "../shared/base64-url";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HKDF_SALT = encoder.encode("cfkey:vault:v1");
const HKDF_INFO = encoder.encode("vault-item-encryption");

export function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let different = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    different |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return different === 0;
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSignedToken(secret: string, lifetimeSeconds: number): Promise<string> {
  const payload = textToBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + lifetimeSeconds }));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySignedToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!secret || !token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !constantTimeEqual(signature, await hmac(secret, payload))) return false;
  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function deriveVaultKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aad(itemId: string, itemType: string, version = 1): Uint8Array {
  return encoder.encode(`cfkey:item:${version}:${itemId}:${itemType}`);
}

export async function encryptSecretData(
  secret: string,
  itemId: string,
  itemType: string,
  data: VaultSecretData,
): Promise<{ ciphertext: string; iv: string; version: number }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(itemId, itemType) as BufferSource },
    await deriveVaultKey(secret),
    plaintext,
  );
  return { ciphertext: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv), version: 1 };
}

export async function decryptSecretData(
  secrets: string[],
  itemId: string,
  itemType: string,
  ciphertext: string,
  iv: string,
  version = 1,
): Promise<{ data: VaultSecretData; secretIndex: number }> {
  for (let index = 0; index < secrets.length; index += 1) {
    const secret = secrets[index];
    if (!secret) continue;
    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64UrlToBytes(iv) as BufferSource,
          additionalData: aad(itemId, itemType, version) as BufferSource,
        },
        await deriveVaultKey(secret),
        base64UrlToBytes(ciphertext) as BufferSource,
      );
      return { data: JSON.parse(decoder.decode(plaintext)) as VaultSecretData, secretIndex: index };
    } catch {
      // Try the previous deployment secret when rotation is in progress.
    }
  }
  throw new Error("VAULT_DECRYPT_FAILED");
}
