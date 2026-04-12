import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { FastifyInstance } from "fastify";
import Fastify from "fastify";
import rawBody from "fastify-raw-body";

// Mock dependencies
vi.mock("../db.js", () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock("../services/scanService.js", () => ({
  createScanAndEnqueue: vi.fn(),
}));

vi.mock("../services/repoSourceService.js", () => ({
  upsertGithubRepoSource: vi.fn(),
}));

vi.mock("../services/githubFileService.js", () => ({
  filterRelevantSourceFiles: vi.fn(),
}));

vi.mock("../problem.js", () => ({
  sendProblem: vi.fn((reply: { code: (s: number) => { send: (b: unknown) => unknown } }, _req: unknown, problem: { status: number; title: string; detail: string }) => {
    return reply.code(problem.status).send({
      status: problem.status,
      title: problem.title,
      detail: problem.detail,
    });
  }),
}));

describe("GitHub Webhook Tests", () => {
  const webhookSecret = "test-webhook-secret";

  function signPayload(payload: string): string {
    const mac = createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");
    return `sha256=${mac}`;
  }

  function verifySignature(body: string, signatureHeader: string, secret: string) {
    if (!signatureHeader.startsWith("sha256=")) return false;
    const sig = signatureHeader.slice("sha256=".length);
    const mac = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    try {
      const sigBuf = Buffer.from(sig, "hex");
      const macBuf = Buffer.from(mac, "hex");
      if (sigBuf.length !== macBuf.length) return false;
      return sigBuf.equals(macBuf);
    } catch {
      return false;
    }
  }

  describe("Webhook signature verification", () => {
    it("should verify valid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = signPayload(payload);
      expect(verifySignature(payload, signature, webhookSecret)).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const invalidSignature = "sha256=invalid";
      expect(verifySignature(payload, invalidSignature, webhookSecret)).toBe(false);
    });

    it("should reject signature without sha256 prefix", () => {
      const payload = JSON.stringify({ test: "data" });
      expect(verifySignature(payload, "invalid", webhookSecret)).toBe(false);
    });

    it("should reject tampered payload", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = signPayload(payload);
      const tamperedPayload = JSON.stringify({ test: "tampered" });
      expect(verifySignature(tamperedPayload, signature, webhookSecret)).toBe(false);
    });
  });

  describe("Webhook route handler", () => {
    let app: FastifyInstance;
    const originalEnv = process.env;

    beforeEach(async () => {
      // Set up environment for webhook config
      process.env = {
        ...originalEnv,
        GITHUB_APP_ID: "123456",
        GITHUB_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\ntest\\n-----END RSA PRIVATE KEY-----",
        GITHUB_WEBHOOK_SECRET: webhookSecret,
      };

      app = Fastify();
      await app.register(rawBody, { field: "rawBody", global: false, encoding: "utf8", runFirst: true });
      
      // Import and register routes after env is set
      const { githubWebhookRoutes } = await import("./githubWebhook.js");
      await githubWebhookRoutes(app);
      await app.ready();
      
      vi.clearAllMocks();
    });

    afterEach(async () => {
      await app.close();
      process.env = originalEnv;
    });

    it("should return 503 when webhook is not configured", async () => {
      // Close and recreate app without config
      await app.close();
      process.env = { ...originalEnv };
      
      app = Fastify();
      await app.register(rawBody, { field: "rawBody", global: false, encoding: "utf8", runFirst: true });
      const { githubWebhookRoutes } = await import("./githubWebhook.js");
      await githubWebhookRoutes(app);
      await app.ready();

      const payload = JSON.stringify({ action: "opened" });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
          "x-github-delivery": "test-delivery-1",
        },
        payload,
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Service Unavailable");
    });

    it("should return 400 when raw body is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "x-github-event": "pull_request",
          "x-github-delivery": "test-delivery-2",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Bad Request");
      expect(body.detail).toBe("Missing raw body");
    });

    it("should return 401 when signature is invalid", async () => {
      const payload = JSON.stringify({ action: "opened" });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "sha256=invalidsignature",
          "x-github-event": "pull_request",
          "x-github-delivery": "test-delivery-3",
        },
        payload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Unauthorized");
      expect(body.detail).toBe("Invalid signature");
    });

    it("should return 400 when delivery ID is missing", async () => {
      const payload = JSON.stringify({ action: "opened" });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
        },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("Missing delivery ID");
    });

    it("should accept valid pull_request webhook", async () => {
      const { db } = await import("../db.js");
      vi.mocked(db.query).mockResolvedValue({ rowCount: 1, rows: [], command: "", oid: 0, fields: [] } as never);

      const payload = JSON.stringify({
        action: "opened",
        installation: { id: 12345 },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
        pull_request: { number: 1, head: { sha: "abc123" }, base: { sha: "def456" } },
      });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
          "x-github-delivery": "test-delivery-4",
        },
        payload,
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
      expect(body.delivery).toBe("test-delivery-4");
    });

    it("should accept valid push webhook", async () => {
      const { db } = await import("../db.js");
      vi.mocked(db.query).mockResolvedValue({ rowCount: 1, rows: [], command: "", oid: 0, fields: [] } as never);

      const payload = JSON.stringify({
        installation: { id: 12345 },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
        ref: "refs/heads/main",
        after: "abc123",
        commits: [{ modified: ["package.json", "pnpm-lock.yaml"] }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "push",
          "x-github-delivery": "test-delivery-5",
        },
        payload,
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
    });

    it("should ignore unsupported webhook events", async () => {
      const { db } = await import("../db.js");
      vi.mocked(db.query).mockResolvedValue({ rowCount: 1, rows: [], command: "", oid: 0, fields: [] } as never);

      const payload = JSON.stringify({ action: "created" });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "repository",
          "x-github-delivery": "test-delivery-6",
        },
        payload,
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.accepted).toBe(true);
    });

    it("should detect and ignore duplicate deliveries", async () => {
      const { db } = await import("../db.js");
      // First call returns 1 row (new), second returns 0 (duplicate)
      vi.mocked(db.query).mockResolvedValueOnce({ rowCount: 1, rows: [], command: "", oid: 0, fields: [] } as never);
      vi.mocked(db.query).mockResolvedValueOnce({ rowCount: 0, rows: [], command: "", oid: 0, fields: [] } as never);

      const payload = JSON.stringify({ action: "opened" });
      const deliveryId = "test-delivery-duplicate";

      // First delivery
      const response1 = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
          "x-github-delivery": deliveryId,
        },
        payload,
      });

      expect(response1.statusCode).toBe(202);
      expect(JSON.parse(response1.body).duplicate).toBeUndefined();

      // Duplicate delivery
      const response2 = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
          "x-github-delivery": deliveryId,
        },
        payload,
      });

      expect(response2.statusCode).toBe(202);
      expect(JSON.parse(response2.body).duplicate).toBe(true);
    });
  });
});
