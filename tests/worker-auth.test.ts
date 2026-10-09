import { describe, expect, it } from "vitest";
import { REQUIRED_SECRET_NAMES } from "../src/shared/config";
import app from "../src/worker/index";
import { createSignedToken, encryptSecretData } from "../src/worker/crypto";
import type { Env, VaultItemRow } from "../src/worker/types";

const env = {
  ADMIN_PASSWORD: "a",
  SESSION_SECRET: "b",
  VAULT_MASTER_SECRET: "c",
  DB: new Proxy({}, { get: () => { throw new Error("AUTH_MUST_NOT_READ_D1"); } }) as D1Database,
} satisfies Env;

describe("stateless authentication", () => {
  it("checks session readiness without reading D1", async () => {
    const response = await app.request("/api/auth/session", {}, env);
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
    const response = await app.request("/api/auth/session", {}, incomplete);

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
    const response = await app.request("/api/items", {}, incomplete);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "CONFIGURATION_INCOMPLETE",
      required: [...REQUIRED_SECRET_NAMES],
      missing: ["ADMIN_PASSWORD"],
    });
  });

  it("logs in against the deployment secret without reading D1", async () => {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("cfkey_session=");
  });

  it("rejects the wrong deployment password", async () => {
    const response = await app.request("/api/auth/login", {
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
    const response = await app.request("/api/items/item-1/access", {
      method: "POST",
      headers: { cookie: `cfkey_session=${token}` },
    }, { ...env, DB: db });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      secretData: { fields: { secret: "visible-after-login" }, notes: "direct detail view" },
    });
    expect(writeCount).toBe(0);
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
    const response = await app.request("/api/items", {
      headers: { cookie: `cfkey_session=${token}` },
    }, { ...env, DB: db });
    const page = await response.json() as { items: unknown[]; nextCursor: string | null };

    expect(response.status).toBe(200);
    expect(limit).toBe(11);
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toBeTruthy();
  });
});
