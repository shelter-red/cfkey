import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify, parse } from "jsonc-parser";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const configPath = join(projectRoot, "wrangler.import.jsonc");
const databaseName = "cfkey-db";
const databaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wranglerPath = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

function runWrangler(args, capture = false) {
  const result = spawnSync(wranglerPath, [...args, "--config", configPath], {
    cwd: projectRoot,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  return result;
}

function commandError(result, action) {
  const detail = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  return new Error(`${action} failed${detail ? `:\n${detail}` : ""}`);
}

async function listDatabases() {
  const result = runWrangler(["d1", "list", "--json"], true);
  if (result.status !== 0) throw commandError(result, "Listing D1 databases");
  const value = JSON.parse(result.stdout || "[]");
  if (!Array.isArray(value)) throw new Error("Wrangler returned an invalid D1 database list.");
  return value;
}

export function findDatabaseId(databases, name = databaseName) {
  const database = databases.find((item) => item?.name === name);
  return typeof database?.uuid === "string" && databaseIdPattern.test(database.uuid) ? database.uuid : null;
}

export function renderImportConfig(source, databaseId) {
  if (!databaseIdPattern.test(databaseId)) throw new Error("Wrangler returned an invalid D1 database ID.");
  const errors = [];
  const config = parse(source, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error("wrangler.import.jsonc contains invalid JSONC.");
  const index = config.d1_databases?.findIndex((database) => database?.binding === "DB") ?? -1;
  if (index < 0) throw new Error("wrangler.import.jsonc is missing the DB binding.");
  const edits = modify(source, ["d1_databases", index, "database_id"], databaseId, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  return applyEdits(source, edits);
}

async function ensureDatabase() {
  let databases = await listDatabases();
  let databaseId = findDatabaseId(databases);
  if (!databaseId) {
    console.log(`Creating D1 database ${databaseName}...`);
    const created = runWrangler(["d1", "create", databaseName], true);
    databases = await listDatabases();
    databaseId = findDatabaseId(databases);
    if (!databaseId) throw commandError(created, `Creating D1 database ${databaseName}`);
  } else {
    console.log(`Reusing D1 database ${databaseName}.`);
  }

  const source = await readFile(configPath, "utf8");
  await writeFile(configPath, renderImportConfig(source, databaseId));
}

async function main() {
  await ensureDatabase();
  const migration = runWrangler(["d1", "migrations", "apply", "DB", "--remote"]);
  if (migration.status !== 0) process.exit(migration.status ?? 1);
  const deployment = runWrangler(["deploy"]);
  if (deployment.status !== 0) process.exit(deployment.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
