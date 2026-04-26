import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function registerCors(app: FastifyInstance) {
  const allowedOrigins = new Set(
    (
      process.env.CORS_ORIGINS ??
      "http://localhost:3000,http://127.0.0.1:3000,https://mergesignal-web.fly.dev"
    )
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
}
