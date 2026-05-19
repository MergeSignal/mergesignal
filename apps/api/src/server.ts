import "dotenv/config";
import { createApp } from "./app.js";
import { evalAssertNodeEnginePinned } from "./evalSemverUsage.js";

async function start() {
  evalAssertNodeEnginePinned(process.version.slice(1));

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
