import { Pool } from "pg";
import type { ApiKey, Policy, Scan } from "./types/database.js";

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Type-safe query helpers for common operations
export const queries = {
  // API Keys
  apiKeys: {
    async findByHash(keyHash: string): Promise<ApiKey | null> {
      const { rows } = await db.query<ApiKey>(
        "SELECT id, key_hash, owner, description, created_at, last_used_at FROM api_keys WHERE key_hash=$1",
        [keyHash],
      );
      return rows[0] ?? null;
    },

    async create(data: Pick<ApiKey, "id" | "key_hash" | "owner" | "description">): Promise<ApiKey> {
      const { rows } = await db.query<ApiKey>(
        "INSERT INTO api_keys (id, key_hash, owner, description, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *",
        [data.id, data.key_hash, data.owner, data.description ?? null],
      );
      return rows[0];
    },

    async updateLastUsed(keyHash: string): Promise<void> {
      await db.query("UPDATE api_keys SET last_used_at=NOW() WHERE key_hash=$1", [keyHash]);
    },
  },

  // Policies
  policies: {
    async findByOwner(owner: string): Promise<Policy[]> {
      const { rows } = await db.query<Policy>(
        "SELECT id, owner, name, enabled, rules, created_at, updated_at FROM policies WHERE owner=$1 ORDER BY created_at DESC",
        [owner],
      );
      return rows;
    },

    async findById(id: string): Promise<Policy | null> {
      const { rows } = await db.query<Policy>(
        "SELECT id, owner, name, enabled, rules, created_at, updated_at FROM policies WHERE id=$1",
        [id],
      );
      return rows[0] ?? null;
    },

    async create(data: Pick<Policy, "id" | "owner" | "name" | "enabled" | "rules">): Promise<Policy> {
      const { rows } = await db.query<Policy>(
        "INSERT INTO policies (id, owner, name, enabled, rules, created_at, updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,NOW(),NOW()) RETURNING *",
        [data.id, data.owner, data.name, data.enabled, JSON.stringify(data.rules)],
      );
      return rows[0];
    },

    async update(
      id: string,
      data: Partial<Pick<Policy, "name" | "enabled" | "rules">>,
    ): Promise<Policy | null> {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (data.name !== undefined) {
        fields.push(`name=$${i++}`);
        values.push(data.name);
      }
      if (data.enabled !== undefined) {
        fields.push(`enabled=$${i++}`);
        values.push(data.enabled);
      }
      if (data.rules !== undefined) {
        fields.push(`rules=$${i++}::jsonb`);
        values.push(JSON.stringify(data.rules));
      }

      if (fields.length === 0) return null;
      values.push(id);

      const query = `UPDATE policies SET ${fields.join(", ")}, updated_at=NOW() WHERE id=$${i} RETURNING *`;
      const { rows } = await db.query<Policy>(query, values);
      return rows[0] ?? null;
    },
  },

  // Scans
  scans: {
    async findById(id: string): Promise<Scan | null> {
      const { rows } = await db.query<Scan>(
        "SELECT * FROM scans WHERE id=$1",
        [id],
      );
      return rows[0] ?? null;
    },

    async findByRepoId(repoId: string, limit: number): Promise<Scan[]> {
      const { rows } = await db.query<Scan>(
        "SELECT id, repo_id, status, total_score, layer_security, layer_maintainability, layer_ecosystem, layer_upgrade_impact, methodology_version, result_generated_at, created_at, updated_at FROM scans WHERE repo_id=$1 ORDER BY created_at DESC LIMIT $2",
        [repoId, limit],
      );
      return rows;
    },

    async create(data: Pick<Scan, "id" | "repo_id" | "status" | "source">): Promise<void> {
      await db.query(
        "INSERT INTO scans (id, repo_id, status, source) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
        [data.id, data.repo_id, data.status, data.source],
      );
    },
  },
};
