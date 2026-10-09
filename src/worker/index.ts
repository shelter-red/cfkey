import { Hono, type Context, type Next } from "hono";
import { TEMPLATE_BY_ID } from "../shared/templates";
import type { AuditPage, ItemInput, VaultItemPage, VaultSecretData } from "../shared/types";
import {
  constantTimeEqual,
  createSignedToken,
  decryptSecretData,
  encryptSecretData,
  verifySignedToken,
} from "./crypto";
import type { AuditEventRow, Env, VaultItemRow } from "./types";
import {
  decodeCursor,
  encodeCursor,
  normalizeText,
  searchable,
  tagsFrom,
  toAuditEvent,
  toVaultItem,
} from "./utils";

type Bindings = { Bindings: Env };
const app = new Hono<Bindings>();

const SESSION_COOKIE = "cfkey_session";
const UNLOCK_COOKIE = "cfkey_unlock";
const SESSION_SECONDS = 12 * 60 * 60;
const UNLOCK_SECONDS = 5 * 60;
const MAX_SECRET_BYTES = 64 * 1024;
const loginFailures = new Map<string, { count: number; blockedUntil: number; updatedAt: number }>();

const ITEM_COLUMNS = `id, name, name_normalized, type, provider, provider_normalized,
  category, category_normalized, tags_json, favorite, '' AS ciphertext, '' AS encryption_iv,
  encryption_version, deleted_at, created_at, updated_at`;

function cookieValue(request: Request, name: string): string | undefined {
  const cookies = request.headers.get("cookie") ?? "";
  for (const pair of cookies.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return undefined;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function configuration(env: Env): { ready: boolean; missing: string[] } {
  const missing = ["ADMIN_PASSWORD", "SESSION_SECRET", "VAULT_MASTER_SECRET"].filter((key) => {
    const value = env[key as keyof Env];
    return typeof value !== "string" || value.length < 32;
  });
  return { ready: missing.length === 0, missing };
}

async function hasSession(c: Context<Bindings>): Promise<boolean> {
  return verifySignedToken(c.env.SESSION_SECRET, cookieValue(c.req.raw, SESSION_COOKIE), "session");
}

async function hasUnlock(c: Context<Bindings>): Promise<boolean> {
  return verifySignedToken(c.env.SESSION_SECRET, cookieValue(c.req.raw, UNLOCK_COOKIE), "unlock");
}

async function requireSession(c: Context<Bindings>, next: Next): Promise<Response | void> {
  if (!(await hasSession(c))) return c.json({ code: "AUTH_REQUIRED", message: "请先登录" }, 401);
  await next();
}

function jsonSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function validSecretData(value: unknown): value is VaultSecretData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) return false;
  if (typeof record.notes !== "string") return false;
  return Object.entries(record.fields as Record<string, unknown>).every(
    ([key, field]) => key.length <= 80 && typeof field === "string",
  );
}

function validateInput(payload: ItemInput, requireSecret: boolean) {
  const name = normalizeText(payload.name, 160);
  const type = normalizeText(payload.type, 40);
  if (!name) throw new Error("ITEM_NAME_REQUIRED");
  if (!TEMPLATE_BY_ID.has(type)) throw new Error("ITEM_TYPE_INVALID");
  if (requireSecret && !validSecretData(payload.secretData)) throw new Error("ITEM_SECRET_REQUIRED");
  if (payload.secretData && (!validSecretData(payload.secretData) || jsonSize(payload.secretData) > MAX_SECRET_BYTES)) {
    throw new Error("ITEM_SECRET_TOO_LARGE");
  }
  return {
    name,
    type,
    provider: normalizeText(payload.provider, 120),
    category: normalizeText(payload.category, 80),
    tags: tagsFrom(payload.tags),
    favorite: Boolean(payload.favorite),
    secretData: payload.secretData,
  };
}

