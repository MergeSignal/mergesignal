import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

export async function alertsRoutes(app: FastifyInstance) {
  app.get("/alerts", async (req, reply) => {
    const { repoId, limit } = req.query as any;
    if (!repoId || typeof repoId !== "string") {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "repoId is required" });
    }
    const n = Math.max(1, Math.min(200, Number(limit ?? 50)));

    const { rows } = await db.query(
      "SELECT id, repo_id, type, severity, title, details, created_at FROM alerts WHERE repo_id=$1 ORDER BY created_at DESC LIMIT $2",
      [repoId, n],
    );

    return { repoId, alerts: rows };
  });

  app.get("/org/:owner/alerts", async (req, reply) => {
    const owner = String((req.params as any).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    const n = Math.max(1, Math.min(500, Number((req.query as any)?.limit ?? 100)));
    const { rows } = await db.query(
      "SELECT id, repo_id, type, severity, title, details, created_at FROM alerts WHERE split_part(repo_id, '/', 1)=$1 ORDER BY created_at DESC LIMIT $2",
      [owner, n],
    );

    return { owner, alerts: rows };
  });
}

