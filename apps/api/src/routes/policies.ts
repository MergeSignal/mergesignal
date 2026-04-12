import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db, queries } from "../db.js";
import { sendProblem } from "../problem.js";
import type { Policy } from "../types/database.js";

type PolicyRule =
  | { type: "no_deprecated" }
  | { type: "max_stale_releases_count"; max: number }
  | { type: "max_bus_factor_low_count"; max: number };

export async function policiesRoutes(app: FastifyInstance) {
  app.get("/org/:owner/policies", async (req, reply) => {
    const owner = String((req.params as { owner: string }).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    // Authorization check: ensure authenticated owner matches requested owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this organization" });
    }

    const policies = await queries.policies.findByOwner(owner);
    return { owner, policies };
  });

  app.post("/org/:owner/policies", async (req, reply) => {
    const owner = String((req.params as { owner: string }).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    // Authorization check: ensure authenticated owner matches requested owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this organization" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "name is required" });

    const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
    const rules = normalizeRules(body.rules);
    if (!rules.length) {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "rules must be a non-empty array" });
    }

    const id = randomUUID();
    const policy = await queries.policies.create({
      id,
      owner,
      name,
      enabled,
      rules,
    });

    return reply.code(201).send(policy);
  });

  app.patch("/policies/:id", async (req, reply) => {
    const id = String((req.params as { id: string }).id ?? "").trim();
    if (!id) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "id is required" });

    // First, fetch the policy to check ownership
    const existing = await queries.policies.findById(id);
    if (!existing) {
      return sendProblem(reply, req, { status: 404, title: "Not Found", detail: "policy not found" });
    }

    // Authorization check: ensure authenticated owner matches policy owner
    if (req.authenticatedOwner && req.authenticatedOwner !== existing.owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this policy" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Partial<Pick<Policy, "name" | "enabled" | "rules">> = {};

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "name cannot be empty" });
      updates.name = name;
    }

    if (body.enabled !== undefined) {
      updates.enabled = Boolean(body.enabled);
    }

    if (body.rules !== undefined) {
      const rules = normalizeRules(body.rules);
      if (!rules.length) {
        return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "rules must be a non-empty array" });
      }
      updates.rules = rules;
    }

    if (Object.keys(updates).length === 0) {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "no fields to update" });
    }

    const policy = await queries.policies.update(id, updates);
    if (!policy) {
      return sendProblem(reply, req, { status: 404, title: "Not Found", detail: "policy not found" });
    }

    return policy;
  });

  app.get("/org/:owner/policy/violations", async (req, reply) => {
    const owner = String((req.params as { owner: string }).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    // Authorization check: ensure authenticated owner matches requested owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this organization" });
    }

    const { repoId, limit } = req.query as { repoId?: string; limit?: string };
    const n = Math.max(1, Math.min(500, Number(limit ?? 100)));

    const params: unknown[] = [owner];
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
    const rule = r as Record<string, unknown>;
    const t = String(rule?.type ?? "").trim();
    if (t === "no_deprecated") out.push({ type: "no_deprecated" });
    else if (t === "max_stale_releases_count") {
      const max = Number(rule?.max);
      if (Number.isFinite(max) && max >= 0) out.push({ type: "max_stale_releases_count", max: Math.floor(max) });
    } else if (t === "max_bus_factor_low_count") {
      const max = Number(rule?.max);
      if (Number.isFinite(max) && max >= 0) out.push({ type: "max_bus_factor_low_count", max: Math.floor(max) });
    }
  }
  return out;
}

