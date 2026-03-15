import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { scanQueue } from "../queue.js";

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (req, reply) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const metrics: Record<string, any> = {
      process: {
        uptime_seconds: Math.floor(uptime),
        memory_heap_used_bytes: memUsage.heapUsed,
        memory_heap_total_bytes: memUsage.heapTotal,
        memory_rss_bytes: memUsage.rss,
        memory_external_bytes: memUsage.external,
        pid: process.pid,
        node_version: process.version,
      },
      timestamp: new Date().toISOString(),
    };

    // Optional: Add queue metrics if available
    try {
      const waiting = await scanQueue.getWaitingCount();
      const active = await scanQueue.getActiveCount();
      const completed = await scanQueue.getCompletedCount();
      const failed = await scanQueue.getFailedCount();

      metrics.queue = {
        waiting,
        active,
        completed,
        failed,
      };
    } catch (err: any) {
      app.log.warn({ err }, "Failed to fetch queue metrics");
      metrics.queue = { error: "unavailable" };
    }

    // Optional: Add database pool stats if available
    try {
      metrics.database = {
        pool_total: db.totalCount,
        pool_idle: db.idleCount,
        pool_waiting: db.waitingCount,
      };
    } catch (err: any) {
      app.log.warn({ err }, "Failed to fetch database pool metrics");
      metrics.database = { error: "unavailable" };
    }

    return reply.send(metrics);
  });
}
