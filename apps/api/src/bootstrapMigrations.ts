#!/usr/bin/env node
import "dotenv/config";
import { db } from "./db.js";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function bootstrapMigrations() {
  console.log("Bootstrapping migrations table for existing database...\n");

  // Create _migrations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    )
  `);
  console.log("✓ Created _migrations table");

  // Check which migrations are already applied
  const { rows: existing } = await db.query("SELECT filename FROM _migrations");
  const appliedSet = new Set(existing.map((r: any) => r.filename));

  // Get all migration files
  const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql");
  const files = (await readdir(sqlDir))
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));

  // Check if scans table exists (indicates 001_init.sql was already applied)
  const { rows: tables } = await db.query(
    "SELECT to_regclass('public.scans') AS t"
  );
  const scansExists = Boolean(tables?.[0]?.t);

  console.log(`\nDatabase state:`);
  console.log(`- scans table exists: ${scansExists}`);
  console.log(`- migrations already tracked: ${existing.length}`);
  console.log(`- migration files found: ${files.length}\n`);

  // Mark migrations as applied based on database state
  let marked = 0;
  for (const filename of files) {
    if (appliedSet.has(filename)) {
      console.log(`  ⏭  ${filename} (already tracked)`);
      continue;
    }

    // If scans table exists, mark early migrations as applied
    if (scansExists) {
      await db.query(
        "INSERT INTO _migrations (filename, applied_at) VALUES ($1, NOW()) ON CONFLICT (filename) DO NOTHING",
        [filename]
      );
      console.log(`  ✓ ${filename} (marked as applied)`);
      marked++;
    } else {
      console.log(`  ⚠ ${filename} (needs to be applied)`);
    }
  }

  console.log(`\n✅ Bootstrap complete! Marked ${marked} migrations as applied.`);
  console.log(`\nYou can now run 'npm run migrate' safely.\n`);

  await db.end();
}

bootstrapMigrations().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
