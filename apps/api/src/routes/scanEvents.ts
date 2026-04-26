import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { problemJsonString } from "../problem.js";

export async function scanEventsRoutes(app: FastifyInstance) {
  app.get("/scan/:id/events", async (req, reply) => {
    const id = (req.params as { id: string }).id;

    // Authorization check: fetch scan and verify ownership before streaming
    const scanCheck = await db.query("SELECT repo_id FROM scans WHERE id=$1", [
      id,
    ]);
    if (scanCheck.rows.length === 0) {
      reply.hijack();
      reply.raw.writeHead(404, {
        "Content-Type": "application/problem+json; charset=utf-8",
        "x-request-id": String(req.id ?? ""),
      });
      reply.raw.end(
        problemJsonString(req, {
          status: 404,
          title: "Not Found",
          detail: "scan not found",
        }),
      );
      return;
    }

    if (req.authenticatedOwner) {
      const repoOwner = scanCheck.rows[0].repo_id.includes("/")
        ? scanCheck.rows[0].repo_id.split("/")[0]
        : scanCheck.rows[0].repo_id;
      if (repoOwner !== req.authenticatedOwner) {
        reply.hijack();
        reply.raw.writeHead(403, {
          "Content-Type": "application/problem+json; charset=utf-8",
          "x-request-id": String(req.id ?? ""),
        });
        reply.raw.end(
          problemJsonString(req, {
            status: 403,
            title: "Forbidden",
            detail: "Access denied to this scan",
          }),
        );
        return;
      }
    }

    const allowedOrigins = new Set(
      (
        process.env.CORS_ORIGINS ??
        "http://localhost:3000,http://127.0.0.1:3000,https://mergesignal-web.fly.dev"
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const origin = String(req.headers.origin ?? "");
    if (origin && !allowedOrigins.has(origin)) {
      reply.hijack();
      reply.raw.writeHead(403, {
        "Content-Type": "application/problem+json; charset=utf-8",
        "x-request-id": String(req.id ?? ""),
        Vary: "Origin",
      });
      reply.raw.end(
        problemJsonString(req, {
          status: 403,
          title: "Forbidden",
          detail: "CORS origin not allowed",
        }),
      );
      return;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": String(req.id ?? ""),
      ...(origin
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
    });

    reply.raw.write(`: connected\n\n`);

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const first = await db.query(
      "SELECT id, status, result, error, updated_at FROM scans WHERE id=$1",
      [id],
    );
    if (first.rows.length === 0) {
      send("error", { message: "Not found", requestId: String(req.id ?? "") });
      reply.raw.end();
      return;
    }
    send("status", first.rows[0]);

    if (first.rows[0].status === "done" || first.rows[0].status === "failed") {
      reply.raw.end();
      return;
    }

    let closed = false;
    let lastUpdated = String(first.rows[0].updated_at);

    const keepalive = setInterval(() => {
      reply.raw.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    const interval = setInterval(async () => {
      try {
        const { rows } = await db.query(
          "SELECT id, status, result, error, updated_at FROM scans WHERE id=$1",
          [id],
        );
        if (rows.length === 0) {
          send("error", {
            message: "Not found",
            requestId: String(req.id ?? ""),
          });
          cleanup();
          return;
        }

        const updated = String(rows[0].updated_at);
        if (updated !== lastUpdated) {
          lastUpdated = updated;
          send("status", rows[0]);

          if (rows[0].status === "done" || rows[0].status === "failed") {
            cleanup();
          }
        }
      } catch (e: unknown) {
        send("error", { message: e instanceof Error ? e.message : String(e) });
        cleanup();
      }
    }, 1000);

    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(interval);
      clearInterval(keepalive);
      reply.raw.end();
    }

    req.raw.on("close", () => {
      cleanup();
    });
  });
}
