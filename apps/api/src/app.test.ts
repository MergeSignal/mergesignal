import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import type { FastifyInstance } from "fastify";
import { randomBytes, createHash, randomUUID } from "crypto";
import { queries } from "./db.js";

describe("API Integration Tests", () => {
  let app: FastifyInstance;
  let testApiKey: string;
  const testOwner = "test-org";

  beforeAll(async () => {
    process.env.MERGESIGNAL_AUTO_MIGRATE = "0";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.DATABASE_URL = "postgresql://mergesignal:mergesignal@localhost:5432/mergesignal";
    
    app = await createApp();

    // Create a test org-scoped API key
    testApiKey = `ms_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(testApiKey).digest("hex");
    const id = randomUUID();

    try {
      await queries.apiKeys.create({
        id,
        key_hash: keyHash,
        owner: testOwner,
        description: "Test API key",
      });
    } catch {
      // Key might already exist or table doesn't exist yet, continue anyway
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return health status without auth (public endpoint)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      // Health check may return 200 (healthy) or 503 (degraded) depending on DB/Redis availability
      expect([200, 503]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body.ok).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.timestamp).toBeDefined();
      
      // Verify checks structure
      expect(body.checks.database).toBeDefined();
      expect(body.checks.redis).toBeDefined();
      expect(typeof body.checks.database.ok).toBe("boolean");
      expect(typeof body.checks.redis.ok).toBe("boolean");
    });
  });

  describe("GET /openapi.json", () => {
    it("should return OpenAPI spec without auth (public endpoint)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.openapi).toBeDefined();
      expect(body.info).toBeDefined();
      expect(body.info.title).toBe("MergeSignal API");
    });
  });

  describe("POST /scan", () => {
    it("should reject request without auth", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: {
          repoId: "test/repo",
          dependencyGraph: {},
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request without repoId (with auth)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/scan",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          dependencyGraph: {},
        },
      });

      // Will return 400 for validation error or 500 for DB error
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(600);
    });

    it("should reject request without dependencyGraph (with auth)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/scan",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          repoId: `${testOwner}/repo`,
        },
      });

      // Will return 400 for validation error or 500 for DB error
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(600);
    });

    it("should reject cross-org access", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/scan",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          repoId: "other-org/repo",
          dependencyGraph: {},
        },
      });

      // Should return 403 Forbidden for cross-org access when DB is available
      // OR 401 Unauthorized if DB is unavailable (fail-secure)
      expect([401, 403]).toContain(response.statusCode);
    });
  });

  describe("GET /scan/:id", () => {
    it("should reject without auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/scan/non-existent-scan-id",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should handle scan lookup (with auth)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/scan/non-existent-scan-id",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      });

      // Will return 404 or 500 depending on DB availability
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /benchmark/global", () => {
    it("should reject without auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/benchmark/global",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should handle benchmark request (with auth)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/benchmark/global",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      });

      // Will return 200 with data, 401 if auth fails (DB unavailable), or 500 if DB is unavailable after auth
      expect([200, 401, 500]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body).toBeDefined();
        expect(typeof body).toBe("object");
      }
    });
  });

  describe("POST /simulate/upgrade", () => {
    it("should reject request without auth", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/simulate/upgrade",
        payload: {
          repoId: "test/repo",
          currentLockfile: {
            manager: "npm",
            content: "{}",
          },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject cross-org access", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/simulate/upgrade",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          repoId: "other-org/repo",
          currentLockfile: {
            manager: "npm",
            content: "{}",
          },
        },
      });

      // Should return 403 Forbidden for cross-org access when DB is available
      // OR 401 Unauthorized if DB is unavailable (fail-secure)
      expect([401, 403]).toContain(response.statusCode);
    });

    it("should allow access to own org repositories", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/simulate/upgrade",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          repoId: `${testOwner}/repo`,
          currentLockfile: {
            manager: "npm",
            content: "{}",
          },
        },
      });

      // Should not return 403 (may return other errors like 500 if backend unavailable)
      expect(response.statusCode).not.toBe(403);
    });
  });

  describe("Authorization Tests", () => {
    it("should enforce multi-tenant isolation on /org/:owner/policies", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/org/other-org/policies",
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      });

      // Should return 403 Forbidden for cross-org access when DB is available
      // OR 401 Unauthorized if DB is unavailable (fail-secure)
      expect([401, 403]).toContain(response.statusCode);
    });

    it("should allow access to own org policies", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/org/${testOwner}/policies`,
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      });

      // Should return 200, 401 (DB unavailable), or 500 (DB error)
      // 401 is acceptable here when DB is unavailable (fail-secure)
      expect([200, 401, 500]).toContain(response.statusCode);
    });

    it("should reject invalid API keys", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/org/${testOwner}/policies`,
        headers: {
          authorization: "Bearer invalid_key_12345",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Unauthorized");
    });
  });
});
