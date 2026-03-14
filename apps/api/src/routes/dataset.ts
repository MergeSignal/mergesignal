import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function datasetRoutes(app: FastifyInstance) {
  app.get("/dataset/packages", async (req) => {
    const q = String((req.query as any)?.q ?? "").trim();
    const limit = clampInt((req.query as any)?.limit, 50, 1, 200);

    if (q) {
      const { rows } = await db.query(
        [
          "SELECT name, registry, deprecated, maintainers_count, latest_version, latest_published_at, modified_at, repository_url, last_fetched_at",
          "FROM package_health",
          "WHERE name ILIKE $1",
          "ORDER BY last_fetched_at DESC",
          "LIMIT $2",
        ].join("\n"),
        [`%${q}%`, limit],
      );

      return { query: q, packages: rows };
    }

    const { rows } = await db.query(
      [
        "SELECT name, registry, deprecated, maintainers_count, latest_version, latest_published_at, modified_at, repository_url, last_fetched_at",
        "FROM package_health",
        "ORDER BY last_fetched_at DESC",
        "LIMIT $1",
      ].join("\n"),
      [limit],
    );

    return { packages: rows };
  });

  app.get("/dataset/package/:name", async (req, reply) => {
    const name = String((req.params as any)?.name ?? "").trim();
    if (!name) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "name is required" });

    const days = clampInt((req.query as any)?.days, 30, 1, 365);

    const current = await db.query(
      [
        "SELECT name, registry, deprecated, maintainers_count, latest_version, latest_published_at, modified_at, repository_url, last_fetched_at, raw",
        "FROM package_health",
        "WHERE name=$1",
        "LIMIT 1",
      ].join("\n"),
      [name],
    );

    const row = current.rows?.[0];
    if (!row) {
      return sendProblem(reply, req, {
        status: 404,
        title: "Not Found",
        detail: `Package ${name} not found`,
      });
    }

    const history = await db.query(
      [
        "SELECT fetched_at, deprecated, maintainers_count, latest_version, latest_published_at, modified_at, repository_url",
        "FROM package_health_snapshots",
        "WHERE name=$1 AND fetched_at >= NOW() - ($2::int * INTERVAL '1 day')",
        "ORDER BY fetched_at DESC",
        "LIMIT 400",
      ].join("\n"),
      [name, days],
    );

    return { package: row, history: history.rows };
  });
}

