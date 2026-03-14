import Fastify from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import { indexRoutes } from "./routes/index";
import { healthRoutes } from "./routes/health";
import { scanRoutes } from "./routes/scan";
import { scanEventsRoutes } from "./routes/scanEvents";
import { simulateUpgradeRoutes } from "./routes/simulateUpgrade";

async function start() {
  const app = Fastify({ logger: true });

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

  app.register(indexRoutes);
  app.register(healthRoutes);
  app.register(scanRoutes);
  app.register(scanEventsRoutes);
  app.register(simulateUpgradeRoutes);

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
