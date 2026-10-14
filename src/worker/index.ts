import { Hono, type Context, type Next } from "hono";
import {
  BACKUP_KDF_ITERATIONS,
  BACKUP_MAX_BYTES,
  BACKUP_MAX_ITEMS,
  BACKUP_MAX_ITERATIONS,
  BACKUP_MIN_ITERATIONS,
  backupPayloadSize,
  createBackupFile,
  decryptBackupPayload,
  encryptBackupPayload,
  importBackupKey,
  isBase64Url,
  parseBackupFile,
  validateBackupPayload,
  type BackupItem,
  type BackupPayload,
  type ImportMode,
} from "../shared/backup";
import { REQUIRED_SECRET_NAMES } from "../shared/config";
import { TEMPLATE_BY_ID } from "../shared/templates";
import type { ItemInput, VaultItemPage, VaultSecretData } from "../shared/types";
import {
  constantTimeEqual,
  createSignedToken,
  decryptSecretData,
  encryptSecretData,
  verifySignedToken,
} from "./crypto";
import type { Env, VaultCipherRow, VaultItemListRow, VaultItemRow } from "./types";
import {
  decodeCursor,
  encodeCursor,
  normalizeText,
  searchable,
  tagsFrom,
  toVaultItem,
} from "./utils";

type Bindings = { Bindings: Env };
const app = new Hono<Bindings>();

const SESSION_COOKIE = "cfkey_session";
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_SECRET_BYTES = 64 * 1024;
const loginFailures = new Map<string, { count: number; blockedUntil: number; updatedAt: number }>();

const ITEM_COLUMNS = "id, name, type, provider, category, tags_json, favorite, deleted_at, created_at, updated_at";

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

function httpsRedirect(request: Request): Response | null {
  const target = new URL(request.url);
  if (target.protocol !== "http:") return null;
  target.protocol = "https:";
  return new Response(null, {
    status: 308,
    headers: { "cache-control": "no-store", location: target.toString() },
  });
}

function configuration(env: Env): { ready: boolean; missing: string[] } {
  const missing = REQUIRED_SECRET_NAMES.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.length === 0;
  });
  return { ready: missing.length === 0, missing };
}

async function hasSession(c: Context<Bindings>): Promise<boolean> {
  return verifySignedToken(c.env.SESSION_SECRET, cookieValue(c.req.raw, SESSION_COOKIE));
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

function errorResponse(error: unknown, c: Context<Bindings>) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [string, 400 | 404 | 409 | 413 | 500 | 503]> = {
    ITEM_NAME_REQUIRED: ["请输入名称", 400],
    ITEM_TYPE_INVALID: ["密钥类型无效", 400],
    ITEM_SECRET_REQUIRED: ["请填写密钥字段", 400],
    ITEM_SECRET_TOO_LARGE: ["单条密钥内容不能超过 64KB", 413],
    ITEM_NOT_FOUND: ["密钥不存在", 404],
    ITEM_NOT_DELETED: ["只能永久删除回收站中的密钥", 409],
    VAULT_DECRYPT_FAILED: ["密钥解密失败，请检查部署主密钥", 500],
    CONFIGURATION_INCOMPLETE: ["部署密钥配置不完整", 503],
    BACKUP_KEY_REQUIRED: ["缺少备份密钥", 400],
    BACKUP_PARAMS_INVALID: ["备份密钥或参数无效", 400],
    BACKUP_FILE_INVALID: ["备份文件格式无效，只能导入 CFKey 导出的备份", 400],
    BACKUP_DECRYPT_FAILED: ["备份口令错误或文件已损坏", 400],
    BACKUP_PAYLOAD_INVALID: ["备份内容无效", 400],
    BACKUP_TOO_LARGE: ["备份内容超过导入上限", 413],
    BACKUP_MODE_INVALID: ["导入方式无效", 400],
  };
  const descriptor = known[code];
  if (descriptor) {
    const detail = code === "CONFIGURATION_INCOMPLETE"
      ? { required: [...REQUIRED_SECRET_NAMES], missing: configuration(c.env).missing }
      : {};
    return c.json({ code, message: descriptor[0], ...detail }, descriptor[1]);
  }
  const errorId = `ERR-${crypto.randomUUID().slice(0, 8)}`;
  console.error("CFKey request failed", { errorId, code, method: c.req.method, path: c.req.path });
  return c.json({ code: "INTERNAL_ERROR", message: `服务暂时不可用（${errorId}）`, errorId }, 500);
}

type ValidatedInput = ReturnType<typeof validateInput>;

