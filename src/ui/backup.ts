import { base64UrlToBytes } from "@shared/base64-url";
import {
  BACKUP_KDF_ITERATIONS,
  BACKUP_SALT_BYTES,
  deriveBackupKey,
  exportBackupKey,
  parseBackupFile,
  type BackupFile,
} from "@shared/backup";
import { bytesToBase64Url } from "@shared/base64-url";

export type PreparedBackupKey = { key: string; salt: string; iterations: number };

/** Generate a fresh salt and derive the raw backup key that the Worker will use. */
export async function prepareBackupKey(password: string): Promise<PreparedBackupKey> {
  const salt = crypto.getRandomValues(new Uint8Array(BACKUP_SALT_BYTES));
  const key = await deriveBackupKey(password, salt, BACKUP_KDF_ITERATIONS);
  return { key: await exportBackupKey(key), salt: bytesToBase64Url(salt), iterations: BACKUP_KDF_ITERATIONS };
}

/** Re-derive the raw backup key from the parameters recorded inside a backup file. */
export async function deriveKeyFromBackup(password: string, file: BackupFile): Promise<string> {
  const key = await deriveBackupKey(password, base64UrlToBytes(file.kdf.salt), file.kdf.iterations);
  return exportBackupKey(key);
}

export function backupFilename(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `cfkey-backup-${stamp}.cfkey.json`;
}

export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFilename(Date.now());
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseBackupText(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON");
  }
  try {
    return parseBackupFile(parsed);
  } catch {
    throw new Error("备份文件格式无效，请选择 CFKey 导出的备份");
  }
}
