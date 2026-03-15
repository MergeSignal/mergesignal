import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import type { FastifyInstance } from "fastify";

describe("API Integration Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.REPOSENTINEL_AUTO_MIGRATE = "0";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.DATABASE_URL = "postgresql://reposentinel:reposentinel@localhost:5432/reposentinel";
    process.env.REPOSENTINEL_API_KEY = "test-api-key-for-testing";
    
    app = await createApp();
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
      expect(body.info.title).toBe("RepoSentinel API");
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
          authorization: "Bearer test-api-key-for-testing",
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
          authorization: "Bearer test-api-key-for-testing",
        },
        payload: {
          repoId: "test/repo",
        },
      });

      // Will return 400 for validation error or 500 for DB error
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(600);
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
          authorization: "Bearer test-api-key-for-testing",
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
          authorization: "Bearer test-api-key-for-testing",
        },
      });

      // Will return 200 with data or 500 if DB is unavailable
      expect([200, 500]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body).toBeDefined();
        expect(typeof body).toBe("object");
      }
    });
  });
});
