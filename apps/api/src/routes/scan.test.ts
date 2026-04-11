import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { scanRoutes } from "./scan.js";
import type { ScanRequest } from "@mergesignal/shared";

// Mock dependencies
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
  sendProblem: vi.fn((reply, req, problem) => {
    return reply.code(problem.status).send({
      status: problem.status,
      title: problem.title,
      detail: problem.detail,
    });
  }),
}));

import { createScanAndEnqueue } from "../services/scanService.js";
import { queries } from "../db.js";

describe("scan routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    
    // Mock authentication decorator
    app.decorateRequest("authenticatedOwner", null);
    
    await scanRoutes(app);
    await app.ready();
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /scan", () => {
    it("should accept valid scan request and return 202 with scanId", async () => {
      const mockScanId = "scan_123";
      vi.mocked(createScanAndEnqueue).mockResolvedValue({ scanId: mockScanId });

      const scanRequest: ScanRequest = {
        repoId: "owner/repo",
        dependencyGraph: {
          nodes: [{ id: "pkg@1.0.0", name: "pkg", version: "1.0.0" }],
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(202);
      expect(JSON.parse(response.body)).toEqual({
        scanId: mockScanId,
        status: "queued",
      });
      expect(createScanAndEnqueue).toHaveBeenCalledWith({
        repoId: "owner/repo",
        dependencyGraph: scanRequest.dependencyGraph,
        lockfile: undefined,
        source: "manual",
      });
    });

    it("should accept scan request with lockfile", async () => {
      const mockScanId = "scan_456";
      vi.mocked(createScanAndEnqueue).mockResolvedValue({ scanId: mockScanId });

      const scanRequest: ScanRequest = {
        repoId: "owner/repo",
        dependencyGraph: {},
        lockfile: {
          manager: "pnpm",
          content: "lockfileVersion: '9.0'",
          path: "pnpm-lock.yaml",
        },
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(202);
      expect(createScanAndEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          lockfile: scanRequest.lockfile,
        })
      );
    });

    it("should return 403 when org-scoped API key tries to scan another org's repo", async () => {
      // Mock authenticated owner
      app.addHook("onRequest", async (req) => {
        (req as any).authenticatedOwner = "org1";
      });

      const scanRequest: ScanRequest = {
        repoId: "org2/repo",
        dependencyGraph: {},
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Forbidden");
      expect(body.detail).toBe("Access denied to this repository");
    });

    it("should allow org-scoped API key to scan own repo", async () => {
      const mockScanId = "scan_789";
      vi.mocked(createScanAndEnqueue).mockResolvedValue({ scanId: mockScanId });

      // Mock authenticated owner
      app.addHook("onRequest", async (req) => {
        (req as any).authenticatedOwner = "myorg";
      });

      const scanRequest: ScanRequest = {
        repoId: "myorg/repo",
        dependencyGraph: {},
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(202);
      expect(JSON.parse(response.body)).toMatchObject({
        scanId: mockScanId,
        status: "queued",
      });
    });

    it("should return 413 when lockfile is too large", async () => {
      const error = new Error("Payload too large");
      (error as any).statusCode = 413;
      vi.mocked(createScanAndEnqueue).mockRejectedValue(error);

      const scanRequest: ScanRequest = {
        repoId: "owner/repo",
        dependencyGraph: {},
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Payload Too Large");
    });

    it("should return 429 when scan quota is exceeded", async () => {
      const error = new Error("Rate limit exceeded");
      (error as any).statusCode = 429;
      vi.mocked(createScanAndEnqueue).mockRejectedValue(error);

      const scanRequest: ScanRequest = {
        repoId: "owner/repo",
        dependencyGraph: {},
      };

      const response = await app.inject({
        method: "POST",
        url: "/scan",
        payload: scanRequest,
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Too Many Requests");
    });
  });

  describe("GET /scan/:id", () => {
    it("should return scan by id", async () => {
      const mockScan = {
        id: "scan_123",
        repo_id: "owner/repo",
        status: "done",
        created_at: new Date().toISOString(),
      };
      vi.mocked(queries.scans.findById).mockResolvedValue(mockScan);

      const response = await app.inject({
        method: "GET",
        url: "/scan/scan_123",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockScan);
      expect(queries.scans.findById).toHaveBeenCalledWith("scan_123");
    });

    it("should return 404 when scan not found", async () => {
      vi.mocked(queries.scans.findById).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/scan/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Not Found");
    });

    it("should return 403 when org-scoped API key tries to access another org's scan", async () => {
      const mockScan = {
        id: "scan_123",
        repo_id: "org2/repo",
        status: "done",
        created_at: new Date().toISOString(),
      };
      vi.mocked(queries.scans.findById).mockResolvedValue(mockScan);

      // Mock authenticated owner
      app.addHook("onRequest", async (req) => {
        (req as any).authenticatedOwner = "org1";
      });

      const response = await app.inject({
        method: "GET",
        url: "/scan/scan_123",
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Forbidden");
    });
  });

  describe("GET /scans", () => {
    it("should return scans for a repository", async () => {
      const mockScans = [
        { id: "scan_1", repo_id: "owner/repo", status: "done" },
        { id: "scan_2", repo_id: "owner/repo", status: "queued" },
      ];
      vi.mocked(queries.scans.findByRepoId).mockResolvedValue(mockScans);

      const response = await app.inject({
        method: "GET",
        url: "/scans?repoId=owner/repo",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.repoId).toBe("owner/repo");
      expect(body.scans).toEqual(mockScans);
      expect(queries.scans.findByRepoId).toHaveBeenCalledWith("owner/repo", 50);
    });

    it("should respect limit parameter", async () => {
      vi.mocked(queries.scans.findByRepoId).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/scans?repoId=owner/repo&limit=10",
      });

      expect(response.statusCode).toBe(200);
      expect(queries.scans.findByRepoId).toHaveBeenCalledWith("owner/repo", 10);
    });

    it("should cap limit at 200", async () => {
      vi.mocked(queries.scans.findByRepoId).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/scans?repoId=owner/repo&limit=500",
      });

      expect(response.statusCode).toBe(200);
      expect(queries.scans.findByRepoId).toHaveBeenCalledWith("owner/repo", 200);
    });

    it("should return 400 when repoId is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/scans",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Bad Request");
      expect(body.detail).toBe("repoId is required");
    });

    it("should return 403 when org-scoped API key tries to access another org's scans", async () => {
      // Mock authenticated owner
      app.addHook("onRequest", async (req) => {
        (req as any).authenticatedOwner = "org1";
      });

      const response = await app.inject({
        method: "GET",
        url: "/scans?repoId=org2/repo",
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Forbidden");
    });
  });
});
