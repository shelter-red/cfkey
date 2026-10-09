export type DatabaseFields = Partial<Record<"engine" | "host" | "port" | "database" | "username" | "password", string>>;

function decodePart(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function buildDatabaseConnectionString(fields: DatabaseFields): string {
  const engine = (fields.engine || "postgresql").trim().toLowerCase().replace(/[^a-z0-9+.-]/g, "");
  const host = fields.host?.trim();
  if (!host) return "";
  const encodedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const user = fields.username?.trim();
  const password = fields.password ?? "";
  const auth = user ? `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ""}@` : "";
  const port = fields.port?.trim() ? `:${fields.port.trim()}` : "";
  const database = fields.database?.trim() ? `/${encodeURIComponent(fields.database.trim())}` : "";
  return `${engine || "postgresql"}://${auth}${encodedHost}${port}${database}`;
}

function parseKeyValueConnectionString(value: string): DatabaseFields {
  const fields: DatabaseFields = {};
  const pairs = /([A-Za-z][A-Za-z0-9 _-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]+))/g;
  for (const match of value.matchAll(pairs)) {
    const key = match[1].trim().toLowerCase().replace(/[ _-]/g, "");
    const entry = match[2] ?? match[3] ?? match[4] ?? "";
    if (["server", "host", "datasource", "address"].includes(key)) fields.host = entry;
    else if (key === "port") fields.port = entry;
    else if (["database", "initialcatalog", "dbname"].includes(key)) fields.database = entry;
    else if (["user", "userid", "username", "uid"].includes(key)) fields.username = entry;
    else if (["password", "pwd"].includes(key)) fields.password = entry;
    else if (["engine", "driver"].includes(key)) fields.engine = entry;
  }
  return fields;
}

export function parseDatabaseConnectionString(value: string): DatabaseFields {
  const raw = value.trim();
  if (!raw) return {};
  try {
    const url = new URL(raw);
    return {
      engine: url.protocol.replace(/:$/, ""),
      username: url.username ? decodePart(url.username) : "",
      password: url.password ? decodePart(url.password) : "",
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port,
      database: url.pathname && url.pathname !== "/" ? decodePart(url.pathname.slice(1)) : "",
    };
  } catch {
    return parseKeyValueConnectionString(raw);
  }
}
