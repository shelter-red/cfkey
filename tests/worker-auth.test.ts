import { describe, expect, it } from "vitest";
import app from "../src/worker/index";
import type { Env } from "../src/worker/types";

const env = {
  ADMIN_PASSWORD: "a".repeat(32),
  SESSION_SECRET: "b".repeat(32),
  VAULT_MASTER_SECRET: "c".repeat(32),
  DB: new Proxy({}, { get: () => { throw new Error("AUTH_MUST_NOT_READ_D1"); } }) as D1Database,
  ASSETS: {} as Fetcher,
} satisfies Env;

describe("stateless authentication", () => {
  it("checks session readiness without reading D1", async () => {
    const response = await app.request("/api/auth/session", {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true, missing: [], authenticated: false });
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
});
