import type { FastifyInstance } from "fastify";

export function registerRequestId(app: FastifyInstance) {
  app.addHook("onSend", async (req, reply, payload) => {
    if (!reply.getHeader("x-request-id")) {
      reply.header("x-request-id", String(req.id ?? ""));
    }
    return payload;
  });
}

