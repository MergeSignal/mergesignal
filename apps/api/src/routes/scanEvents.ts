import { FastifyInstance } from "fastify";
import { db } from "../db";

export async function scanEventsRoutes(app: FastifyInstance) {
  app.get("/scan/:id/events", async (req, reply) => {
    const id = (req.params as any).id as string;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    // Force bytes to flush immediately (helps proxies/browsers start rendering)
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
      send("error", { message: "Not found" });
      cleanup();
      return;
    }
    send("status", first.rows[0]);

    if (first.rows[0].status === "done" || first.rows[0].status === "failed") {
      cleanup();
      return;
    }

    keepalive = setInterval(() => {
      // keep connection alive through proxies
      reply.raw.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    // Poll פנימי (בשרת) כל 1 שניה ודחיפה ללקוח רק אם השתנה
    let lastUpdated = String(first.rows[0].updated_at);

    interval = setInterval(async () => {
      try {
        const { rows } = await db.query(
          "SELECT id, status, result, error, updated_at FROM scans WHERE id=$1",
          [id],
        );
        if (rows.length === 0) {
          send("error", { message: "Not found" });
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
