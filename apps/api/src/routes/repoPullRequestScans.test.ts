import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { repoPullRequestScansRoutes } from "./repoPullRequestScans.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
  queries: {},
}));

vi.mock("../services/scanQuota.js", () => ({
  getOwnerGithubQuotaStatus: vi.fn(),
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
import { getOwnerGithubQuotaStatus } from "../services/scanQuota.js";

const defaultQuotaOk = {
  source: "github" as const,
  state: "ok" as const,
  limit: 15,
  used: 0,
  windowHours: 24,
};

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
    vi.mocked(getOwnerGithubQuotaStatus).mockResolvedValue(defaultQuotaOk);
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
    expect(body.quotaStatus).toEqual(defaultQuotaOk);
  });

  it("returns quotaStatus state ok when usage is below limit", async () => {
    vi.mocked(getOwnerGithubQuotaStatus).mockResolvedValue({
      source: "github",
      state: "ok",
      limit: 20,
      used: 10,
      windowHours: 24,
    });
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().quotaStatus).toMatchObject({
      state: "ok",
      limit: 20,
      used: 10,
    });
  });

  it("returns quotaStatus state exceeded with HTTP 200", async () => {
    vi.mocked(getOwnerGithubQuotaStatus).mockResolvedValue({
      source: "github",
      state: "exceeded",
      limit: 15,
      used: 15,
      windowHours: 24,
    });
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().quotaStatus.state).toBe("exceeded");
  });

  it("loads quota for path owner", async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
    await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans",
    });
    expect(getOwnerGithubQuotaStatus).toHaveBeenCalledWith("acme");
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
    expect(entry.cardPresentation.verdict?.posture).toBe("risky");
    expect(entry.cardPresentation.sortKey.riskIndex).toBe(72);
    expect(entry.cardPresentation.headline).toBeTruthy();
    expect(entry.githubBaseRef).toBe("main");
    expect(Array.isArray(entry.cardPresentation.insights)).toBe(true);
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

  it("maps assessment reasoning to card insights", async () => {
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
            assessment: {
              posture: "risky",
              confidence: "medium",
              primaryConcern: "confirmed_runtime_usage",
              concerns: [
                {
                  kind: "confirmed_runtime_usage",
                  rank: 1,
                  packages: ["lodash"],
                  evidenceRefs: ["test"],
                },
              ],
              factors: ["confirmed_runtime_usage"],
              changeClasses: ["runtime_upgrade"],
              presentation: {
                narrativeIntensity: "elevated",
                reachVisibility: "prominent",
                verificationIntensity: "required",
                insightEmissionFloor: "full",
                reportMode: "high_signal_pr",
              },
            },
            decision: {
              recommendation: "risky",
              confidence: "medium",
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
    const card = body.byPrNumber["42"].cardPresentation;
    expect(card.verdict?.posture).toBe("risky");
    expect(card.insights).toContain("High-risk transitive dependency detected");
  });

  it("projects application areas from repo intelligence (max 2)", async () => {
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
            changedPackages: ["auth-lib"],
            assessment: {
              posture: "needs_review",
              confidence: "medium",
              primaryConcern: "confirmed_runtime_usage",
              concerns: [
                {
                  kind: "confirmed_runtime_usage",
                  rank: 1,
                  packages: ["auth-lib"],
                  evidenceRefs: ["test"],
                },
              ],
              factors: ["confirmed_runtime_usage"],
              changeClasses: ["runtime_upgrade"],
              presentation: {
                narrativeIntensity: "elevated",
                reachVisibility: "prominent",
                verificationIntensity: "required",
                insightEmissionFloor: "full",
                reportMode: "high_signal_pr",
              },
            },
            decision: {
              recommendation: "needs_review",
              confidence: "medium",
              reasoning: ["Runtime usage confirmed"],
            },
            repoIntelligence: {
              packages: {
                "auth-lib": {
                  runtimeSurface: "runtime",
                  reachability: "on_runtime_paths",
                  usage: {
                    packageName: "auth-lib",
                    files: ["src/auth.ts"],
                    paths: ["src/auth.ts"],
                  },
                },
              },
              applicationAreas: [
                { id: "auth", label: "Auth flow" },
                { id: "state", label: "State sync" },
              ],
              blastRadius: { level: "moderate", changedPackageCount: 1 },
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
    const areas = body.byPrNumber["42"].cardPresentation.scopeAreas ?? [];
    expect(areas.length).toBeLessThanOrEqual(2);
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
    expect(body.byPrNumber["42"].cardPresentation.verdict?.posture).toBe(
      "risky",
    );
    expect(body.byPrNumber["42"].cardPresentation.pipeline).toBeUndefined();
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
    expect(body.byPrNumber["42"].cardPresentation.verdict?.posture).toBe(
      "needs_review",
    );
    expect(body.byPrNumber["42"].cardPresentation.pipeline).toBeUndefined();
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
