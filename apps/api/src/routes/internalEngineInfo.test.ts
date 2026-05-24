import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { internalEngineInfoRoutes } from "./internalEngineInfo.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
}));

import { db } from "../db.js";

describe("internalEngineInfoRoutes", () => {
  const originalEnv = process.env;
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    app = Fastify();
    await internalEngineInfoRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.close();
  });

  it("returns 401 for wrong bearer token", async () => {
    process.env.MERGESIGNAL_INTERNAL_API_KEY = "secret";
    const res = await app.inject({
      method: "GET",
      url: "/internal/engine-info",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns distinct engine release and methodology fields", async () => {
    process.env.MERGESIGNAL_INTERNAL_API_KEY = "secret";
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [
          {
            engine_release_version: "v1.2.3",
            engine_release_git_sha: "sha1",
            methodology_version: "mergesignal-engine/v1.2.3",
            created_at: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            engine_release_version: "v1.2.3",
            engine_release_git_sha: "sha1",
            scan_count: "4",
          },
        ],
      } as never);

    const res = await app.inject({
      method: "GET",
      url: "/internal/engine-info",
      headers: { authorization: "Bearer secret" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recentScans[0].engineReleaseVersion).toBe("v1.2.3");
    expect(body.recentScans[0].methodologyVersion).toBe(
      "mergesignal-engine/v1.2.3",
    );
    expect(body.deployedEngineReleases[0].engineReleaseVersion).toBe("v1.2.3");
  });
});