async function writeAudit(env: Env, action: string, itemId: string | null, itemName: string | null, detail = "") {
  await env.DB.prepare(
    "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), action, itemId, itemName, detail.slice(0, 160), Date.now()).run();
}

async function cleanupExpired(env: Env): Promise<void> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM audit_event WHERE id IN (SELECT id FROM audit_event WHERE created_at < ? ORDER BY created_at LIMIT 100)",
    ).bind(cutoff),
    env.DB.prepare(
      "DELETE FROM audit_event WHERE id IN (SELECT id FROM audit_event ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET 3000)",
    ),
    env.DB.prepare(
      "DELETE FROM vault_item WHERE id IN (SELECT id FROM vault_item WHERE deleted_at IS NOT NULL AND deleted_at < ? ORDER BY deleted_at LIMIT 100)",
    ).bind(cutoff),
  ]);
}

function maybeCleanup(c: Context<Bindings>) {
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 3) c.executionCtx.waitUntil(cleanupExpired(c.env));
}

function errorResponse(error: unknown, c: Context<Bindings>) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [string, 400 | 404 | 409 | 413 | 500 | 503]> = {
    ITEM_NAME_REQUIRED: ["请输入名称", 400],
    ITEM_TYPE_INVALID: ["密钥类型无效", 400],
    ITEM_SECRET_REQUIRED: ["请填写秘密字段", 400],
    ITEM_SECRET_TOO_LARGE: ["单条密钥内容不能超过 64KB", 413],
    ITEM_NOT_FOUND: ["密钥不存在", 404],
    ITEM_NOT_DELETED: ["只能永久删除回收站中的密钥", 409],
    STRICT_CONFIRMATION_REQUIRED: ["请确认高风险秘密访问", 400],
    FIELD_NOT_FOUND: ["字段不存在", 404],
    VAULT_DECRYPT_FAILED: ["密钥解密失败，请检查部署主密钥", 500],
    CONFIGURATION_INCOMPLETE: ["部署 Secret 配置不完整", 503],
  };
  const descriptor = known[code];
  if (descriptor) return c.json({ code, message: descriptor[0] }, descriptor[1]);
  const errorId = `ERR-${crypto.randomUUID().slice(0, 8)}`;
  console.error("CFKey request failed", { errorId, code, method: c.req.method, path: c.req.path });
  return c.json({ code: "INTERNAL_ERROR", message: `服务暂时不可用（${errorId}）`, errorId }, 500);
}

app.onError(errorResponse);

app.use("/api/*", async (c, next) => {
  const config = configuration(c.env);
  if (!config.ready && c.req.path !== "/api/auth/session") throw new Error("CONFIGURATION_INCOMPLETE");
  await next();
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  };
  for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value);
});

app.get("/api/auth/session", async (c) => {
  const config = configuration(c.env);
  return c.json({ ...config, authenticated: config.ready && (await hasSession(c)) });
});

app.post("/api/auth/login", async (c) => {
  const ip = clientAddress(c.req.raw);
  if (loginFailures.size > 1_000) {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of loginFailures) if (value.updatedAt < cutoff) loginFailures.delete(key);
  }
  const failure = loginFailures.get(ip);
  if (failure?.blockedUntil && failure.blockedUntil > Date.now()) {
    return c.json({ code: "LOGIN_RATE_LIMITED", message: "尝试次数过多，请稍后重试" }, 429);
  }
  const payload = await c.req.json<{ password?: unknown }>();
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!constantTimeEqual(password, c.env.ADMIN_PASSWORD)) {
    const count = (failure?.count ?? 0) + 1;
    loginFailures.set(ip, {
      count,
      blockedUntil: count >= 5 ? Date.now() + Math.min(60_000, 2 ** (count - 5) * 2_000) : 0,
      updatedAt: Date.now(),
    });
    return c.json({ code: "LOGIN_FAILED", message: "密码错误" }, 401);
  }
  loginFailures.delete(ip);
  const token = await createSignedToken(c.env.SESSION_SECRET, "session", SESSION_SECONDS);
  return c.json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, token, SESSION_SECONDS) });
});

