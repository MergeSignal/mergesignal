import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SerializableScanAcquiredFacts } from "@mergesignal/shared";
import { MAX_OBJECT_BYTES } from "@mergesignal/engine";
import { getLimitsForOwner } from "../services/tier.js";

const objectId = z
  .string()
  .regex(/^[0-9a-f]{40}$|^[0-9a-f]{64}$/i)
  .transform((value) => value.toLowerCase());

const lockfile = z.object({
  manager: z.enum(["pnpm", "npm", "yarn"]),
  content: z.string(),
  path: z.string().min(1).max(1024).optional(),
});

const revision = z.object({
  sha: objectId,
  ref: z.string().min(1).max(256).optional(),
});

function safePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.length > 4096 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }
  return path
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}

export const localScanBodySchema = z
  .object({
    local: z
      .object({
        changeIntent: z.enum(["change_request", "repository_scope"]),
        headRevision: revision,
        baseRevision: revision.optional(),
        changedPaths: z.array(z.string().refine(safePath)).max(5000).optional(),
        lockfileAtHead: lockfile.optional(),
        lockfileAtBase: lockfile.optional(),
      })
      .strict(),
  })
  .strict();

export type LocalScanBody = z.infer<typeof localScanBodySchema>;

function localScanIdentity(
  owner: string,
  scanId = randomUUID(),
): { scanId: string; repoId: string } {
  return { scanId, repoId: `${owner}/${scanId}` };
}

export function localScanEnqueueArgs(owner: string, body: LocalScanBody) {
  const { scanId, repoId } = localScanIdentity(owner);
  const local = body.local;
  const limits = getLimitsForOwner(owner);
  for (const file of [local.lockfileAtHead, local.lockfileAtBase]) {
    if (!file) continue;
    if (Buffer.byteLength(file.content, "utf8") > limits.scanMaxLockfileBytes) {
      throw Object.assign(new Error("lockfile too large"), { statusCode: 413 });
    }
  }
  const acquiredFacts: SerializableScanAcquiredFacts = {
    repoId,
    changeIntent: local.changeIntent,
    headRevision: local.headRevision,
    ...(local.baseRevision ? { baseRevision: local.baseRevision } : {}),
    ...(local.changedPaths ? { changedPaths: local.changedPaths } : {}),
    ...(local.lockfileAtHead ? { lockfileAtHead: local.lockfileAtHead } : {}),
    ...(local.lockfileAtBase ? { lockfileAtBase: local.lockfileAtBase } : {}),
  };
  const changedPaths = local.changedPaths;
  return {
    scanId,
    repoId,
    dependencyGraph: null,
    lockfile: local.lockfileAtHead,
    baseLockfile: local.lockfileAtBase,
    changedFiles: changedPaths,
    changedPackageJsonFiles: changedPaths?.filter(
      (path) => path === "package.json" || path.endsWith("/package.json"),
    ),
    changeIntent: local.changeIntent,
    acquiredFacts,
    source: "manual" as const,
  };
}

export function registerObjectBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser(
    "application/octet-stream",
    { bodyLimit: MAX_OBJECT_BYTES },
    (_request, payload, done) => {
      const chunks: Buffer[] = [];
      let total = 0;
      payload.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_OBJECT_BYTES) {
          done(
            Object.assign(new Error("object too large"), { statusCode: 413 }),
            undefined,
          );
          return;
        }
        chunks.push(chunk);
      });
      payload.on("end", () => done(null, Buffer.concat(chunks)));
      payload.on("error", (error: Error) => done(error, undefined));
    },
  );
}

export function ownerOfRepoId(repoId: string): string {
  return repoId.includes("/") ? repoId.split("/")[0]! : repoId;
}

export function requireScanOwner(
  req: FastifyRequest,
  reply: FastifyReply,
  repoId: string,
  sendProblem: (
    reply: FastifyReply,
    req: FastifyRequest,
    problem: { status: number; title: string; detail: string },
  ) => unknown,
): boolean {
  if (!req.authenticatedOwner) {
    sendProblem(reply, req, {
      status: 401,
      title: "Unauthorized",
      detail: "Missing or invalid API key",
    });
    return false;
  }
  if (ownerOfRepoId(repoId) !== req.authenticatedOwner) {
    sendProblem(reply, req, {
      status: 403,
      title: "Forbidden",
      detail: "Access denied to this scan",
    });
    return false;
  }
  return true;
}
