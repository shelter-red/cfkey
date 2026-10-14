import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url } from "../src/shared/base64-url";
import {
  BACKUP_FORMAT,
  BACKUP_KDF_ITERATIONS,
  BACKUP_MAX_ITERATIONS,
  BACKUP_MIN_ITERATIONS,
  BACKUP_VERSION,
  backupPayloadSize,
  createBackupFile,
  decryptBackupPayload,
  deriveBackupKey,
  encryptBackupPayload,
  exportBackupKey,
  importBackupKey,
  parseBackupFile,
  validateBackupPayload,
  type BackupPayload,
} from "../src/shared/backup";

const payload: BackupPayload = {
  items: [{
    id: "item-1",
    name: "示例",
    type: "generic",
    provider: "",
    category: "",
    tags: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 2,
    secretData: { fields: { secret: "value" }, notes: "" },
  }],
};

const salt = new Uint8Array(16).fill(7);

async function keyFrom(password: string) {
  return deriveBackupKey(password, salt, BACKUP_MIN_ITERATIONS);
}

describe("backup encryption", () => {
  it("round trips a payload with a password-derived key", async () => {
    const key = await keyFrom("correct horse battery staple");
    const artifact = await encryptBackupPayload(key, payload);
    expect(await decryptBackupPayload(key, artifact.iv, artifact.ciphertext)).toEqual(payload);
  });

  it("reimports an exported worker key", async () => {
    const key = await keyFrom("shared password");
    const raw = await exportBackupKey(key);
    const reimported = await importBackupKey(raw);
    const artifact = await encryptBackupPayload(reimported, payload);
    expect(await decryptBackupPayload(key, artifact.iv, artifact.ciphertext)).toEqual(payload);
  });

  it("rejects a wrong password without leaking plaintext", async () => {
    const key = await keyFrom("right password");
    const wrong = await keyFrom("wrong password");
    const artifact = await encryptBackupPayload(key, payload);
    await expect(decryptBackupPayload(wrong, artifact.iv, artifact.ciphertext)).rejects.toThrow("BACKUP_DECRYPT_FAILED");
  });

  it("rejects tampered ciphertext via the GCM tag", async () => {
    const key = await keyFrom("tamper test");
    const artifact = await encryptBackupPayload(key, payload);
    const bytes = base64UrlToBytes(artifact.ciphertext);
    bytes[0] ^= 0xff;
    await expect(decryptBackupPayload(key, artifact.iv, bytesToBase64Url(bytes))).rejects.toThrow("BACKUP_DECRYPT_FAILED");
  });

  it("only reimports oversized keys that match the expected length", async () => {
    await expect(importBackupKey(bytesToBase64Url(new Uint8Array(16)))).rejects.toThrow("BACKUP_PARAMS_INVALID");
  });
});

describe("backup envelope", () => {
  function validFile() {
    return createBackupFile(
      { iv: bytesToBase64Url(new Uint8Array(12).fill(1)), ciphertext: bytesToBase64Url(new Uint8Array(20).fill(2)) },
      { salt: bytesToBase64Url(salt), iterations: BACKUP_KDF_ITERATIONS, itemCount: 1 },
    );
  }

  it("stamps the proprietary format so foreign JSON is rejected", () => {
    const file = validFile();
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.kdf.name).toBe("PBKDF2-SHA256");
    expect(parseBackupFile(file).itemCount).toBe(1);
    expect(() => parseBackupFile({})).toThrow("BACKUP_FILE_INVALID");
    expect(() => parseBackupFile({ format: "something.else" })).toThrow("BACKUP_FILE_INVALID");
  });

  it("rejects unexpected format, version, cipher and KDF fields", () => {
    const file = validFile();
    expect(() => parseBackupFile({ ...file, format: "other" })).toThrow("BACKUP_FILE_INVALID");
    expect(() => parseBackupFile({ ...file, version: 2 })).toThrow("BACKUP_FILE_INVALID");
    expect(() => parseBackupFile({ ...file, cipher: "AES-128-GCM" })).toThrow("BACKUP_FILE_INVALID");
    expect(() => parseBackupFile({ ...file, kdf: { ...file.kdf, name: "scrypt" } })).toThrow("BACKUP_FILE_INVALID");
  });

  it("bounds the KDF iteration count", () => {
    const file = validFile();
    expect(() => parseBackupFile({ ...file, kdf: { ...file.kdf, iterations: BACKUP_MIN_ITERATIONS - 1 } })).toThrow("BACKUP_FILE_INVALID");
    expect(() => parseBackupFile({ ...file, kdf: { ...file.kdf, iterations: BACKUP_MAX_ITERATIONS + 1 } })).toThrow("BACKUP_FILE_INVALID");
    expect(parseBackupFile({ ...file, kdf: { ...file.kdf, iterations: BACKUP_MAX_ITERATIONS } }).kdf.iterations).toBe(BACKUP_MAX_ITERATIONS);
  });
});

describe("backup payload limits", () => {
  it("requires an items array", () => {
    expect(() => validateBackupPayload({ items: "nope" })).toThrow("BACKUP_PAYLOAD_INVALID");
    expect(() => validateBackupPayload(null)).toThrow("BACKUP_PAYLOAD_INVALID");
  });

  it("caps the item count", () => {
    expect(() => validateBackupPayload({ items: Array.from({ length: 1_001 }, () => ({})) })).toThrow("BACKUP_TOO_LARGE");
  });

  it("measures the encoded size", () => {
    expect(backupPayloadSize(payload)).toBeGreaterThan(0);
  });
});
