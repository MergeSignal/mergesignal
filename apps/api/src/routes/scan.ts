import { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ScanResult } from "@mergesignal/shared";
import { queries } from "../db.js";
import { createScanAndEnqueue } from "../services/scanService.js";
import { buildScanDetailsForApi } from "../services/scanPresentationService.js";
import { sendProblem } from "../problem.js";

const LockfileManagerSchema = z.enum(["pnpm", "npm", "yarn"]);

const ScanRequestSchema = z.object({
  repoId: z.string().min(1).max(500),
  dependencyGraph: z.unknown(),
  lockfile: z
    .object({
      manager: LockfileManagerSchema,
      content: z.string(),
      path: z.string().optional(),
    })
    .optional(),
});

type ScanStatus = "queued" | "running" | "done" | "failed";

export async function scanRoutes(app: FastifyInstance) {
  app.post("/scan", async (req, reply) => {
    const parsed = ScanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: parsed.error.issues
          .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
          .join("; "),
      });
    }
    const body = parsed.data;

    // Authorization check: if using org-scoped API key, ensure repoId matches owner
    if (req.authenticatedOwner) {
      const repoOwner = body.repoId.includes("/")
        ? body.repoId.split("/")[0]
        : body.repoId;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, {
          status: 403,
          title: "Forbidden",
          detail: "Access denied to this repository",
        });
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
    } catch (e: unknown) {
      const code = Number((e as { statusCode?: number })?.statusCode ?? 500);
      if (code === 413) {
        return sendProblem(reply, req, {
          status: 413,
          title: "Payload Too Large",
          detail: "lockfile too large",
        });
      }
      if (code === 429) {
        return sendProblem(reply, req, {
          status: 429,
          title: "Too Many Requests",
          detail: "scan quota exceeded",
        });
      }
      throw e;
    }
  });

  app.get("/scan/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const includeRaw =
      (req.query as { include?: string }).include === "rawResult";

    const scan = await queries.scans.findById(id);
    if (!scan) {
      return sendProblem(reply, req, {
        status: 404,
        title: "Not Found",
        detail: "scan not found",
      });
    }

    // Authorization check: if using org-scoped API key, ensure scan belongs to owner
    if (req.authenticatedOwner) {
      const repoOwner = scan.repo_id.includes("/")
        ? scan.repo_id.split("/")[0]
        : scan.repo_id;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, {
          status: 403,
          title: "Forbidden",
          detail: "Access denied to this scan",
        });
      }
    }

    const result = scan.result as ScanResult | null;
    const detailPresentation = buildScanDetailsForApi({
      scanId: scan.id,
      pipelineStatus: scan.status,
      decision: scan.decision,
      totalScore: scan.total_score,
      result,
      methodologyVersion: scan.methodology_version,
      prNumber: scan.github_pr_number,
      scannedAt: scan.result_generated_at?.toISOString() ?? null,
    });

    const response = {
      id: scan.id,
      repoId: scan.repo_id,
      status: scan.status,
      githubPrNumber: scan.github_pr_number,
      githubHeadSha: scan.github_head_sha,
      githubBaseRef: scan.github_base_ref,
      methodologyVersion: scan.methodology_version,
      engineReleaseVersion: scan.engine_release_version,
      createdAt: scan.created_at,
      finishedAt: scan.finished_at,
      error: scan.error,
      detailPresentation,
      ...(includeRaw && result ? { result } : {}),
    };

    return response;
  });

  app.get("/scans", async (req, reply) => {
    const { repoId, limit } = req.query as { repoId?: string; limit?: string };
    if (!repoId || typeof repoId !== "string") {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: "repoId is required",
      });
    }

    // Authorization check: if using org-scoped API key, ensure repoId belongs to owner
    if (req.authenticatedOwner) {
      const repoOwner = repoId.includes("/") ? repoId.split("/")[0] : repoId;
      if (repoOwner !== req.authenticatedOwner) {
        return sendProblem(reply, req, {
          status: 403,
          title: "Forbidden",
          detail: "Access denied to this repository",
        });
      }
    }

    const n = Math.max(1, Math.min(200, Number(limit ?? 50)));
    const scans = await queries.scans.findByRepoId(repoId, n);

    return { repoId, scans };
  });
}
