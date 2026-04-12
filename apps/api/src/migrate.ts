import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

function getSqlDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "sql");
}

export async function runMigrationsIfEnabled(log: (msg: string) => void) {
  const enabled = (process.env.MERGESIGNAL_AUTO_MIGRATE ?? "1") === "1";
  if (!enabled) return;
  await runMigrations(log);
}

async function runMigrations(log: (msg: string) => void) {
  await ensureMigrationsTable();

  const sqlDir = getSqlDir();
  const files = (await readdir(sqlDir))
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));

  const applied = await getAppliedMigrations();

  for (const f of files) {
    if (applied.has(f)) {
      continue;
    }

    await applyFile(sqlDir, f, log);
    await recordMigration(f);
  }
}

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await db.query("SELECT filename FROM _migrations");
  return new Set(rows.map((r: { filename: string }) => r.filename));
}

async function recordMigration(filename: string) {
  await db.query(
    "INSERT INTO _migrations (filename, applied_at) VALUES ($1, NOW()) ON CONFLICT (filename) DO NOTHING",
    [filename],
  );
}

async function applyFile(sqlDir: string, filename: string, log: (msg: string) => void) {
  const full = path.join(sqlDir, filename);
  const sql = await readFile(full, "utf8");
  const trimmed = sql.trim();
  if (!trimmed) return;

  log(`migrate: applying ${filename}`);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(trimmed);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
