import { createHmac } from "crypto";
import Fastify, { type FastifyInstance } from "fastify";
import rawBody from "fastify-raw-body";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  createScanAndEnqueue: vi.fn(),
}));

vi.mock("@octokit/app", () => ({
  App: class App {
    getInstallationOctokit() {
      return Promise.resolve({ request: mocks.request });
    }
  },
}));

vi.mock("../db.js", () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock("../services/scanService.js", () => ({
  createScanAndEnqueue: (...args: unknown[]) =>
    mocks.createScanAndEnqueue(...args),
}));

vi.mock("../services/repoSourceService.js", () => ({
  upsertGithubRepoSource: vi.fn().mockResolvedValue(undefined),
}));

const webhookSecret = "test-webhook-secret";
const lockfileContent = Buffer.from(
  "lockfileVersion: '9.0'\n",
  "utf8",
).toString("base64");

function signPayload(payload: string): string {
  return `sha256=${createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex")}`;
}

describe("GitHub pull-request changeIntent", () => {
  let app: FastifyInstance;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      GITHUB_APP_ID: "123456",
      GITHUB_PRIVATE_KEY:
        "-----BEGIN RSA PRIVATE KEY-----\\ntest\\n-----END RSA PRIVATE KEY-----",
      GITHUB_WEBHOOK_SECRET: webhookSecret,
    };
    mocks.request.mockReset();
    mocks.createScanAndEnqueue.mockReset();
    mocks.createScanAndEnqueue.mockResolvedValue({ scanId: "scan-1" });
    mocks.request.mockImplementation(async (route: string) => {
      if (route.includes("/pulls/")) {
        return {
          data: [{ filename: "pnpm-lock.yaml" }, { filename: "src/app.ts" }],
        };
      }
      return { data: { content: lockfileContent } };
    });

    const { db } = await import("../db.js");
    vi.mocked(db.query).mockResolvedValue({
      rowCount: 1,
      rows: [],
      command: "",
      oid: 0,
      fields: [],
    } as never);

    app = Fastify();
    await app.register(rawBody, {
      field: "rawBody",
      global: false,
      encoding: "utf8",
      runFirst: true,
    });
    const { githubWebhookRoutes } = await import("./githubWebhook.js");
    await githubWebhookRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    process.env = originalEnv;
  });

  it.each(["opened", "reopened", "synchronize"] as const)(
    "sets change_request intent for pull_request %s",
    async (action) => {
      const payload = JSON.stringify({
        action,
        installation: { id: 12345 },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
        pull_request: {
          number: 7,
          head: { sha: "abc123" },
          base: { sha: "def456", ref: "main" },
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/github/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signPayload(payload),
          "x-github-event": "pull_request",
          "x-github-delivery": `delivery-${action}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(202);
      await vi.waitFor(() => {
        expect(mocks.createScanAndEnqueue).toHaveBeenCalledTimes(1);
      });
      expect(mocks.createScanAndEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          changeIntent: "change_request",
          github: expect.objectContaining({
            owner: "test-owner",
            repo: "test-repo",
            prNumber: 7,
            headSha: "abc123",
          }),
        }),
      );
    },
  );

  it("does not set change_request intent for a push event", async () => {
    const payload = JSON.stringify({
      installation: { id: 12345 },
      repository: { name: "test-repo", owner: { login: "test-owner" } },
      ref: "refs/heads/main",
      after: "abc123",
      commits: [{ modified: ["pnpm-lock.yaml"] }],
    });

    const response = await app.inject({
      method: "POST",
      url: "/github/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signPayload(payload),
        "x-github-event": "push",
        "x-github-delivery": "delivery-push",
      },
      payload,
    });

    expect(response.statusCode).toBe(202);
    await vi.waitFor(() => {
      expect(mocks.createScanAndEnqueue).toHaveBeenCalledTimes(1);
    });
    const enqueued = mocks.createScanAndEnqueue.mock.calls[0]?.[0] as {
      changeIntent?: string;
      github?: unknown;
    };
    expect(enqueued.changeIntent).toBeUndefined();
    expect(enqueued.github).toBeUndefined();
  });
});
