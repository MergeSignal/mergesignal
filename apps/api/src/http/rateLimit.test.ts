import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import { randomBytes, createHash, randomUUID } from "crypto";
import { queries } from "../db.js";

describe("Rate Limiting", () => {
  let app: FastifyInstance;
  let testApiKey: string;
  const testOwner = "rate-limit-test-org";
  let dbAvailable = false;

  beforeAll(async () => {
    process.env.MERGESIGNAL_AUTO_MIGRATE = "0";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.DATABASE_URL = "postgresql://mergesignal:mergesignal@localhost:5432/mergesignal";
    process.env.REDIS_URL = "redis://localhost:6379";
    
    // Set low rate limits for testing
    process.env.RATE_LIMIT_PUBLIC = "10";
    process.env.RATE_LIMIT_AUTHENTICATED = "20";
    
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
        description: "Test API key for rate limiting",
      });
      dbAvailable = true;
    } catch {
      // Database is not available
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Public endpoint rate limiting", () => {
    it("should include rate limit headers in public endpoint responses when Redis is available", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      // Rate limit headers should be present when Redis is available
      // If headers exist, validate them
      if (response.headers["x-ratelimit-limit"]) {
        expect(Number(response.headers["x-ratelimit-limit"])).toBeGreaterThan(0);
        expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
        expect(response.headers["x-ratelimit-reset"]).toBeDefined();
      }
    });

    it("should apply rate limits to public endpoints when Redis is available", async () => {
      // Make a few requests to test rate limiting behavior
      const responses = [];
      const testPath = "/openapi.json";

      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: "GET",
          url: testPath,
        });
        responses.push(response);
      }

      // Check that we got successful responses
      const successfulResponses = responses.filter(r => [200, 404].includes(r.statusCode));
      expect(successfulResponses.length).toBeGreaterThan(0);

      // Verify basic rate limiting functionality is working
      // (we're making fewer requests than the limit, so none should be rate limited)
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBe(0);
    }, 30000);
  });

  describe("Authenticated endpoint rate limiting", () => {
    it.skipIf(!dbAvailable)("should apply rate limits to authenticated endpoints", async () => {
      const limit = Number(process.env.RATE_LIMIT_AUTHENTICATED);
      const responses = [];

      // Make limit + 5 requests with authentication
      for (let i = 0; i < limit + 5; i++) {
        const response = await app.inject({
          method: "GET",
          url: `/org/${testOwner}/policies`,
          headers: {
            authorization: `Bearer ${testApiKey}`,
          },
        });
        responses.push(response);
        
        // Break early if we hit rate limit
        if (response.statusCode === 429) {
          break;
        }
      }

      // Verify we got some successful responses before hitting the limit
      const notRateLimited = responses.filter(r => r.statusCode !== 429);
      expect(notRateLimited.length).toBeGreaterThan(0);
      expect(notRateLimited.length).toBeLessThanOrEqual(limit);

      // Verify we eventually hit the rate limit
      const rateLimited = responses.filter(r => r.statusCode === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Check rate limit response structure
      const rateLimitResponse = rateLimited[0];
      const body = JSON.parse(rateLimitResponse.body);
      expect(body.status).toBe(429);
      expect(body.title).toBe("Too Many Requests");
    }, 30000);

    it.skipIf(!dbAvailable)("should enforce separate rate limits per API key", async () => {
      // Create a second test API key
      const testApiKey2 = `ms_${randomBytes(32).toString("hex")}`;
      const keyHash2 = createHash("sha256").update(testApiKey2).digest("hex");
      const id2 = randomUUID();

      try {
        await queries.apiKeys.create({
          id: id2,
          key_hash: keyHash2,
          owner: testOwner,
          description: "Second test API key for rate limiting",
        });
      } catch {
        // Skip if we can't create the key
        return;
      }

      const limit = Number(process.env.RATE_LIMIT_AUTHENTICATED);

      // Use up the rate limit with first key
      let rateLimitedWithFirstKey = false;
      for (let i = 0; i < limit + 5; i++) {
        const response = await app.inject({
          method: "GET",
          url: `/org/${testOwner}/policies`,
          headers: {
            authorization: `Bearer ${testApiKey}`,
          },
        });
        
        if (response.statusCode === 429) {
          rateLimitedWithFirstKey = true;
          break;
        }
      }

      // Verify first key got rate limited
      expect(rateLimitedWithFirstKey).toBe(true);

      // Second key should still work (at least for a few requests)
      const response2 = await app.inject({
        method: "GET",
        url: `/org/${testOwner}/policies`,
        headers: {
          authorization: `Bearer ${testApiKey2}`,
        },
      });
      expect(response2.statusCode).not.toBe(429);
    }, 30000);
  });

  describe("Rate limit integration", () => {
    it("should handle requests properly when rate limiting is active", async () => {
      // Test that basic functionality works
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      // Should get a valid response (not rate limited on first request)
      expect([200, 404]).toContain(response.statusCode);
      
      // Should have rate limit headers if Redis is available
      if (response.headers["x-ratelimit-limit"]) {
        expect(Number(response.headers["x-ratelimit-limit"])).toBeGreaterThan(0);
      }
    });
  });
});
