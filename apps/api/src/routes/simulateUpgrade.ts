import type { FastifyInstance } from "fastify";
import type { UpgradeSimulationRequest } from "@reposentinel/shared";
import { simulateUpgrade } from "@reposentinel/engine";
import { sendProblem } from "../problem.js";

export async function simulateUpgradeRoutes(app: FastifyInstance) {
  app.post("/simulate/upgrade", async (req, reply) => {
    const body = req.body as UpgradeSimulationRequest;

    if (!body?.repoId) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "repoId is required" });
    if (!body?.currentLockfile?.manager || !body?.currentLockfile?.content) {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "currentLockfile is required" });
    }

    const maxBytes = Number(process.env.SIMULATE_MAX_LOCKFILE_BYTES ?? 2_000_000);
    if (body.currentLockfile.content.length > maxBytes) {
      return sendProblem(reply, req, { status: 413, title: "Payload Too Large", detail: "lockfile too large" });
    }
    if (body.proposedLockfile?.content && body.proposedLockfile.content.length > maxBytes) {
      return sendProblem(reply, req, { status: 413, title: "Payload Too Large", detail: "proposed lockfile too large" });
    }

    const result = await simulateUpgrade(body);
    return reply.code(200).send(result);
  });
}

