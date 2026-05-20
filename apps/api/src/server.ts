import "dotenv/config";
import { createApp } from "./app.js";
import { evalTouchJwtLibraryAtStartup } from "./evalServiceJwt.js";

async function start() {
  const jwtSecret =
    process.env.MERGESIGNAL_SERVICE_JWT_SECRET?.trim() ??
    "eval-jwt-startup-self-check-only";
  evalTouchJwtLibraryAtStartup(jwtSecret);

  const app = await createApp();

  const port = Number(process.env.PORT ?? 4000);
  const host = (process.env.HOST ?? "0.0.0.0").trim() || "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