app.post("/api/auth/unlock", requireSession, async (c) => {
  const payload = await c.req.json<{ password?: unknown }>();
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!constantTimeEqual(password, c.env.ADMIN_PASSWORD)) {
    return c.json({ code: "UNLOCK_FAILED", message: "密码错误" }, 401);
  }
  const token = await createSignedToken(c.env.SESSION_SECRET, "unlock", UNLOCK_SECONDS);
  return c.json({ ok: true, expiresIn: UNLOCK_SECONDS }, 200, { "set-cookie": cookie(UNLOCK_COOKIE, token, UNLOCK_SECONDS) });
});

app.post("/api/auth/lock", requireSession, (c) => c.json({ ok: true }, 200, { "set-cookie": clearCookie(UNLOCK_COOKIE) }));

app.post("/api/auth/logout", (c) => {
  c.header("set-cookie", clearCookie(SESSION_COOKIE), { append: true });
  c.header("set-cookie", clearCookie(UNLOCK_COOKIE), { append: true });
  return c.json({ ok: true });
});

app.use("/api/items/*", requireSession);
app.use("/api/items", requireSession);
app.use("/api/audit", requireSession);

app.get("/api/items", async (c) => {
  const limit = 31;
  const q = searchable(normalizeText(c.req.query("q"), 50));
  const type = normalizeText(c.req.query("type"), 40);
  const category = searchable(normalizeText(c.req.query("category"), 80));
  const tag = searchable(normalizeText(c.req.query("tag"), 40));
  const favorite = c.req.query("favorite") === "1";
  const trash = c.req.query("trash") === "1";
  const cursor = decodeCursor<{ updatedAt: number; id: string }>(c.req.query("cursor"));
  const clauses = [trash ? "i.deleted_at IS NOT NULL" : "i.deleted_at IS NULL"];
  const bindings: unknown[] = [];

  if (q) {
    clauses.push("((i.name_normalized >= ? AND i.name_normalized < ?) OR (i.provider_normalized >= ? AND i.provider_normalized < ?))");
    bindings.push(q, `${q}\uffff`, q, `${q}\uffff`);
  }
  if (type) { clauses.push("i.type = ?"); bindings.push(type); }
  if (category) { clauses.push("i.category_normalized = ?"); bindings.push(category); }
  if (favorite) clauses.push("i.favorite = 1");
  if (tag) {
    clauses.push("EXISTS (SELECT 1 FROM vault_item_tag t WHERE t.item_id = i.id AND t.tag_normalized = ?)");
    bindings.push(tag);
  }
  if (cursor) {
    clauses.push("(i.updated_at < ? OR (i.updated_at = ? AND i.id < ?))");
    bindings.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  }

  const result = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM vault_item i WHERE ${clauses.join(" AND ")}
     ORDER BY i.updated_at DESC, i.id DESC LIMIT ?`,
  ).bind(...bindings, limit).all<VaultItemRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, 30);
  const last = visible.at(-1);
  const response: VaultItemPage = {
    items: visible.map(toVaultItem),
    nextCursor: rows.length > 30 && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null,
  };
  return c.json(response);
});

app.post("/api/items", async (c) => {
  const input = validateInput(await c.req.json<ItemInput>(), true);
  const id = crypto.randomUUID();
  const now = Date.now();
  const encrypted = await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData!);
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO vault_item (
        id, name, name_normalized, type, provider, provider_normalized, category, category_normalized,
        tags_json, favorite, ciphertext, encryption_iv, encryption_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, input.name, searchable(input.name), input.type, input.provider, searchable(input.provider),
      input.category, searchable(input.category), JSON.stringify(input.tags), input.favorite ? 1 : 0,
      encrypted.ciphertext, encrypted.iv, encrypted.version, now, now,
    ),
    ...input.tags.map((tag) => c.env.DB.prepare(
      "INSERT INTO vault_item_tag (item_id, tag, tag_normalized) VALUES (?, ?, ?)",
    ).bind(id, tag, searchable(tag))),
    c.env.DB.prepare(
      "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, 'ITEM_CREATED', ?, ?, '', ?)",
    ).bind(crypto.randomUUID(), id, input.name, now),
  ];
  await c.env.DB.batch(statements);
  maybeCleanup(c);
  return c.json({ item: { id, ...input, secretData: undefined, deletedAt: null, createdAt: now, updatedAt: now } }, 201);
});

app.get("/api/items/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM vault_item i WHERE i.id = ?`).bind(c.req.param("id")).first<VaultItemRow>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  return c.json({ item: toVaultItem(row) });
});

