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

export async function internalEngineInfoRoutes(app: FastifyInstance) {
  app.get("/internal/engine-info", async (req, reply) => {
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

    const { rows: recentScans } = await db.query<{
      engine_release_version: string | null;
      engine_release_git_sha: string | null;
      methodology_version: string | null;
      created_at: Date;
    }>(
      `SELECT engine_release_version, engine_release_git_sha, methodology_version, created_at
       FROM scans
       WHERE engine_release_version IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    const { rows: distinctReleases } = await db.query<{
      engine_release_version: string;
      engine_release_git_sha: string | null;
      scan_count: string;
    }>(
      `SELECT engine_release_version,
              MAX(engine_release_git_sha) AS engine_release_git_sha,
              COUNT(*)::text AS scan_count
       FROM scans
       WHERE engine_release_version IS NOT NULL
       GROUP BY engine_release_version
       ORDER BY MAX(created_at) DESC
       LIMIT 10`,
    );

    return reply.code(200).send({
      recentScans: recentScans.map((row) => ({
        engineReleaseVersion: row.engine_release_version,
        engineReleaseGitSha: row.engine_release_git_sha,
        methodologyVersion: row.methodology_version,
        createdAt: row.created_at.toISOString(),
      })),
      deployedEngineReleases: distinctReleases.map((row) => ({
        engineReleaseVersion: row.engine_release_version,
        engineReleaseGitSha: row.engine_release_git_sha,
        scanCount: Number(row.scan_count),
      })),
    });
  });
}