async function readSecretData(c: Context<Bindings>, row: VaultCipherRow): Promise<VaultSecretData> {
  const secrets = [c.env.VAULT_MASTER_SECRET, c.env.VAULT_MASTER_SECRET_PREVIOUS ?? ""];
  const decrypted = await decryptSecretData(secrets, row.id, row.type, row.ciphertext, row.encryption_iv, row.encryption_version);
  if (decrypted.secretIndex > 0) {
    const rotated = await encryptSecretData(c.env.VAULT_MASTER_SECRET, row.id, row.type, decrypted.data);
    c.executionCtx.waitUntil(c.env.DB.prepare(
      "UPDATE vault_item SET ciphertext = ?, encryption_iv = ?, encryption_version = ? WHERE id = ?",
    ).bind(rotated.ciphertext, rotated.iv, rotated.version, row.id).run());
  }
  return decrypted.data;
}

async function backupKey(raw: string): Promise<CryptoKey> {
  if (!raw) throw new Error("BACKUP_KEY_REQUIRED");
  try {
    return await importBackupKey(raw);
  } catch {
    throw new Error("BACKUP_PARAMS_INVALID");
  }
}

async function existingIds(c: Context<Bindings>, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let index = 0; index < ids.length; index += 90) {
    const chunk = ids.slice(index, index + 90);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await c.env.DB.prepare(`SELECT id FROM vault_item WHERE id IN (${placeholders})`)
      .bind(...chunk).all<{ id: string }>();
    for (const row of result.results ?? []) found.add(row.id);
  }
  return found;
}

function assertImportable(payload: BackupPayload): void {
  if (payload.items.length > BACKUP_MAX_ITEMS) throw new Error("BACKUP_TOO_LARGE");
  if (backupPayloadSize(payload) > BACKUP_MAX_BYTES) throw new Error("BACKUP_TOO_LARGE");
  for (const item of payload.items) {
    if (!item || typeof item !== "object") throw new Error("BACKUP_PAYLOAD_INVALID");
    if (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 80) throw new Error("BACKUP_PAYLOAD_INVALID");
    if (typeof item.name !== "string") throw new Error("BACKUP_PAYLOAD_INVALID");
    if (typeof item.type !== "string" || !TEMPLATE_BY_ID.has(item.type)) throw new Error("BACKUP_PAYLOAD_INVALID");
    if (!validSecretData(item.secretData)) throw new Error("BACKUP_PAYLOAD_INVALID");
    if (jsonSize(item.secretData) > MAX_SECRET_BYTES) throw new Error("BACKUP_PAYLOAD_INVALID");
  }
}

async function insertItem(c: Context<Bindings>, input: ValidatedInput, id: string, createdAt: number, updatedAt: number): Promise<void> {
  const encrypted = await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData!);
  await c.env.DB.prepare(
    `INSERT INTO vault_item (
      id, name, name_normalized, type, provider, provider_normalized, category,
      tags_json, favorite, ciphertext, encryption_iv, encryption_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, input.name, searchable(input.name), input.type, input.provider, searchable(input.provider),
    input.category, JSON.stringify(input.tags), input.favorite ? 1 : 0,
    encrypted.ciphertext, encrypted.iv, encrypted.version, createdAt, updatedAt,
  ).run();
}

async function overwriteItem(c: Context<Bindings>, input: ValidatedInput, id: string, updatedAt: number): Promise<void> {
  const encrypted = await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData!);
  await c.env.DB.prepare(
    `UPDATE vault_item SET name = ?, name_normalized = ?, type = ?, provider = ?, provider_normalized = ?,
     category = ?, tags_json = ?, favorite = ?, ciphertext = ?, encryption_iv = ?,
     encryption_version = ?, updated_at = ? WHERE id = ?`,
  ).bind(
    input.name, searchable(input.name), input.type, input.provider, searchable(input.provider),
    input.category, JSON.stringify(input.tags), input.favorite ? 1 : 0,
    encrypted.ciphertext, encrypted.iv, encrypted.version, updatedAt, id,
  ).run();
}

async function readBackupPayload(c: Context<Bindings>, body: { key?: unknown; file?: unknown }): Promise<{ key: CryptoKey; payload: BackupPayload }> {
  const key = await backupKey(typeof body.key === "string" ? body.key : "");
  const file = parseBackupFile(body.file);
  const payload = validateBackupPayload(await decryptBackupPayload(key, file.iv, file.ciphertext));
  assertImportable(payload);
  return { key, payload };
}

app.onError(errorResponse);

async function apiMiddleware(c: Context<Bindings>, next: Next): Promise<Response | void> {
  const redirect = httpsRedirect(c.req.raw);
  if (redirect) return redirect;
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
}

app.use("/api", apiMiddleware);
app.use("/api/*", apiMiddleware);

app.get("/api/auth/session", async (c) => {
  const config = configuration(c.env);
  return c.json({
    ...config,
    required: [...REQUIRED_SECRET_NAMES],
    authenticated: config.ready && (await hasSession(c)),
  });
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
  const token = await createSignedToken(c.env.SESSION_SECRET, SESSION_SECONDS);
  return c.json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, token, SESSION_SECONDS) });
});

app.post("/api/auth/logout", (c) => {
  return c.json({ ok: true }, 200, { "set-cookie": clearCookie(SESSION_COOKIE) });
});

app.use("/api/items/*", requireSession);
app.use("/api/items", requireSession);
app.use("/api/export", requireSession);
app.use("/api/import/preview", requireSession);
app.use("/api/import", requireSession);

app.get("/api/items", async (c) => {
  const limit = 11;
  const q = searchable(normalizeText(c.req.query("q"), 50));
  const type = normalizeText(c.req.query("type"), 40);
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
  if (favorite) clauses.push("i.favorite = 1");
  if (cursor) {
    clauses.push("(i.updated_at < ? OR (i.updated_at = ? AND i.id < ?))");
    bindings.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
  }

  const result = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM vault_item i WHERE ${clauses.join(" AND ")}
     ORDER BY i.updated_at DESC, i.id DESC LIMIT ?`,
  ).bind(...bindings, limit).all<VaultItemListRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, 10);
  const last = visible.at(-1);
  const response: VaultItemPage = {
    items: visible.map(toVaultItem),
    nextCursor: rows.length > 10 && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null,
  };
  return c.json(response);
});

