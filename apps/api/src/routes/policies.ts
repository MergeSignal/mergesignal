import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

type PolicyRule =
  | { type: "no_deprecated" }
  | { type: "max_stale_releases_count"; max: number }
  | { type: "max_bus_factor_low_count"; max: number };

type Policy = {
  id: string;
  owner: string;
  name: string;
  enabled: boolean;
  rules: PolicyRule[];
  created_at: string;
  updated_at: string;
};

export async function policiesRoutes(app: FastifyInstance) {
  app.get("/org/:owner/policies", async (req, reply) => {
    const owner = String((req.params as any).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    const { rows } = await db.query(
      "SELECT id, owner, name, enabled, rules, created_at, updated_at FROM policies WHERE owner=$1 ORDER BY created_at DESC",
      [owner],
    );

    return { owner, policies: rows as Policy[] };
  });

  app.post("/org/:owner/policies", async (req, reply) => {
    const owner = String((req.params as any).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    const body = (req.body ?? {}) as any;
    const name = String(body.name ?? "").trim();
    if (!name) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "name is required" });

    const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
    const rules = normalizeRules(body.rules);
    if (!rules.length) {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "rules must be a non-empty array" });
    }

    const id = randomUUID();
    await db.query(
      "INSERT INTO policies (id, owner, name, enabled, rules, created_at, updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,NOW(),NOW())",
      [id, owner, name, enabled, JSON.stringify(rules)],
    );

    return reply.code(201).send({ id, owner, name, enabled, rules });
  });

  app.patch("/policies/:id", async (req, reply) => {
    const id = String((req.params as any).id ?? "").trim();
    if (!id) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "id is required" });

    const body = (req.body ?? {}) as any;
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "name cannot be empty" });
      fields.push(`name=$${i++}`);
      values.push(name);
    }

    if (body.enabled !== undefined) {
      fields.push(`enabled=$${i++}`);
      values.push(Boolean(body.enabled));
    }

    if (body.rules !== undefined) {
      const rules = normalizeRules(body.rules);
      if (!rules.length) {
        return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "rules must be a non-empty array" });
      }
      fields.push(`rules=$${i++}::jsonb`);
      values.push(JSON.stringify(rules));
    }

    if (!fields.length) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "no fields to update" });
    values.push(id);

    const q = `UPDATE policies SET ${fields.join(", ")}, updated_at=NOW() WHERE id=$${i} RETURNING id, owner, name, enabled, rules, created_at, updated_at`;
    const { rows } = await db.query(q, values);
    if (!rows.length) return sendProblem(reply, req, { status: 404, title: "Not Found", detail: "policy not found" });
    return rows[0] as Policy;
  });

  app.get("/org/:owner/policy/violations", async (req, reply) => {
    const owner = String((req.params as any).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    const { repoId, limit } = req.query as any;
    const n = Math.max(1, Math.min(500, Number(limit ?? 100)));

    const params: any[] = [owner];
    let where = "owner=$1";
    if (repoId && typeof repoId === "string") {
      params.push(repoId);
      where += ` AND repo_id=$${params.length}`;
    }
    params.push(n);

    const { rows } = await db.query(
      `SELECT id, policy_id, owner, repo_id, fingerprint, severity, title, details, created_at
       FROM policy_violations
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return { owner, repoId: repoId ?? null, violations: rows };
  });
}

function normalizeRules(input: unknown): PolicyRule[] {
  if (!Array.isArray(input)) return [];
  const out: PolicyRule[] = [];
  for (const r of input) {
    const t = String((r as any)?.type ?? "").trim();
    if (t === "no_deprecated") out.push({ type: "no_deprecated" });
    else if (t === "max_stale_releases_count") {
      const max = Number((r as any)?.max);
      if (Number.isFinite(max) && max >= 0) out.push({ type: "max_stale_releases_count", max: Math.floor(max) });
    } else if (t === "max_bus_factor_low_count") {
      const max = Number((r as any)?.max);
      if (Number.isFinite(max) && max >= 0) out.push({ type: "max_bus_factor_low_count", max: Math.floor(max) });
    }
  }
  return out;
}

