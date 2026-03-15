import Fastify from "fastify";
import { runMigrationsIfEnabled } from "./migrate.js";
import { registerRoutes } from "./routes/register.js";
import { registerRequestId } from "./http/requestId.js";
import { registerErrorHandling } from "./http/errors.js";
import { registerRawBody } from "./http/rawBody.js";
import { registerCors } from "./http/cors.js";
import { registerAuth } from "./http/auth.js";
import { appConfig } from "./config.js";

export async function createApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
            requestId: req.id,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    },
    requestIdLogLabel: "requestId",
    disableRequestLogging: false,
  });

  app.log.info({ version: appConfig.version, env: process.env.NODE_ENV ?? "development" }, "Starting API server");

  await runMigrationsIfEnabled((msg) => app.log.info(msg));

  registerRequestId(app);
  registerErrorHandling(app);

  await registerRawBody(app);
  await registerCors(app);
  registerAuth(app);

  await registerRoutes(app);

  return app;
}

