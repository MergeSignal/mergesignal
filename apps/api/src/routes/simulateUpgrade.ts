import type { FastifyInstance } from "fastify";
import type { UpgradeSimulationRequest } from "@reposentinel/shared";
import { simulateUpgrade } from "@reposentinel/engine-stub";

export async function simulateUpgradeRoutes(app: FastifyInstance) {
  app.post("/simulate/upgrade", async (req, reply) => {
    const body = req.body as UpgradeSimulationRequest;

    if (!body?.repoId) return reply.code(400).send({ message: "repoId is required" });
    if (!body?.currentLockfile?.manager || !body?.currentLockfile?.content) {
      return reply.code(400).send({ message: "currentLockfile is required" });
    }

    const maxBytes = Number(process.env.SIMULATE_MAX_LOCKFILE_BYTES ?? 2_000_000);
    if (body.currentLockfile.content.length > maxBytes) {
      return reply.code(413).send({ message: "lockfile too large" });
    }
    if (body.proposedLockfile?.content && body.proposedLockfile.content.length > maxBytes) {
      return reply.code(413).send({ message: "proposed lockfile too large" });
    }

    const result = await simulateUpgrade(body);
    return reply.code(200).send(result);
  });
}

