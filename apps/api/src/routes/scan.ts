import { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ScanResult } from "@mergesignal/shared";
import {
  resolvePrRiskScoreFromRow,
  resolveRepositoryHealthScoreFromRow,
} from "@mergesignal/shared";
import {
  fulfillAcquisition,
  hashAlgorithmForObjectId,
  readPendingAcquisition,
} from "@mergesignal/engine";
import { queries } from "../db.js";
import { getAcquisitionRedis } from "../acquisition/redis.js";
import { createScanAndEnqueue } from "../services/scanService.js";
import { buildScanDetailsForApi } from "../services/scanPresentationService.js";
import { sendProblem } from "../problem.js";
import {
  localScanBodySchema,
  localScanEnqueueArgs,
  ownerOfRepoId,
  registerObjectBodyParser,
  requireScanOwner,
} from "./localScanIngress.js";

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
  registerObjectBodyParser(app);

  app.post("/scan", async (req, reply) => {
    if (req.body && typeof req.body === "object" && "local" in req.body) {
      if (!req.authenticatedOwner) {
        return sendProblem(reply, req, {
          status: 401,
          title: "Unauthorized",
          detail: "Missing or invalid API key",
        });
      }
      const localParsed = localScanBodySchema.safeParse(req.body);
      if (!localParsed.success) {
        return sendProblem(reply, req, {
          status: 400,
          title: "Bad Request",
          detail: localParsed.error.issues
            .map(
              (issue) => `${issue.path.join(".") || "body"}: ${issue.message}`,
            )
            .join("; "),
        });
      }
      try {
        const enqueued = localScanEnqueueArgs(
          req.authenticatedOwner,
          localParsed.data,
        );
        const { scanId } = await createScanAndEnqueue(enqueued);
        return reply.code(202).send({ scanId, status: "queued" as ScanStatus });
      } catch (error: unknown) {
        const code = Number(
          (error as { statusCode?: number })?.statusCode ?? 500,
        );
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
        throw error;
      }
    }

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
      if (ownerOfRepoId(scan.repo_id) !== req.authenticatedOwner) {
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
      prRiskScore: resolvePrRiskScoreFromRow(scan),
      result,
      methodologyVersion: scan.methodology_version,
      prNumber: scan.github_pr_number,
      scannedAt: scan.result_generated_at?.toISOString() ?? null,
    });

    let acquisition:
      | { pending: true; objectId: string; generation: string }
      | undefined;
    if (scan.status === "running") {
      try {
        const redis = getAcquisitionRedis();
        if (redis) {
          const pending = await readPendingAcquisition(redis, scan.id);
          if (pending) {
            acquisition = { pending: true, ...pending };
          }
        }
      } catch {
        acquisition = undefined;
      }
    }

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
      ...(acquisition ? { acquisition } : {}),
      ...(includeRaw && result ? { result } : {}),
    };

    return response;
  });

  app.post("/scan/:id/object", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const scan = await queries.scans.findById(id);
    if (!scan) {
      return sendProblem(reply, req, {
        status: 404,
        title: "Not Found",
        detail: "scan not found",
      });
    }
    if (
      !requireScanOwner(
        req,
        reply,
        scan.repo_id,
        (problemReply, problemReq, problem) =>
          sendProblem(problemReply, problemReq, problem),
      )
    ) {
      return;
    }
    if (scan.status !== "running") {
      return sendProblem(reply, req, {
        status: 409,
        title: "Conflict",
        detail: "scan is not accepting repository evidence",
      });
    }
    const generation = String(
      req.headers["x-mergesignal-acquisition-generation"] ?? "",
    );
    const objectId = String(req.headers["x-mergesignal-object-id"] ?? "");
    if (!generation || !hashAlgorithmForObjectId(objectId)) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: "generation and object id are required",
      });
    }
    const body = req.body;
    if (!Buffer.isBuffer(body)) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: "raw object bytes are required",
      });
    }
    const redis = getAcquisitionRedis();
    if (!redis) {
      return sendProblem(reply, req, {
        status: 503,
        title: "Service Unavailable",
        detail: "acquisition session is unavailable",
      });
    }
    const outcome = await fulfillAcquisition(redis, {
      scanId: id,
      generation,
      objectId,
      bytes: body,
    });
    if (outcome === "accepted") return reply.code(204).send();
    if (outcome === "oversized") {
      return sendProblem(reply, req, {
        status: 413,
        title: "Payload Too Large",
        detail: "object too large",
      });
    }
    return sendProblem(reply, req, {
      status: 409,
      title: "Conflict",
      detail: "object request is no longer pending",
    });
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
    const rows = await queries.scans.findByRepoId(repoId, n);

    return {
      repoId,
      scans: rows.map((s) => ({
        id: s.id,
        repoId: s.repo_id,
        status: s.status,
        prRiskScore: resolvePrRiskScoreFromRow(s),
        repositoryHealthScore: resolveRepositoryHealthScoreFromRow(s),
        layerSecurity: s.layer_security,
        layerMaintainability: s.layer_maintainability,
        layerEcosystem: s.layer_ecosystem,
        layerUpgradeImpact: s.layer_upgrade_impact,
        methodologyVersion: s.methodology_version,
        resultGeneratedAt: s.result_generated_at,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
    };
  });
}
