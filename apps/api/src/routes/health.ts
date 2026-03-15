import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { scanQueue } from "../queue.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (req, reply) => {
    const checks: Record<string, { ok: boolean; error?: string; latencyMs?: number }> = {};
    let allOk = true;

    // Database connectivity check
    const dbStart = Date.now();
    try {
      await db.query("SELECT 1");
      checks.database = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { ok: false, error: String(err?.message ?? err) };
      allOk = false;
      app.log.error({ err, check: "database" }, "Health check failed for database");
    }

    // Redis connectivity check (via BullMQ queue)
    const redisStart = Date.now();
    try {
      const client = await scanQueue.client;
      await client.ping();
      checks.redis = { ok: true, latencyMs: Date.now() - redisStart };
    } catch (err: any) {
      checks.redis = { ok: false, error: String(err?.message ?? err) };
      allOk = false;
      app.log.error({ err, check: "redis" }, "Health check failed for redis");
    }

    const status = allOk ? 200 : 503;
    return reply.code(status).send({
      ok: allOk,
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}