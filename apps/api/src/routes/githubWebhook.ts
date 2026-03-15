import type { FastifyInstance } from "fastify";
import { App } from "@octokit/app";
import { createHmac, timingSafeEqual } from "crypto";
import { createScanAndEnqueue } from "../services/scanService.js";
import { upsertGithubRepoSource } from "../services/repoSourceService.js";
import { sendProblem } from "../problem.js";
import { db } from "../db.js";

type PullRequestEvent = {
  action?: string;
  installation?: { id: number };
  repository?: { name: string; owner?: { login: string } };
  pull_request?: { number: number; head?: { sha: string }; base?: { sha: string } };
};

type PushEvent = {
  installation?: { id: number };
  repository?: { name: string; owner?: { name?: string; login?: string } };
  ref?: string;
  after?: string;
  commits?: Array<{ added?: string[]; modified?: string[]; removed?: string[] }>;
  head_commit?: { added?: string[]; modified?: string[]; removed?: string[] };
};

const LOCKFILE_CANDIDATES = [
  { path: "pnpm-lock.yaml", manager: "pnpm" as const },
  { path: "package-lock.json", manager: "npm" as const },
  { path: "yarn.lock", manager: "yarn" as const },
];

export async function githubWebhookRoutes(app: FastifyInstance) {
  const appId = process.env.GITHUB_APP_ID ? Number(process.env.GITHUB_APP_ID) : undefined;
  const privateKeyRaw = process.env.GITHUB_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  const configured = Boolean(appId && privateKeyRaw && webhookSecret);
  const privateKey = privateKeyRaw
    ? privateKeyRaw.includes("\\n")
      ? privateKeyRaw.replace(/\\n/g, "\n")
      : privateKeyRaw
    : undefined;
  const ghApp = configured && privateKey ? new App({ appId: appId!, privateKey }) : null;

  app.post("/github/webhook", { config: { rawBody: true } }, async (req, reply) => {
    if (!configured || !webhookSecret || !ghApp) {
      app.log.warn(
        { hasAppId: Boolean(appId), hasKey: Boolean(privateKeyRaw), hasSecret: Boolean(webhookSecret) },
        "GitHub webhook hit but not configured",
      );
      return sendProblem(reply, req, {
        status: 503,
        title: "Service Unavailable",
        detail: "GitHub webhook not configured",
      });
    }

    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "Missing raw body" });

    const sig = String(req.headers["x-hub-signature-256"] ?? "");
    if (!verifySignature(rawBody, sig, webhookSecret)) {
      return sendProblem(reply, req, { status: 401, title: "Unauthorized", detail: "Invalid signature" });
    }

    const event = String(req.headers["x-github-event"] ?? "");
    const delivery = String(req.headers["x-github-delivery"] ?? "");
    const payload = JSON.parse(rawBody);

    if (!delivery) {
      return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "Missing delivery ID" });
    }

    const duplicate = await checkAndRecordDelivery(delivery, event);
    if (duplicate) {
      app.log.info({ delivery, event }, "Duplicate webhook delivery ignored");
      return reply.code(202).send({ accepted: true, duplicate: true, delivery });
    }

    reply.code(202).send({ accepted: true, delivery });

    if (event === "pull_request") {
      processWebhookAsync(app, ghApp, "pull_request", payload as PullRequestEvent, delivery);
    } else if (event === "push") {
      processWebhookAsync(app, ghApp, "push", payload as PushEvent, delivery);
    } else {
      app.log.info({ event, delivery }, "Ignored webhook event");
    }
  });
}

async function checkAndRecordDelivery(deliveryId: string, eventType: string): Promise<boolean> {
  try {
    const result = await db.query(
      "INSERT INTO webhook_deliveries (delivery_id, event_type) VALUES ($1, $2) ON CONFLICT (delivery_id) DO NOTHING RETURNING delivery_id",
      [deliveryId, eventType],
    );
    return result.rowCount === 0;
  } catch (e) {
    return false;
  }
}

async function processWebhookAsync(
  app: FastifyInstance,
  ghApp: App,
  event: "pull_request" | "push",
  payload: PullRequestEvent | PushEvent,
  delivery: string,
) {
  try {
    if (event === "pull_request") {
      const res = await handlePullRequest(ghApp, payload as PullRequestEvent, delivery);
      app.log.info({ delivery, event, result: res }, "Webhook processed");
    } else if (event === "push") {
      const res = await handlePush(ghApp, payload as PushEvent, delivery);
      app.log.info({ delivery, event, result: res }, "Webhook processed");
    }
  } catch (e: any) {
    app.log.error({ delivery, event, error: e?.message ?? String(e) }, "Webhook processing failed");
  }
}

