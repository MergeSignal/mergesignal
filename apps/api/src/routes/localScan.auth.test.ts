import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { scanRoutes } from "./scan.js";
import { __setAcquisitionRedisForTests } from "../acquisition/redis.js";
import type {
  AcquisitionRedis,
  AcquisitionTransaction,
} from "@mergesignal/engine";

vi.mock("../db.js", () => ({
  db: {},
  queries: {
    scans: {
      findById: vi.fn(),
      findByRepoId: vi.fn(),
    },
  },
}));

vi.mock("../services/scanService.js", () => ({
  createScanAndEnqueue: vi.fn(),
}));

vi.mock("../problem.js", () => ({
  sendProblem: vi.fn(
    (
      reply: { code: (status: number) => { send: (body: unknown) => unknown } },
      _req: unknown,
      problem: { status: number; title: string; detail: string },
    ) => reply.code(problem.status).send(problem),
  ),
}));

import { createScanAndEnqueue } from "../services/scanService.js";
import { queries } from "../db.js";

class FakeRedis implements AcquisitionRedis {
  values = new Map<string, string>();
  private watching = false;
  private seen = new Map<string, string | null>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<unknown> {
    this.values.set(key, value);
    return "OK";
  }
  async del(key: string): Promise<unknown> {
    this.values.delete(key);
    return 1;
  }
  async watch(key: string): Promise<unknown> {
    this.watching = true;
    this.seen.set(key, this.values.get(key) ?? null);
    return "OK";
  }
  async unwatch(): Promise<unknown> {
    this.watching = false;
    this.seen.clear();
    return "OK";
  }
  multi(): AcquisitionTransaction {
    const ops: Array<() => void> = [];
    const snapshot = new Map(this.seen);
    const tx: AcquisitionTransaction = {
      set: (key, value) => {
        ops.push(() => this.values.set(key, value));
        return tx;
      },
      del: (key) => {
        ops.push(() => this.values.delete(key));
        return tx;
      },
      exec: async () => {
        if (this.watching) {
          for (const [key, previous] of snapshot) {
            if ((this.values.get(key) ?? null) !== previous) return null;
          }
        }
        for (const op of ops) op();
        this.watching = false;
        this.seen.clear();
        return [];
      },
    };
    return tx;
  }
}

const localBody = {
  local: {
    changeIntent: "change_request",
    headRevision: { sha: "a".repeat(40) },
    changedPaths: ["package.json", "src/app.ts"],
    lockfileAtHead: {
      manager: "pnpm",
      content: "lockfileVersion: '9.0'\n",
      path: "pnpm-lock.yaml",
    },
  },
};