app.post("/api/items", async (c) => {
  const input = validateInput(await c.req.json<ItemInput>(), true);
  const id = crypto.randomUUID();
  const now = Date.now();
  const encrypted = await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData!);
  await c.env.DB.prepare(
    `INSERT INTO vault_item (
      id, name, name_normalized, type, provider, provider_normalized, category,
      tags_json, favorite, ciphertext, encryption_iv, encryption_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, input.name, searchable(input.name), input.type, input.provider, searchable(input.provider),
    input.category, JSON.stringify(input.tags), input.favorite ? 1 : 0,
    encrypted.ciphertext, encrypted.iv, encrypted.version, now, now,
  ).run();
  return c.json({ item: { id, ...input, secretData: undefined, deletedAt: null, createdAt: now, updatedAt: now } }, 201);
});

app.put("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const input = validateInput(await c.req.json<ItemInput>(), true);
  const now = Date.now();
  const encrypted = await encryptSecretData(c.env.VAULT_MASTER_SECRET, id, input.type, input.secretData!);
  const result = await c.env.DB.prepare(
    `UPDATE vault_item SET name = ?, name_normalized = ?, type = ?, provider = ?, provider_normalized = ?,
     category = ?, tags_json = ?, favorite = ?, ciphertext = ?, encryption_iv = ?,
     encryption_version = ?, updated_at = ? WHERE id = ?`,
  ).bind(
    input.name, searchable(input.name), input.type, input.provider, searchable(input.provider), input.category,
    JSON.stringify(input.tags), input.favorite ? 1 : 0, encrypted.ciphertext,
    encrypted.iv, encrypted.version, now, id,
  ).run();
  if (result.meta.changes === 0) throw new Error("ITEM_NOT_FOUND");
  return c.json({ ok: true });
});

app.patch("/api/items/:id/favorite", async (c) => {
  const payload = await c.req.json<{ favorite?: unknown }>();
  const result = await c.env.DB.prepare("UPDATE vault_item SET favorite = ? WHERE id = ?")
    .bind(payload.favorite === true ? 1 : 0, c.req.param("id")).run();
  if (result.meta.changes === 0) throw new Error("ITEM_NOT_FOUND");
  return c.json({ ok: true });
});

app.post("/api/items/:id/access", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, type, ciphertext, encryption_iv, encryption_version FROM vault_item WHERE id = ? AND deleted_at IS NULL",
  ).bind(c.req.param("id")).first<VaultCipherRow>();
  if (!row) throw new Error("ITEM_NOT_FOUND");
  return c.json({ secretData: await readSecretData(c, row) });
});

app.delete("/api/items/:id", async (c) => {
  const now = Date.now();
  const result = await c.env.DB.prepare("UPDATE vault_item SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(now, now, c.req.param("id")).run();
  if (result.meta.changes === 0) throw new Error("ITEM_NOT_FOUND");
  return c.json({ ok: true });
});

app.post("/api/items/:id/restore", async (c) => {
  const now = Date.now();
  const result = await c.env.DB.prepare("UPDATE vault_item SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL")
    .bind(now, c.req.param("id")).run();
  if (result.meta.changes === 0) throw new Error("ITEM_NOT_FOUND");
  return c.json({ ok: true });
});

app.delete("/api/items/:id/permanent", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM vault_item WHERE id = ? AND deleted_at IS NOT NULL")
    .bind(c.req.param("id")).run();
  if (result.meta.changes === 0) throw new Error("ITEM_NOT_DELETED");
  return c.json({ ok: true });
});

app.post("/api/export", async (c) => {
  const body = await c.req.json<{ key?: unknown; salt?: unknown; iterations?: unknown }>()
    .catch(() => ({}) as { key?: unknown; salt?: unknown; iterations?: unknown });
  const salt = typeof body.salt === "string" ? body.salt : "";
  const iterations = typeof body.iterations === "number" ? body.iterations : BACKUP_KDF_ITERATIONS;
  if (!isBase64Url(salt) || !Number.isInteger(iterations)
    || iterations < BACKUP_MIN_ITERATIONS || iterations > BACKUP_MAX_ITERATIONS) {
    throw new Error("BACKUP_PARAMS_INVALID");
  }
  const key = await backupKey(typeof body.key === "string" ? body.key : "");

  const result = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS}, ciphertext, encryption_iv, encryption_version FROM vault_item
     WHERE deleted_at IS NULL ORDER BY updated_at DESC, id DESC`,
  ).all<VaultItemRow>();
  const rows = result.results ?? [];
  const items: BackupItem[] = [];
  for (const row of rows) {
    const item = toVaultItem(row);
    items.push({
      id: item.id,
      name: item.name,
      type: item.type,
      provider: item.provider,
      category: item.category,
      tags: item.tags,
      favorite: item.favorite,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      secretData: await readSecretData(c, row),
    });
  }

  const payload: BackupPayload = { items };
  if (backupPayloadSize(payload) > BACKUP_MAX_BYTES) throw new Error("BACKUP_TOO_LARGE");
  const artifact = await encryptBackupPayload(key, payload);
  return c.json(createBackupFile(artifact, { salt, iterations, itemCount: items.length }));
});