async function handlePullRequest(app: App, payload: PullRequestEvent, delivery: string) {
  const action = payload.action ?? "";
  if (!["opened", "reopened", "synchronize"].includes(action)) return { ignored: true, reason: "action", action };

  const installationId = payload.installation?.id;
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number;
  const headSha = payload.pull_request?.head?.sha;
  const baseSha = payload.pull_request?.base?.sha;

  if (!installationId || !owner || !repo || !number || !headSha) {
    return { ignored: true, reason: "missing_fields" };
    }

  const octokit = await app.getInstallationOctokit(installationId);
  const files = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });

  const changed = files.data.map((f: any) => String(f.filename));
  const match = pickLockfilePath(changed);
  if (!match) return { ignored: true, reason: "no_lockfile_change" };

  const contents = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: match.path,
    ref: headSha,
  });

  const b64 = (contents.data as any)?.content;
  if (!b64 || typeof b64 !== "string") return { ignored: true, reason: "missing_lockfile_content" };

  const lockfileContent = Buffer.from(b64, "base64").toString("utf8");

  const baseLockfileContent = baseSha
    ? await tryFetchLockfile(octokit, { owner, repo, path: match.path, ref: baseSha })
    : null;

  const repoId = `${owner}/${repo}`;
  await upsertGithubRepoSource({
    repoId,
    owner,
    repo,
    installationId,
    lockfilePath: match.path,
    lockfileManager: match.manager,
  });
  const scanId = delivery || undefined;
  try {
    const { scanId: created } = await createScanAndEnqueue({
      scanId,
      repoId,
      dependencyGraph: {},
      lockfile: { manager: match.manager, content: lockfileContent, path: match.path },
      baseLockfile: baseLockfileContent
        ? { manager: match.manager, content: baseLockfileContent, path: match.path }
        : undefined,
      github: {
        owner,
        repo,
        prNumber: number,
        headSha,
        baseSha,
        installationId,
        deliveryId: delivery || undefined,
      },
      source: "github",
    });

    return { queued: true, scanId: created, repoId, source: "pull_request", pr: number, headSha, baseSha };
  } catch (e: any) {
    const code = Number(e?.statusCode ?? 500);
    if (code === 413) return { ignored: true, reason: "lockfile_too_large" };
    if (code === 429) return { ignored: true, reason: "quota_exceeded" };
    throw e;
  }
}

async function handlePush(app: App, payload: PushEvent, delivery: string) {
  const installationId = payload.installation?.id;
  const repo = payload.repository?.name;
  const owner = payload.repository?.owner?.name ?? payload.repository?.owner?.login;
  const ref = payload.ref;
  const sha = payload.after;
  if (!installationId || !owner || !repo || !sha) return { ignored: true, reason: "missing_fields" };

  const changed = flattenCommitFiles(payload.commits ?? (payload.head_commit ? [payload.head_commit] : []));
  const match = pickLockfilePath(changed);
  if (!match) return { ignored: true, reason: "no_lockfile_change" };

  const octokit = await app.getInstallationOctokit(installationId);
  const contents = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: match.path,
    ref: sha,
  });

  const b64 = (contents.data as any)?.content;
  if (!b64 || typeof b64 !== "string") return { ignored: true, reason: "missing_lockfile_content" };

  const lockfileContent = Buffer.from(b64, "base64").toString("utf8");

  const repoId = `${owner}/${repo}`;
  const defaultBranch =
    typeof ref === "string" && ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : undefined;
  await upsertGithubRepoSource({
    repoId,
    owner,
    repo,
    installationId,
    lockfilePath: match.path,
    lockfileManager: match.manager,
    defaultBranch,
  });
  const scanId = delivery || undefined;
  try {
    const { scanId: created } = await createScanAndEnqueue({
      scanId,
      repoId,
      dependencyGraph: {},
      lockfile: { manager: match.manager, content: lockfileContent, path: match.path },
      source: "github",
    });

    return { queued: true, scanId: created, repoId, source: "push", sha };
  } catch (e: any) {
    const code = Number(e?.statusCode ?? 500);
    if (code === 413) return { ignored: true, reason: "lockfile_too_large" };
    if (code === 429) return { ignored: true, reason: "quota_exceeded" };
    throw e;
  }
}

function verifySignature(body: string, signatureHeader: string, secret: string) {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const sig = signatureHeader.slice("sha256=".length);
  const mac = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(mac, "hex"));
  } catch {
    return false;
  }
}

function flattenCommitFiles(commits: Array<{ added?: string[]; modified?: string[]; removed?: string[] }>) {
  const out: string[] = [];
  for (const c of commits) {
    out.push(...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? []));
  }
  return out;
}

function pickLockfilePath(changedPaths: string[]) {
  for (const c of LOCKFILE_CANDIDATES) {
    const exact = changedPaths.find((p) => p === c.path);
    if (exact) return { path: exact, manager: c.manager };
    const nested = changedPaths.find((p) => p.endsWith(`/${c.path}`));
    if (nested) return { path: nested, manager: c.manager };
  }
  return null;
}

async function tryFetchLockfile(
  octokit: any,
  opts: { owner: string; repo: string; path: string; ref: string },
): Promise<string | null> {
  try {
    const contents = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", opts);
    const b64 = (contents.data as any)?.content;
    if (!b64 || typeof b64 !== "string") return null;
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e: any) {
    const status = Number(e?.status ?? e?.response?.status ?? 0);
    if (status === 404) return null;
    throw e;
  }
}

