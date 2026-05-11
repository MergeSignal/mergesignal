import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

function readInternalToken(req: FastifyRequest): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const h = req.headers["x-internal-api-key"];
  if (typeof h === "string") return h.trim();
  return undefined;
}

export async function internalStaleScansRoutes(app: FastifyInstance) {
  app.post("/internal/sweep-stale-scans", async (req, reply) => {
    const expected = process.env.MERGESIGNAL_INTERNAL_API_KEY?.trim();
    if (!expected) {
      return sendProblem(reply, req, {
        status: 503,
        title: "Service Unavailable",
        detail: "MERGESIGNAL_INTERNAL_API_KEY is not configured",
      });
    }

    const token = readInternalToken(req);
    if (!token || token !== expected) {
      return sendProblem(reply, req, {
        status: 401,
        title: "Unauthorized",
        detail: "Invalid or missing internal API key",
      });
    }

    const raw = (req.query as { staleMinutes?: string }).staleMinutes;
    const parsed = Math.trunc(Number(raw ?? "30"));
    const staleMinutes = Number.isFinite(parsed)
      ? Math.min(24 * 60, Math.max(5, parsed))
      : 30;

    const { rowCount } = await db.query(
      `UPDATE scans
       SET status = 'failed',
           error = 'stale_running_heartbeat',
           finished_at = NOW(),
           updated_at = NOW()
       WHERE status = 'running'
         AND heartbeat_at < NOW() - ($1::int * INTERVAL '1 minute')`,
      [staleMinutes],
    );

    return reply.code(200).send({
      staleMinutes,
      scansMarkedFailed: rowCount ?? 0,
    });
  });
}
