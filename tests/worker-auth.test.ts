import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../src/shared/base64-url";
import {
  BACKUP_MIN_ITERATIONS,
  createBackupFile,
  deriveBackupKey,
  encryptBackupPayload,
  exportBackupKey,
  type BackupFile,
  type BackupPayload,
} from "../src/shared/backup";
import { REQUIRED_SECRET_NAMES } from "../src/shared/config";
import app from "../src/worker/index";
import { createSignedToken, decryptSecretData, encryptSecretData } from "../src/worker/crypto";
import type { Env, VaultItemRow } from "../src/worker/types";

const env = {
  ADMIN_PASSWORD: "a",
  SESSION_SECRET: "b",
  VAULT_MASTER_SECRET: "c",
  DB: new Proxy({}, { get: () => { throw new Error("AUTH_MUST_NOT_READ_D1"); } }) as D1Database,
} satisfies Env;

const url = (path: string) => `https://cfkey.test${path}`;

describe("stateless authentication", () => {
  it("checks session readiness without reading D1", async () => {
    const response = await app.request(url("/api/auth/session"), {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ready: true,
      required: [...REQUIRED_SECRET_NAMES],
      missing: [],
      authenticated: false,
    });
  });

  it("reports the exact missing deployment secrets", async () => {
    const incomplete = { ...env, SESSION_SECRET: "", VAULT_MASTER_SECRET: undefined } as unknown as Env;
    const response = await app.request(url("/api/auth/session"), {}, incomplete);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ready: false,
      required: [...REQUIRED_SECRET_NAMES],
      missing: ["SESSION_SECRET", "VAULT_MASTER_SECRET"],
      authenticated: false,
    });
  });

  it("includes missing secrets in protected API errors", async () => {
    const incomplete = { ...env, ADMIN_PASSWORD: "" } satisfies Env;
    const response = await app.request(url("/api/items"), {}, incomplete);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "CONFIGURATION_INCOMPLETE",
      required: [...REQUIRED_SECRET_NAMES],
      missing: ["ADMIN_PASSWORD"],
    });
  });

  it("logs in against the deployment secret without reading D1", async () => {
    const response = await app.request(url("/api/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("cfkey_session=");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("redirects HTTP authentication requests to HTTPS", async () => {
    const response = await app.request("http://cfkey.test/api/auth/login?next=%2F", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }, env);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://cfkey.test/api/auth/login?next=%2F");
  });

  it("rejects the wrong deployment password", async () => {
    const response = await app.request(url("/api/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "test-ip" },
      body: JSON.stringify({ password: "wrong" }),
    }, env);
    expect(response.status).toBe(401);
  });

  it("returns decrypted fields with the login session only", async () => {
    const encrypted = await encryptSecretData(env.VAULT_MASTER_SECRET, "item-1", "generic", {
      fields: { secret: "visible-after-login" },
      notes: "direct detail view",
    });
    const row: VaultItemRow = {
      id: "item-1",
      name: "Example",
      name_normalized: "example",
      type: "generic",
      provider: "",
      provider_normalized: "",
      category: "",
      tags_json: "[]",
      favorite: 0,
      ciphertext: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.version,
      deleted_at: null,
      created_at: 1,
      updated_at: 1,
    };
    let writeCount = 0;
    const db = {
      prepare(sql: string) {
        const statement = {
          bind: (..._values: unknown[]) => statement,
          first: async () => sql.includes("FROM vault_item") ? row : null,
          run: async () => { writeCount += 1; return { success: true }; },
        };
        return statement;
      },
      batch: async () => [],
    } as unknown as D1Database;
    const token = await createSignedToken(env.SESSION_SECRET, 60);
    const response = await app.request(url("/api/items/item-1/access"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}` },
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      secretData: { fields: { secret: "visible-after-login" }, notes: "direct detail view" },
    });
    expect(writeCount).toBe(0);
  });

  it("normalises category leaves and derives the database engine on create", async () => {
    let insertValues: unknown[] = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          bind: (...values: unknown[]) => {
            if (sql.includes("INSERT INTO vault_item")) insertValues = values;
            return statement;
          },
          run: async () => ({ success: true, meta: {} }),
          first: async () => null,
          all: async () => ({ results: [] }),
        };
        return statement;
      },
      batch: async () => [],
    } as unknown as D1Database;
    const token = await createSignedToken(env.SESSION_SECRET, 60);
    const response = await app.request(url("/api/items"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Primary database",
        type: "database",
        category: "database.postgresql",
        secretData: {
          fields: { engine: "mysql", host: "db.example.com", password: "secret" },
          notes: "",
        },
      }),
    }, { ...env, DB: db });

    expect(response.status).toBe(201);
    expect(insertValues[6]).toBe("database.postgresql");
    const id = insertValues[0] as string;
    const ciphertext = insertValues[9] as string;
    const iv = insertValues[10] as string;
    const version = insertValues[11] as number;
    const decrypted = await decryptSecretData([env.VAULT_MASTER_SECRET], id, "database", ciphertext, iv, version);
    expect(decrypted.data.fields.engine).toBe("postgresql");
  });

  it("updates an existing item across templates and re-encrypts with the new type", async () => {
    let updateValues: unknown[] = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          bind: (...values: unknown[]) => {
            if (sql.includes("UPDATE vault_item")) updateValues = values;
            return statement;
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
          first: async () => null,
          all: async () => ({ results: [] }),
        };
        return statement;
      },
      batch: async () => [],
    } as unknown as D1Database;
    const token = await createSignedToken(env.SESSION_SECRET, 60);
    const response = await app.request(url("/api/items/item-1"), {
      method: "PUT",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: "SFTP files",
        type: "ftp",
        category: "server.sftp",
        provider: "",
        tags: ["server"],
        favorite: false,
        secretData: {
          fields: { protocol: "SFTP", host: "files.example.com", username: "deploy", password: "secret" },
          notes: "keep this note",
        },
      }),
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(updateValues[2]).toBe("ftp");
    expect(updateValues[5]).toBe("server.sftp");
    const decrypted = await decryptSecretData(
      [env.VAULT_MASTER_SECRET],
      "item-1",
      "ftp",
      updateValues[8] as string,
      updateValues[9] as string,
      updateValues[10] as number,
    );
    expect(decrypted.data).toEqual({
      fields: { protocol: "SFTP", host: "files.example.com", username: "deploy", password: "secret" },
      notes: "keep this note",
    });
  });

  it("reads only eleven rows to return a ten-item page", async () => {
    const rows = Array.from({ length: 11 }, (_, index): VaultItemRow => ({
      id: `item-${String(20 - index).padStart(2, "0")}`,
      name: `Item ${index}`,
      name_normalized: `item ${index}`,
      type: "generic",
      provider: "",
      provider_normalized: "",
      category: "",
      tags_json: "[]",
      favorite: 0,
      ciphertext: "",
      encryption_iv: "",
      encryption_version: 1,
      deleted_at: null,
      created_at: 100 - index,
      updated_at: 100 - index,
    }));
    let limit: unknown;
    const db = {
      prepare() {
        const statement = {
          bind: (...values: unknown[]) => { limit = values.at(-1); return statement; },
          all: async () => ({ results: rows }),
        };
        return statement;
      },
    } as unknown as D1Database;
    const token = await createSignedToken(env.SESSION_SECRET, 60);
    const response = await app.request(url("/api/items"), {
      headers: { cookie: `cfkey_session=${token}` },
    }, { ...env, DB: db });
    const page = await response.json() as { items: unknown[]; nextCursor: string | null };

    expect(response.status).toBe(200);
    expect(limit).toBe(11);
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toBeTruthy();
  });
});

describe("encrypted backup endpoints", () => {
  const secret = env.VAULT_MASTER_SECRET;

  async function session() {
    return createSignedToken(env.SESSION_SECRET, 60);
  }

  function recordingDb(existing: string[] = [], rows: VaultItemRow[] = []) {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        const statement = {
          bind: (..._values: unknown[]) => statement,
          first: async () => null,
          all: async () => (sql.includes("SELECT id FROM vault_item") ? { results: existing.map((id) => ({ id })) } : { results: rows }),
          run: async () => ({ success: true, meta: {} }),
        };
        return statement;
      },
      batch: async () => [],
    } as unknown as D1Database;
    return { db, statements };
  }

  async function buildBackup(payload: BackupPayload): Promise<{ key: string; file: BackupFile }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveBackupKey("backup password", salt, BACKUP_MIN_ITERATIONS);
    const artifact = await encryptBackupPayload(key, payload);
    const file = createBackupFile(artifact, { salt: bytesToBase64Url(salt), iterations: BACKUP_MIN_ITERATIONS, itemCount: payload.items.length });
    return { key: await exportBackupKey(key), file };
  }

  const item = (id: string, value: string): BackupPayload["items"][number] => ({
    id,
    name: `Imported ${id}`,
    type: "generic",
    provider: "",
    category: "",
    tags: [],
    favorite: false,
    createdAt: 10,
    updatedAt: 20,
    secretData: { fields: { secret: value }, notes: "" },
  });

  it("requires a session for every backup route", async () => {
    for (const path of ["/api/export", "/api/import/preview", "/api/import"]) {
      const response = await app.request(url(path), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }, env);
      expect(response.status, path).toBe(401);
    }
  });

  it("exports a sealed envelope that never contains plaintext", async () => {
    const encrypted = await encryptSecretData(secret, "item-1", "generic", {
      fields: { secret: "SUPER_SECRET_MARKER" },
      notes: "private note",
    });
    const row: VaultItemRow = {
      id: "item-1",
      name: "Example",
      name_normalized: "example",
      type: "generic",
      provider: "",
      provider_normalized: "",
      category: "",
      tags_json: "[]",
      favorite: 0,
      ciphertext: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.version,
      deleted_at: null,
      created_at: 1,
      updated_at: 1,
    };
    const { db } = recordingDb([], [row]);
    const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const key = await exportBackupKey(await deriveBackupKey("pw", new Uint8Array(16), BACKUP_MIN_ITERATIONS));
    const token = await session();

    const response = await app.request(url("/api/export"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, salt, iterations: BACKUP_MIN_ITERATIONS }),
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("SUPER_SECRET_MARKER");
    const file = JSON.parse(text) as BackupFile;
    expect(file.format).toBe("cfkey.backup");
    expect(file.itemCount).toBe(1);
    expect(file.ciphertext.length).toBeGreaterThan(0);
  });

  it("previews how many ids already exist", async () => {
    const { key, file } = await buildBackup({ items: [item("dup-1", "a"), item("new-1", "b")] });
    const { db } = recordingDb(["dup-1"]);
    const token = await session();

    const response = await app.request(url("/api/import/preview"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, file }),
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ itemCount: 2, conflicting: 1 });
  });

  it("merges imports with fresh ids and never overwrites", async () => {
    const { key, file } = await buildBackup({ items: [item("restored-1", "a")] });
    const { db, statements } = recordingDb();
    const token = await session();

    const response = await app.request(url("/api/import"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, file, mode: "merge" }),
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 1, overwritten: 0, failed: 0 });
    expect(statements.some((sql) => sql.includes("INSERT INTO vault_item"))).toBe(true);
    expect(statements.some((sql) => sql.includes("SELECT id FROM vault_item"))).toBe(false);
  });

  it("overwrites matching ids in overwrite mode", async () => {
    const { key, file } = await buildBackup({ items: [item("dup-1", "a")] });
    const { db, statements } = recordingDb(["dup-1"]);
    const token = await session();

    const response = await app.request(url("/api/import"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, file, mode: "overwrite" }),
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 0, overwritten: 1, failed: 0 });
    expect(statements.some((sql) => sql.includes("UPDATE vault_item"))).toBe(true);
  });

  it("rejects a foreign envelope before reading D1", async () => {
    const key = await exportBackupKey(await deriveBackupKey("pw", new Uint8Array(16), BACKUP_MIN_ITERATIONS));
    const token = await session();

    const response = await app.request(url("/api/import"), {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, file: { format: "some.other.format", version: 1 }, mode: "merge" }),
    }, env);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "BACKUP_FILE_INVALID" });
  });
});