describe("local scan ingress", () => {
  let app: FastifyInstance;
  let authenticatedOwner: string | undefined;
  const redis = new FakeRedis();

  beforeEach(async () => {
    authenticatedOwner = "acme";
    __setAcquisitionRedisForTests(redis);
    app = Fastify();
    app.decorateRequest("authenticatedOwner", undefined);
    app.addHook("onRequest", async (req) => {
      if (authenticatedOwner) req.authenticatedOwner = authenticatedOwner;
    });
    await scanRoutes(app);
    await app.ready();
    vi.mocked(createScanAndEnqueue).mockReset();
    vi.mocked(createScanAndEnqueue).mockResolvedValue({
      scanId: "server-scan",
    });
    vi.mocked(queries.scans.findById).mockReset();
    redis.values.clear();
  });

  afterEach(async () => {
    __setAcquisitionRedisForTests(null);
    await app.close();
  });

  it("binds the scan to the authenticated owner and ignores a client repository id", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/scan",
      payload: { ...localBody, repoId: "other/repo" },
    });
    expect(response.statusCode).toBe(400);
    expect(createScanAndEnqueue).not.toHaveBeenCalled();

    const accepted = await app.inject({
      method: "POST",
      url: "/scan",
      payload: localBody,
    });
    expect(accepted.statusCode).toBe(202);
    const args = vi.mocked(createScanAndEnqueue).mock.calls[0]?.[0];
    expect(args?.repoId).toBe(`acme/${args?.scanId}`);
    expect(args?.github).toBeUndefined();
    expect(args?.source).toBe("manual");
    expect(args?.dependencyGraph).toBeNull();
    expect(args?.acquiredFacts).toMatchObject({
      repoId: args?.repoId,
      changeIntent: "change_request",
      headRevision: { sha: "a".repeat(40) },
    });
    expect(args?.acquiredFacts).not.toHaveProperty("dependencyGraph");
  });

  it("rejects a missing credential before enqueue", async () => {
    authenticatedOwner = undefined;
    const response = await app.inject({
      method: "POST",
      url: "/scan",
      payload: localBody,
    });
    expect(response.statusCode).toBe(401);
    expect(createScanAndEnqueue).not.toHaveBeenCalled();
  });

  it("hides acquisition from another owner and rejects mismatched fulfillment", async () => {
    const generation = "gen-current";
    redis.values.set(
      "ms:local-acq:scan-9",
      JSON.stringify({
        generation,
        deadlineAt: Date.now() + 60_000,
        phase: "pending",
        objectId: "c".repeat(40),
      }),
    );
    vi.mocked(queries.scans.findById).mockResolvedValue({
      id: "scan-9",
      repo_id: "acme/scan-9",
      status: "running",
      github_pr_number: null,
      github_head_sha: null,
    } as never);

    const visible = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().acquisition).toEqual({
      pending: true,
      objectId: "c".repeat(40),
      generation,
    });
    expect(visible.json()).not.toHaveProperty("plan");

    authenticatedOwner = "other";
    const hidden = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(hidden.statusCode).toBe(403);

    const wrongOwner = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": generation,
        "x-mergesignal-object-id": "c".repeat(40),
      },
      payload: Buffer.from("bytes"),
    });
    expect(wrongOwner.statusCode).toBe(403);

    authenticatedOwner = "acme";
    const wrongGeneration = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": "old-generation",
        "x-mergesignal-object-id": "c".repeat(40),
      },
      payload: Buffer.from("bytes"),
    });
    expect(wrongGeneration.statusCode).toBe(409);

    const wrongObject = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": generation,
        "x-mergesignal-object-id": "d".repeat(40),
      },
      payload: Buffer.from("bytes"),
    });
    expect(wrongObject.statusCode).toBe(409);

    const accepted = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": generation,
        "x-mergesignal-object-id": "c".repeat(40),
      },
      payload: Buffer.from("raw-object"),
    });
    expect(accepted.statusCode).toBe(204);

    const duplicate = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": generation,
        "x-mergesignal-object-id": "c".repeat(40),
      },
      payload: Buffer.from("raw-object"),
    });
    expect(duplicate.statusCode).toBe(409);

    vi.mocked(queries.scans.findById).mockResolvedValue({
      id: "scan-9",
      repo_id: "acme/scan-9",
      status: "done",
      github_pr_number: null,
      github_head_sha: null,
    } as never);
    const finished = await app.inject({
      method: "POST",
      url: "/scan/scan-9/object",
      headers: {
        "content-type": "application/octet-stream",
        "x-mergesignal-acquisition-generation": generation,
        "x-mergesignal-object-id": "c".repeat(40),
      },
      payload: Buffer.from("bytes"),
    });
    expect(finished.statusCode).toBe(409);
  });

  it("returns an authoritative negative acquisition read and omits a failed read", async () => {
    vi.mocked(queries.scans.findById).mockResolvedValue({
      id: "scan-9",
      repo_id: "acme/scan-9",
      status: "running",
      github_pr_number: null,
      github_head_sha: null,
    } as never);

    const empty = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().acquisition).toEqual({ pending: false });

    vi.mocked(queries.scans.findById).mockResolvedValue({
      id: "scan-9",
      repo_id: "acme/scan-9",
      status: "queued",
      github_pr_number: null,
      github_head_sha: null,
    } as never);
    const queued = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(queued.json().acquisition).toEqual({ pending: false });

    redis.values.set(
      "ms:local-acq:scan-9",
      JSON.stringify({
        generation: "4",
        deadlineAt: Date.now() + 60_000,
        phase: "pending",
        objectId: "ab".repeat(20),
      }),
    );
    const pending = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(pending.json().acquisition).toEqual({
      pending: true,
      objectId: "ab".repeat(20),
      generation: "4",
    });

    __setAcquisitionRedisForTests({
      get: async () => {
        throw new Error("redis-backend-down");
      },
    } as unknown as AcquisitionRedis);
    const failed = await app.inject({ method: "GET", url: "/scan/scan-9" });
    expect(failed.statusCode).toBe(200);
    expect(failed.json()).not.toHaveProperty("acquisition");
    expect(failed.body).not.toContain("redis-backend-down");

    __setAcquisitionRedisForTests(null);
    const unavailable = await app.inject({
      method: "GET",
      url: "/scan/scan-9",
    });
    expect(unavailable.statusCode).toBe(200);
    expect(unavailable.json()).not.toHaveProperty("acquisition");
  });
});
