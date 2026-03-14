import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db";
import { scanQueue } from "../queue";
import type { ScanRequest } from "@reposentinel/shared";

type ScanStatus = "queued" | "running" | "done" | "failed";

export async function scanRoutes(app: FastifyInstance) {
  app.post("/scan", async (req, reply) => {
    const body = req.body as ScanRequest;
    const scanId = randomUUID();

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO scans (id, repo_id, status) VALUES ($1, $2, 'queued')",
        [scanId, body.repoId],
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    try {
      await scanQueue.add(
        "scan",
        {
          scanId,
          repoId: body.repoId,
          dependencyGraph: body.dependencyGraph,
          lockfile: body.lockfile,
        },
        {
          jobId: scanId,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (e: any) {
      await db.query(
        "UPDATE scans SET status='failed', error=$2, finished_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='queued'",
        [scanId, `enqueue_failed: ${String(e?.message ?? e)}`],
      );
      throw e;
    }

    return reply.code(202).send({
      scanId,
      status: "queued" as ScanStatus,
    });
  });

  app.get("/scan/:id", async (req, reply) => {
    const id = (req.params as any).id as string;

    const { rows } = await db.query(
      "SELECT id, repo_id, status, total_score, layer_security, layer_maintainability, layer_ecosystem, layer_upgrade_impact, methodology_version, result_generated_at, result, error, created_at, updated_at FROM scans WHERE id=$1",
      [id],
    );

    if (rows.length === 0) {
      return reply.code(404).send({ message: "Not found" });
    }

    return rows[0];
  });

  app.get("/scans", async (req, reply) => {
    const { repoId, limit } = req.query as any;
    if (!repoId || typeof repoId !== "string") {
      return reply.code(400).send({ message: "repoId is required" });
    }

    const n = Math.max(1, Math.min(200, Number(limit ?? 50)));

    const { rows } = await db.query(
      "SELECT id, repo_id, status, total_score, layer_security, layer_maintainability, layer_ecosystem, layer_upgrade_impact, methodology_version, result_generated_at, created_at, updated_at FROM scans WHERE repo_id=$1 ORDER BY created_at DESC LIMIT $2",
      [repoId, n],
    );

    return { repoId, scans: rows };
  });
}
