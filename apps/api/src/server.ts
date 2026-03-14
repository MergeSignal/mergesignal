import Fastify from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { indexRoutes } from "./routes/index.js";
import { healthRoutes } from "./routes/health.js";
import { scanRoutes } from "./routes/scan.js";
import { scanEventsRoutes } from "./routes/scanEvents.js";
import { simulateUpgradeRoutes } from "./routes/simulateUpgrade.js";
import { githubWebhookRoutes } from "./routes/githubWebhook.js";
import { orgDashboardRoutes } from "./routes/orgDashboard.js";
import { alertsRoutes } from "./routes/alerts.js";
import { policiesRoutes } from "./routes/policies.js";
import { benchmarkRoutes } from "./routes/benchmark.js";
import { runMigrationsIfEnabled } from "./migrate.js";
import { openApiRoutes } from "./routes/openapi.js";
import { sendProblem } from "./problem.js";

async function start() {
  const app = Fastify({ logger: true });

  await runMigrationsIfEnabled((msg) => app.log.info(msg));

  app.addHook("onSend", async (req, reply, payload) => {
    if (!reply.getHeader("x-request-id")) {
      reply.header("x-request-id", String((req as any).id ?? ""));
    }
    return payload;
  });

  app.setNotFoundHandler(async (req, reply) => {
    return sendProblem(reply, req, {
      status: 404,
      title: "Not Found",
      detail: `Route ${req.method} ${req.url} not found`,
    });
  });

  app.setErrorHandler(async (err, req, reply) => {
    const status = Number((err as any)?.statusCode ?? (err as any)?.status ?? 500);
    const title =
      status === 400
        ? "Bad Request"
        : status === 401
          ? "Unauthorized"
          : status === 403
            ? "Forbidden"
            : status === 404
              ? "Not Found"
              : status === 413
                ? "Payload Too Large"
                : status === 429
                  ? "Too Many Requests"
                  : status >= 500
                    ? "Internal Server Error"
                    : "Error";

    const detail = status >= 500 ? "Unexpected error" : String((err as any)?.message ?? "Error");
    const validation = (err as any)?.validation;

    return sendProblem(reply, req, {
      status,
      title,
      detail,
      extra: validation ? { validation } : undefined,
    });
  });

  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      cb(null, allowedOrigins.has(origin));
    },
    credentials: false,
  });

  const apiKey = (process.env.REPOSENTINEL_API_KEY ?? "").trim();
  app.addHook("onRequest", async (req, reply) => {
    if (!apiKey) return;

    const url = String(req.url ?? "");
    const method = String(req.method ?? "GET").toUpperCase();
    const isPublic =
      (method === "GET" && (url === "/health" || url === "/openapi.json" || url === "/docs" || url === "/")) ||
      (method === "POST" && url === "/github/webhook");

    if (isPublic) return;

    const h = String(req.headers.authorization ?? "");
    const ok = h.startsWith("Bearer ") && h.slice("Bearer ".length).trim() === apiKey;
    if (!ok) {
      return sendProblem(reply, req, {
        status: 401,
        title: "Unauthorized",
        detail: "Missing or invalid API key",
      });
    }
  });

  app.register(indexRoutes);
  app.register(healthRoutes);
  app.register(openApiRoutes);
  app.register(scanRoutes);
  app.register(scanEventsRoutes);
  app.register(simulateUpgradeRoutes);
  app.register(githubWebhookRoutes);
  app.register(orgDashboardRoutes);
  app.register(alertsRoutes);
  app.register(policiesRoutes);
  app.register(benchmarkRoutes);

  // API-first: stable versioned base. For now, we expose both unversioned and /v1 routes.
  await app.register(
    async (v1) => {
      v1.register(indexRoutes);
      v1.register(healthRoutes);
      v1.register(openApiRoutes);
      v1.register(scanRoutes);
      v1.register(scanEventsRoutes);
      v1.register(simulateUpgradeRoutes);
      v1.register(githubWebhookRoutes);
      v1.register(orgDashboardRoutes);
      v1.register(alertsRoutes);
      v1.register(policiesRoutes);
      v1.register(benchmarkRoutes);
    },
    { prefix: "/v1" },
  );

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
