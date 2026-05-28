import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { repoPullRequestScansRoutes } from "./repoPullRequestScans.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
  queries: {},
}));

vi.mock("../problem.js", () => ({
  sendProblem: vi.fn(
    (
      reply: { code: (s: number) => { send: (b: unknown) => unknown } },
      _req: unknown,
      problem: { status: number; title: string; detail: string },
    ) => reply.code(problem.status).send(problem),
  ),
}));

import { db } from "../db.js";

function makeRow(
  overrides: Partial<{
    scan_id: string;
    status: string;
    decision: string | null;
    total_score: number | null;
    github_pr_number: number;
    github_head_sha: string | null;
    github_base_ref: string | null;
    created_at: Date;
    result_generated_at: Date | null;
    result: Record<string, unknown> | null;
  }> = {},
) {
  return {
    scan_id: "scan-1",
    status: "done",
    decision: "risky",
    total_score: 72,
    github_pr_number: 42,
    github_head_sha: "abc123",
    github_base_ref: "main",
    created_at: new Date("2026-01-01T00:00:00Z"),
    result_generated_at: new Date("2026-01-01T00:01:00Z"),
    result: null,
    ...overrides,
  };
}

describe("repoPullRequestScansRoutes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.decorateRequest("authenticatedOwner", undefined);
    await repoPullRequestScansRoutes(app);
    await app.ready();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 400 when owner is missing", async () => {
    // Fastify treats empty path segment as route mismatch, so test with spaces
    const res = await app.inject({
      method: "GET",
      url: "/repo/%20/%20/pull-request-scans",
    });
    // space-only owner triggers 400 from the trim check
    expect(res.statusCode).toBe(400);
  });

  it("returns empty byPrNumber when no PR scans exist", async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.repoId).toBe("acme/frontend");
    expect(body.byPrNumber).toEqual({});
    expect(body.aggregates.totalCovered).toBe(0);
  });

  it("returns one entry per PR with correct shape", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [makeRow()],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body.byPrNumber)).toEqual(["42"]);
    const entry = body.byPrNumber["42"];
    expect(entry.scanId).toBe("scan-1");
    expect(entry.pipelineStatus).toBe("done");
    expect(entry.cardSummary.mergePosture).toBe("risky");
    expect(entry.cardSummary.riskIndex).toBe(72);
    expect(entry.cardSummary.headline).toBe("Risky");
    expect(entry.decision).toBe("risky");
    expect(entry.totalScore).toBe(72);
    expect(entry.githubBaseRef).toBe("main");
    expect(Array.isArray(entry.cardSummary.topAffectedAreas)).toBe(true);
    expect(entry.cardSummary.topAffectedAreas.length).toBeLessThanOrEqual(2);
  });

  it("aggregates decisions correctly", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({ github_pr_number: 1, decision: "risky" }),
        makeRow({ github_pr_number: 2, decision: "needs_review" }),
        makeRow({ github_pr_number: 3, decision: "safe" }),
        makeRow({ github_pr_number: 4, decision: "risky" }),
      ],
      rowCount: 4,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    expect(body.aggregates.totalCovered).toBe(4);
    expect(body.aggregates.byDecision.risky).toBe(2);
    expect(body.aggregates.byDecision.needs_review).toBe(1);
    expect(body.aggregates.byDecision.safe).toBe(1);
  });

  it("maps explain signals to operationalObservations instead of generic reasoning", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          result: {
            totalScore: 72,
            layerScores: {
              security: 1,
              maintainability: 2,
              ecosystem: 3,
              upgradeImpact: 4,
            },
            findings: [],
            generatedAt: "2026-01-01T00:00:00.000Z",
            decision: {
              recommendation: "risky",
              reasoning: ["High-risk transitive dependency detected"],
            },
            explain: {
              reasons: [
                {
                  id: "graph.transitive.1",
                  layer: "ecosystem",
                  title: "graph.transitive volume",
                  scoreImpact: 18,
                },
              ],
            },
          },
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].cardSummary.summaryLine).toBeNull();
    expect(body.byPrNumber["42"].summaryText).toBeNull();
    expect(body.byPrNumber["42"].cardSummary.operationalObservations).toContain(
      "High transitive dependency volume",
    );
  });

  it("extracts topAffectedAreas from explain reasons (max 3)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          result: {
            explain: {
              reasons: [
                { title: "Auth flow", scoreImpact: -20 },
                { title: "State sync", scoreImpact: -15 },
                { title: "Middleware", scoreImpact: -10 },
                { title: "Extra area", scoreImpact: -5 },
              ],
            },
          },
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    const areas = body.byPrNumber["42"].cardSummary.topAffectedAreas;
    expect(areas.length).toBe(2);
    expect(areas).toEqual(["Auth flow", "State sync"]);
  });

  it("promotes running status to done when completion evidence exists", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "running",
          decision: "risky",
          total_score: 72,
          result_generated_at: new Date("2026-01-01T00:01:00Z"),
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].pipelineStatus).toBe("done");
    expect(body.byPrNumber["42"].cardSummary.headline).toBe("Risky");
    expect(body.byPrNumber["42"].cardSummary.summaryLine).not.toBe(
      "Waiting for results…",
    );
  });

  it("promotes running to done with decision only (no result_generated_at)", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "running",
          decision: "needs_review",
          total_score: 48,
          result_generated_at: null,
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].pipelineStatus).toBe("done");
    expect(body.byPrNumber["42"].cardSummary.headline).toBe("Needs review");
    expect(body.byPrNumber["42"].cardSummary.summaryLine).not.toBe(
      "Waiting for results…",
    );
  });

  it("promotes running to done when only result_generated_at is set", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "running",
          decision: null,
          total_score: null,
          result_generated_at: new Date("2026-01-01T00:01:00Z"),
          result: null,
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].pipelineStatus).toBe("done");
  });

  it("returns 403 when authenticated owner does not match", async () => {
    // Create a fresh app with a fixed authenticatedOwner pre-set
    const restrictedApp = Fastify();
    restrictedApp.decorateRequest("authenticatedOwner", undefined);
    restrictedApp.addHook("onRequest", async (req) => {
      req.authenticatedOwner = "other-org";
    });
    await repoPullRequestScansRoutes(restrictedApp);
    await restrictedApp.ready();

    const res = await restrictedApp.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(res.statusCode).toBe(403);
    await restrictedApp.close();
  });
});
