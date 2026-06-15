import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { repoPullRequestScansRoutes } from "./repoPullRequestScans.js";
import type { Assessment } from "@mergesignal/contracts";
import {
  assessmentTypescriptPatch,
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
  reachScopeFor,
  withAssessmentScope,
} from "@mergesignal/shared";

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

function testAssessment(
  anchor: string,
  body: Omit<
    Assessment,
    "reviewFocalPoint" | "reachScope" | "verificationScope"
  >,
): Assessment {
  return withAssessmentScope(body, {
    reviewFocalPoint: minimalReviewFocalPoint([anchor]),
    reachScope:
      body.posture === "safe" ? emptyReachScope() : reachScopeFor([anchor]),
    verificationScope: emptyVerificationScope(),
  });
}

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
    github_surfaces_published_at: Date | null;
  }> = {},
) {
  const status = overrides.status ?? "done";
  const defaultSurfaced =
    status === "done" && overrides.github_surfaces_published_at === undefined
      ? new Date("2026-01-01T00:02:00Z")
      : (overrides.github_surfaces_published_at ?? null);
  const defaultResult =
    status === "done" && overrides.result === undefined
      ? {
          totalScore: overrides.total_score ?? 72,
          layerScores: {
            security: 1,
            maintainability: 2,
            ecosystem: 3,
            upgradeImpact: 4,
          },
          findings: [],
          generatedAt: "2026-01-01T00:00:00.000Z",
          assessment: testAssessment("pkg", {
            posture: "risky",
            confidence: "medium",
            primaryConcern: "breaking_or_major",
            concerns: [],
            factors: ["breaking_or_major"],
            changeClasses: ["breaking_change"],
            presentation: {
              narrativeIntensity: "elevated",
              reachVisibility: "prominent",
              verificationIntensity: "required",
              insightEmissionFloor: "full",
              reportMode: "high_signal_pr",
            },
          }),
          decision: {
            recommendation: overrides.decision ?? "risky",
            confidence: "medium",
            reasoning: [],
          },
        }
      : (overrides.result ?? null);

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
    result: defaultResult,
    github_surfaces_published_at: defaultSurfaced,
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
            assessment: testAssessment("lodash", {
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
            }),
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
            assessment: testAssessment("auth-lib", {
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
            }),
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

  it("returns scanning for in-flight rows matching prHeads", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "running",
          decision: null,
          total_score: null,
          result_generated_at: null,
          github_surfaces_published_at: null,
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans?prHeads=42:abc123",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].pipelineStatus).toBe("running");
    expect(body.byPrNumber["42"].presentationState).toBe("scanning");
    expect(body.byPrNumber["42"].cardPresentation.verdict).toBeUndefined();
    expect(body.byPrNumber["42"].cardPresentation.pipeline).toBeDefined();
  });

  it("returns surfaces_incomplete when done without github_surfaces_published_at", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "done",
          decision: "safe",
          total_score: 20,
          github_surfaces_published_at: null,
          result: {
            totalScore: 20,
            layerScores: {
              security: 1,
              maintainability: 2,
              ecosystem: 3,
              upgradeImpact: 4,
            },
            findings: [],
            generatedAt: "2026-01-01T00:00:00.000Z",
            assessment: assessmentTypescriptPatch,
            decision: {
              recommendation: "safe",
              confidence: "high",
              reasoning: [],
            },
          },
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans?prHeads=42:abc123",
    });
    const body = res.json();
    const entry = body.byPrNumber["42"];
    expect(entry.presentationState).toBe("surfaces_incomplete");
    expect(entry.cardPresentation.verdict).toBeUndefined();
    expect(entry.cardPresentation.sortKey).toEqual({
      postureRank: -1,
      riskIndex: -1,
    });
    expect(body.aggregates.byDecision.safe).toBe(0);
  });

  it("returns ready only when surfaces are published for matching head", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          status: "done",
          decision: "safe",
          total_score: 20,
          github_surfaces_published_at: new Date("2026-01-01T00:02:00Z"),
          result: {
            totalScore: 20,
            layerScores: {
              security: 1,
              maintainability: 2,
              ecosystem: 3,
              upgradeImpact: 4,
            },
            findings: [],
            generatedAt: "2026-01-01T00:00:00.000Z",
            assessment: assessmentTypescriptPatch,
            decision: {
              recommendation: "safe",
              confidence: "high",
              reasoning: [],
            },
          },
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans?prHeads=42:abc123",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].presentationState).toBe("ready");
    expect(body.byPrNumber["42"].cardPresentation.verdict?.posture).toBe(
      "safe",
    );
    expect(body.aggregates.byDecision.safe).toBe(1);
  });

  it("returns stale when surfaced scan is for an older head sha", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [
        makeRow({
          scan_id: "scan-old",
          github_head_sha: "old-sha",
          github_surfaces_published_at: new Date("2026-01-01T00:02:00Z"),
        }),
      ],
      rowCount: 1,
    } as never);

    const res = await app.inject({
      method: "GET",
      url: "/repo/acme/frontend/pull-request-scans?prHeads=42:new-sha",
    });
    const body = res.json();
    expect(body.byPrNumber["42"].presentationState).toBe("stale");
    expect(body.byPrNumber["42"].scanId).toBe("scan-old");
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
