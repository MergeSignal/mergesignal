import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { problemJsonString } from "../problem.js";

export async function scanEventsRoutes(app: FastifyInstance) {
  app.get("/scan/:id/events", async (req, reply) => {
    const id = (req.params as any).id as string;

    const allowedOrigins = new Set(
      (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const origin = String(req.headers.origin ?? "");
    if (origin && !allowedOrigins.has(origin)) {
      reply.hijack();
      reply.raw.writeHead(403, {
        "Content-Type": "application/problem+json; charset=utf-8",
        "x-request-id": String((req as any).id ?? ""),
        Vary: "Origin",
      });
      reply.raw.end(
        problemJsonString(req as any, {
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
      "x-request-id": String((req as any).id ?? ""),
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    });

    reply.raw.write(`: connected\n\n`);

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let interval: NodeJS.Timeout | undefined;
    let keepalive: NodeJS.Timeout | undefined;
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (interval) clearInterval(interval);
      if (keepalive) clearInterval(keepalive);
      reply.raw.end();
    };

    // שליחה ראשונית
    const first = await db.query(
      "SELECT id, status, result, error, updated_at FROM scans WHERE id=$1",
      [id],
    );
    if (first.rows.length === 0) {
      send("error", { message: "Not found", requestId: String((req as any).id ?? "") });
      cleanup();
      return;
    }
    send("status", first.rows[0]);

    if (first.rows[0].status === "done" || first.rows[0].status === "failed") {
      cleanup();
      return;
    }

    keepalive = setInterval(() => {
      reply.raw.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    let lastUpdated = String(first.rows[0].updated_at);

    interval = setInterval(async () => {
      try {
        const { rows } = await db.query(
          "SELECT id, status, result, error, updated_at FROM scans WHERE id=$1",
          [id],
        );
        if (rows.length === 0) {
          send("error", { message: "Not found", requestId: String((req as any).id ?? "") });
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
      } catch (e: any) {
        send("error", { message: String(e?.message ?? e) });
        cleanup();
      }
    }, 1000);

    req.raw.on("close", () => {
      cleanup();
    });
  });
}
