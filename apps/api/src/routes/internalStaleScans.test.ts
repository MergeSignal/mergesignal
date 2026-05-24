import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { internalStaleScansRoutes } from "./internalStaleScans.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
}));

import { db } from "../db.js";

describe("internalStaleScansRoutes", () => {
  const originalEnv = process.env;
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    app = Fastify();
    await internalStaleScansRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.close();
  });

  it("returns 503 when MERGESIGNAL_INTERNAL_API_KEY is unset", async () => {
    delete process.env.MERGESIGNAL_INTERNAL_API_KEY;
    const res = await app.inject({
      method: "POST",
      url: "/internal/sweep-stale-scans",
      headers: { authorization: "Bearer x" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 401 for wrong bearer token", async () => {
    process.env.MERGESIGNAL_INTERNAL_API_KEY = "secret";
    const res = await app.inject({
      method: "POST",
      url: "/internal/sweep-stale-scans",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("runs UPDATE and returns row count on success", async () => {
    process.env.MERGESIGNAL_INTERNAL_API_KEY = "secret";
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rowCount: 3 } as never)
      .mockResolvedValueOnce({ rowCount: 5 } as never);

    const res = await app.inject({
      method: "POST",
      url: "/internal/sweep-stale-scans?staleMinutes=10",
      headers: { authorization: "Bearer secret" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      staleMinutes: 10,
      scansMarkedFailed: 3,
      orphanedQueuedScansMarkedFailed: 5,
    });
    expect(vi.mocked(db.query).mock.calls[0]![1]).toEqual([10]);
    expect(vi.mocked(db.query).mock.calls[1]![1]).toEqual([10]);
  });
});