app.put("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const current = await c.env.DB.prepare("SELECT * FROM vault_item WHERE id = ?").bind(id).first<VaultItemRow>();
  if (!current) throw new Error("ITEM_NOT_FOUND");
  const input = validateInput(await c.req.json<ItemInput>(), false);
  if (input.type !== current.type && !input.secretData) throw new Error("ITEM_SECRET_REQUIRED");
  const now = Date.now();
  const encrypted = input.secretData
    ? await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData)
    : { ciphertext: current.ciphertext, iv: current.encryption_iv, version: current.encryption_version };
  const statements = [
    c.env.DB.prepare(
      `UPDATE vault_item SET name = ?, name_normalized = ?, type = ?, provider = ?, provider_normalized = ?,
       category = ?, category_normalized = ?, tags_json = ?, favorite = ?, ciphertext = ?, encryption_iv = ?,
       encryption_version = ?, updated_at = ? WHERE id = ?`,
    ).bind(
      input.name, searchable(input.name), input.type, input.provider, searchable(input.provider), input.category,
      searchable(input.category), JSON.stringify(input.tags), input.favorite ? 1 : 0, encrypted.ciphertext,
      encrypted.iv, encrypted.version, now, id,
    ),
    c.env.DB.prepare("DELETE FROM vault_item_tag WHERE item_id = ?").bind(id),
    ...input.tags.map((tag) => c.env.DB.prepare(
      "INSERT INTO vault_item_tag (item_id, tag, tag_normalized) VALUES (?, ?, ?)",
    ).bind(id, tag, searchable(tag))),
    c.env.DB.prepare(
      "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, 'ITEM_UPDATED', ?, ?, '', ?)",
    ).bind(crypto.randomUUID(), id, input.name, now),
  ];
  await c.env.DB.batch(statements);
  maybeCleanup(c);
  return c.json({ item: toVaultItem({ ...current, ...{
    name: input.name,
    type: input.type,
    provider: input.provider,
    category: input.category,
    tags_json: JSON.stringify(input.tags),
    favorite: input.favorite ? 1 : 0,
    updated_at: now,
  } }) });
});