app.post("/api/import/preview", async (c) => {
  const body = await c.req.json<{ key?: unknown; file?: unknown }>()
    .catch(() => ({}) as { key?: unknown; file?: unknown });
  const { payload } = await readBackupPayload(c, body);
  const ids = payload.items.map((item) => item.id);
  const existing = await existingIds(c, ids);
  return c.json({
    itemCount: payload.items.length,
    conflicting: ids.filter((id) => existing.has(id)).length,
    sample: payload.items.slice(0, 20).map((item) => ({
      name: item.name,
      type: item.type,
      conflict: existing.has(item.id),
    })),
  });
});

app.post("/api/import", async (c) => {
  const body = await c.req.json<{ key?: unknown; file?: unknown; mode?: unknown }>()
    .catch(() => ({}) as { key?: unknown; file?: unknown; mode?: unknown });
  const mode: ImportMode | null = body.mode === "merge" || body.mode === "overwrite" ? body.mode : null;
  if (!mode) throw new Error("BACKUP_MODE_INVALID");
  const { payload } = await readBackupPayload(c, body);

  const now = Date.now();
  const existing = mode === "overwrite" ? await existingIds(c, payload.items.map((item) => item.id)) : new Set<string>();
  let created = 0;
  let overwritten = 0;
  let failed = 0;

  for (const item of payload.items) {
    try {
      const input = validateInput({
        name: item.name,
        type: item.type,
        provider: item.provider,
        category: item.category,
        tags: item.tags,
        favorite: item.favorite,
        secretData: item.secretData,
      }, true);
      const createdAt = typeof item.createdAt === "number" && item.createdAt > 0 ? item.createdAt : now;
      const updatedAt = typeof item.updatedAt === "number" && item.updatedAt > 0 ? item.updatedAt : now;
      if (mode === "overwrite" && existing.has(item.id)) {
        await overwriteItem(c, input, item.id, now);
        overwritten += 1;
      } else {
        await insertItem(c, input, mode === "overwrite" ? item.id : crypto.randomUUID(), createdAt, updatedAt);
        created += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("CFKey import item failed", { code: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    }
  }

  return c.json({ created, overwritten, failed });
});

export default app;
