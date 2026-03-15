import { FastifyInstance } from "fastify";
import { db, queries } from "../db.js";
import type { ScanRequest } from "@reposentinel/shared";
import { createScanAndEnqueue } from "../services/scanService.js";
import { sendProblem } from "../problem.js";

type ScanStatus = "queued" | "running" | "done" | "failed";

export async function scanRoutes(app: FastifyInstance) {
  app.post("/scan", async (req, reply) => {
    const body = req.body as ScanRequest;

    // Authorization check: if using org-scoped API key, ensure repoId matches owner
    if (req.authenticatedOwner) {
      const repoOwner = body.repoId.includes("/") ? body.repoId.split("/")[0] : body.repoId;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this repository" });
      }
    }

    try {
      const { scanId } = await createScanAndEnqueue({
        repoId: body.repoId,
        dependencyGraph: body.dependencyGraph,
        lockfile: body.lockfile,
        source: "manual",
      });

      return reply.code(202).send({ scanId, status: "queued" as ScanStatus });
    } catch (e: any) {
      const code = Number(e?.statusCode ?? 500);
      if (code === 413) {
        return sendProblem(reply, req, { status: 413, title: "Payload Too Large", detail: "lockfile too large" });
      }
      if (code === 429) {
        return sendProblem(reply, req, { status: 429, title: "Too Many Requests", detail: "scan quota exceeded" });
      }
      throw e;
    }
  });

  app.get("/scan/:id", async (req, reply) => {
    const id = (req.params as any).id as string;

    const scan = await queries.scans.findById(id);
    if (!scan) {
      return sendProblem(reply, req, { status: 404, title: "Not Found", detail: "scan not found" });
    }

    // Authorization check: if using org-scoped API key, ensure scan belongs to owner
    if (req.authenticatedOwner) {
      const repoOwner = scan.repo_id.includes("/") ? scan.repo_id.split("/")[0] : scan.repo_id;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this scan" });
      }
    }

    return scan;
  });

  app.get("/scans", async (req, reply) => {
    const { repoId, limit } = req.query as any;
    if (!repoId || typeof repoId !== "string") {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "repoId is required" });
    }

    // Authorization check: if using org-scoped API key, ensure repoId belongs to owner
    if (req.authenticatedOwner) {
      const repoOwner = repoId.includes("/") ? repoId.split("/")[0] : repoId;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this repository" });
      }
    }

    const n = Math.max(1, Math.min(200, Number(limit ?? 50)));
    const scans = await queries.scans.findByRepoId(repoId, n);

    return { repoId, scans };
  });
}