app.post("/api/items/:id/access", async (c) => {
  if (!(await hasUnlock(c))) return c.json({ code: "UNLOCK_REQUIRED", message: "请先解锁保险库" }, 403);
  const payload = await c.req.json<{ fieldId?: unknown; purpose?: unknown; confirm?: unknown }>();
  const fieldId = normalizeText(payload.fieldId, 80);
  const purpose = payload.purpose === "edit" ? "edit" : "copy";
  const row = await c.env.DB.prepare("SELECT * FROM vault_item WHERE id = ? AND deleted_at IS NULL")
    .bind(c.req.param("id")).first<VaultItemRow>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  const template = TEMPLATE_BY_ID.get(row.type);
  if (template?.strict && payload.confirm !== true) throw new Error("STRICT_CONFIRMATION_REQUIRED");
  const secrets = [c.env.VAULT_MASTER_SECRET, c.env.VAULT_MASTER_SECRET_PREVIOUS ?? ""];
  const decrypted = await decryptSecretData(secrets, row.id, row.type, row.ciphertext, row.encryption_iv, row.encryption_version);
  if (decrypted.secretIndex > 0) {
    const rotated = await encryptSecretData(c.env.VAULT_MASTER_SECRET, row.id, row.type, decrypted.data);
    c.executionCtx.waitUntil(c.env.DB.prepare(
      "UPDATE vault_item SET ciphertext = ?, encryption_iv = ?, encryption_version = ?, updated_at = ? WHERE id = ?",
    ).bind(rotated.ciphertext, rotated.iv, rotated.version, Date.now(), row.id).run());
  }
  await writeAudit(c.env, purpose === "edit" ? "SECRET_EDIT_OPEN" : "SECRET_ACCESS", row.id, row.name, fieldId || "all");
  maybeCleanup(c);
  if (purpose === "edit") return c.json({ secretData: decrypted.data, expiresIn: UNLOCK_SECONDS });
  if (!fieldId || !(fieldId in decrypted.data.fields)) throw new Error("FIELD_NOT_FOUND");
  return c.json({ value: decrypted.data.fields[fieldId], expiresIn: UNLOCK_SECONDS });
});

app.delete("/api/items/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM vault_item WHERE id = ? AND deleted_at IS NULL")
    .bind(c.req.param("id")).first<{ name: string }>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE vault_item SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, c.req.param("id")),
    c.env.DB.prepare(
      "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, 'ITEM_DELETED', ?, ?, '', ?)",
    ).bind(crypto.randomUUID(), c.req.param("id"), row.name, now),
  ]);
  maybeCleanup(c);
  return c.json({ ok: true });
});

app.post("/api/items/:id/restore", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM vault_item WHERE id = ? AND deleted_at IS NOT NULL")
    .bind(c.req.param("id")).first<{ name: string }>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE vault_item SET deleted_at = NULL, updated_at = ? WHERE id = ?").bind(now, c.req.param("id")),
    c.env.DB.prepare(
      "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, 'ITEM_RESTORED', ?, ?, '', ?)",
    ).bind(crypto.randomUUID(), c.req.param("id"), row.name, now),
  ]);
  maybeCleanup(c);
  return c.json({ ok: true });
});

app.delete("/api/items/:id/permanent", async (c) => {
  const row = await c.env.DB.prepare("SELECT name, deleted_at FROM vault_item WHERE id = ?")
    .bind(c.req.param("id")).first<{ name: string; deleted_at: number | null }>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  if (!row.deleted_at) throw new Error("ITEM_NOT_DELETED");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM vault_item WHERE id = ?").bind(c.req.param("id")),
    c.env.DB.prepare(
      "INSERT INTO audit_event (id, action, item_id, item_name, detail, created_at) VALUES (?, 'ITEM_PURGED', ?, ?, '', ?)",
    ).bind(crypto.randomUUID(), c.req.param("id"), row.name, Date.now()),
  ]);
  maybeCleanup(c);
  return c.json({ ok: true });
});

app.get("/api/audit", async (c) => {
  const cursor = decodeCursor<{ createdAt: number; id: string }>(c.req.query("cursor"));
  const query = cursor
    ? "SELECT * FROM audit_event WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT 31"
    : "SELECT * FROM audit_event ORDER BY created_at DESC, id DESC LIMIT 31";
  const statement = cursor
    ? c.env.DB.prepare(query).bind(cursor.createdAt, cursor.createdAt, cursor.id)
    : c.env.DB.prepare(query);
  const result = await statement.all<AuditEventRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, 30);
  const last = visible.at(-1);
  const response: AuditPage = {
    events: visible.map(toAuditEvent),
    nextCursor: rows.length > 30 && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
  return c.json(response);
});

export default app;
export { cleanupExpired };
