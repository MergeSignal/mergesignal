import { describe, expect, it } from "vitest";
import { primaryPrExample } from "./productMessaging.js";
import {
  ACT2_MAX_THEMES,
  TIER1_MAX_VISIBLE_IMPACTS,
  deriveAct2Themes,
  deriveOperationalImpact,
  deriveFollowUpBridgeNote,
  deriveScanDetailViewModel,
  deriveVerdictLine,
  sanitizeAct2Theme,
  tier1PassesRecallTest,
  type ScanDetailViewModel,
} from "./scanDetailViewModel.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 10,
  layerScores: {
    security: 1,
    maintainability: 2,
    ecosystem: 3,
    upgradeImpact: 4,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

function minimalResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 42,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 15,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    decision: {
      recommendation: "needs_review",
      confidence: "medium",
      reasoning: ["Lockfile adds transitive depth on shared utilities."],
    },
    ...overrides,
  };
}

describe("reach vocabulary on fixtures", () => {
  it("quiet safe scan — Safe · Focused reach", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...baseResult,
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: ["No merge blockers"],
        },
      },
      { scanId: "s1", status: "done" },
    );
    expect(vm?.verdict.posture).toBe("safe");
    expect(vm?.verdict.scopeChip).toBe("Focused reach");
    expect(vm?.verdict.verdictLine).toContain("No merge blockers");
    expect(vm?.verdict.verdictLine).toContain("narrow footprint");
  });

  it("safe + wide reach — score 85", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...baseResult,
        totalScore: 85,
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: [],
        },
        changedPackages: Array.from({ length: 14 }, (_, i) => `pkg-${i}`),
      },
      { scanId: "s2", status: "done" },
    );
    expect(vm?.verdict.scopeChip).toBe("Wide reach");
    expect(vm?.verdict.verdictLine).toBe(
      "No merge blockers · wide upgrade footprint",
    );
  });

  it("needs review + limited reach — minimalResult score 42", () => {
    const vm = deriveScanDetailViewModel(minimalResult(), {
      scanId: "s3",
      status: "done",
    });
    expect(vm?.verdict.posture).toBe("needs_review");
    expect(vm?.verdict.scopeChip).toBe("Limited reach");
    expect(vm?.verdict.verdictLine).toContain("Review before merge");
  });

  it("risky + focused reach — low score, risky posture", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...baseResult,
        totalScore: 18,
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: ["Critical issue in direct dependency"],
        },
        findings: [
          {
            id: "f1",
            title: "Critical CVE",
            description: "Direct dependency vulnerability",
            severity: "critical",
            packageName: "minimist",
          },
        ],
      },
      { scanId: "s4", status: "done" },
    );
    expect(vm?.verdict.scopeChip).toBe("Focused reach");
    expect(vm?.verdict.posture).toBe("risky");
    expect(vm?.verdict.verdictLine).toContain("Resolve blockers");
  });

  it("risky + moderate reach — fat scan score 72", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...baseResult,
        totalScore: 72,
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: [],
        },
        graphInsights: {
          maxDepth: 9,
          nodes: 1500,
          edges: 4000,
          vulnerable: [
            {
              kind: "vulnerable",
              packageName: "lodash",
              direct: false,
              depth: 3,
            },
          ],
        },
      },
      { scanId: "s5", status: "done" },
    );
    expect(vm?.verdict.scopeChip).toBe("Moderate reach");
    expect(vm?.verdict.verdictLine).toContain("moderate dependency footprint");
  });
});

describe("deriveVerdictLine", () => {
  it("maps posture and reach bands", () => {
    expect(deriveVerdictLine("safe", 10)).toContain("narrow footprint");
    expect(deriveVerdictLine("safe", 85)).toContain("wide upgrade footprint");
    expect(deriveVerdictLine("needs_review", 42)).toContain(
      "Review before merge",
    );
    expect(deriveVerdictLine("risky", 18)).toContain("focused footprint");
  });
});

describe("Tier 1 success criterion", () => {
  it("insight-rich scan passes recall test", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...minimalResult(),
        insights: [
          {
            type: "behavioral_change",
            priority: "high",
            confidence: "confirmed",
            scope: "changed",
            message: primaryPrExample.message,
            context: primaryPrExample.where[0]!,
            remediation:
              "Confirm auth guards still run before protected handlers",
            affectedFiles: [...primaryPrExample.where],
          },
        ],
      },
      { scanId: "rich", status: "done" },
    );
    expect(vm?.operationalImpact.status).toBe("rich");
    expect(vm?.operationalImpact.items[0]?.message).toContain("middleware");
    expect(tier1PassesRecallTest(vm!.operationalImpact)).toBe(true);
  });

  it("graph-only lightweight scan uses F3 fallback", () => {
    const impact = deriveOperationalImpact({
      ...minimalResult(),
      insights: [],
      reportPresentation: { mode: "lightweight_pr_graph_baseline" },
    });
    expect(impact.status).toBe("fallback");
    expect(impact.fallbackMessage).toContain("limited code-change signal");
    expect(tier1PassesRecallTest(impact)).toBe(true);
  });

  it("quiet safe uses Q fallback", () => {
    const impact = deriveOperationalImpact({
      ...baseResult,
      decision: {
        recommendation: "safe",
        confidence: "high",
        reasoning: [],
      },
    });
    expect(impact.fallbackMessage).toContain("No application-level impact");
  });
});

describe("Act 2 guardrails", () => {
  it("sanitizes forbidden content", () => {
    expect(sanitizeAct2Theme("lodash 4.17.20 CVE-2021-23337")).toBeNull();
    expect(sanitizeAct2Theme("@scope/pkg@1.2.3")).toBeNull();
    expect(
      sanitizeAct2Theme("Known vulnerabilities in the transitive tree"),
    ).toBe("Known vulnerabilities in the transitive tree");
  });

  it("caps themes at ACT2_MAX_THEMES", () => {
    const fat: ScanResult = {
      ...baseResult,
      totalScore: 72,
      recommendations: [
        {
          id: "r1",
          title: "Reduce duplicate dependency versions",
          rationale: "semver overlap",
          impact: "high",
        },
        {
          id: "r2",
          title: "Review transitive dependency surface",
          rationale: "graph.transitive volume",
          impact: "high",
        },
      ],
      explain: {
        reasons: [
          {
            id: "g1",
            layer: "security",
            title: "graph.vulnerable packages",
            scoreImpact: 20,
          },
          {
            id: "g2",
            layer: "maintainability",
            title: "Stale releases on multiple direct dependencies",
            scoreImpact: 15,
          },
          {
            id: "g3",
            layer: "ecosystem",
            title: "graph.transitive volume cluster",
            scoreImpact: 12,
          },
        ],
      },
      graphInsights: {
        maxDepth: 9,
        nodes: 1500,
        edges: 4000,
        vulnerable: [
          {
            kind: "vulnerable",
            packageName: "lodash",
            direct: false,
            depth: 3,
          },
        ],
        hotspots: Array.from({ length: 5 }, (_, i) => ({
          kind: "hotspot" as const,
          packageName: `pkg-${i}`,
          direct: true,
          depth: 1,
        })),
      },
      decision: {
        recommendation: "risky",
        confidence: "high",
        reasoning: ["Multiple structural concerns"],
      },
    };
    const themes = deriveAct2Themes(fat);
    expect(themes.length).toBeLessThanOrEqual(ACT2_MAX_THEMES);
    for (const theme of themes) {
      expect(theme.length).toBeLessThanOrEqual(80);
      expect(sanitizeAct2Theme(theme)).toBe(theme);
    }
  });

  it("Act 2 themes never contain package names from evidence", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...baseResult,
        totalScore: 72,
        graphInsights: {
          maxDepth: 9,
          nodes: 1500,
          edges: 4000,
          vulnerable: [
            {
              kind: "vulnerable",
              packageName: "lodash",
              direct: false,
              depth: 3,
            },
          ],
        },
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: [],
        },
      },
      { scanId: "act2", status: "done" },
    );
    for (const theme of vm?.because?.themes ?? []) {
      expect(theme.toLowerCase()).not.toContain("lodash");
    }
    expect(vm?.evidence?.attentionAreas[0]?.packages[0]?.name).toBe("lodash");
  });
});

describe("scenario matrix", () => {
  function assertScenario(
    name: string,
    vm: ScanDetailViewModel | null,
    checks: {
      tier0MaxWords?: number;
      tier1Meaningful?: boolean;
      act2MaxBullets?: number;
      act3Navigable?: boolean;
      recommendationsActionable?: boolean;
    },
  ) {
    expect(vm, name).not.toBeNull();
    if (!vm) return;
    if (checks.tier0MaxWords != null) {
      const words = vm.verdict.verdictLine.split(/\s+/).length;
      expect(words, `${name} tier0`).toBeLessThanOrEqual(checks.tier0MaxWords);
    }
    if (checks.tier1Meaningful) {
      expect(tier1PassesRecallTest(vm.operationalImpact), `${name} tier1`).toBe(
        true,
      );
    }
    if (checks.act2MaxBullets != null && vm.because) {
      expect(vm.because.themes.length, `${name} act2`).toBeLessThanOrEqual(
        checks.act2MaxBullets,
      );
    }
    if (checks.act3Navigable && vm.evidence) {
      expect(
        vm.evidence.findings.length + vm.evidence.attentionAreas.length,
        `${name} act3`,
      ).toBeGreaterThan(0);
    }
    if (checks.recommendationsActionable) {
      expect(
        vm.recommendedActions.items.length,
        `${name} recs`,
      ).toBeGreaterThan(0);
      expect(
        vm.recommendedActions.items[0]?.detail.why.length,
        `${name} rec detail`,
      ).toBeGreaterThan(10);
    }
  }

  it("quiet safe scan", () => {
    assertScenario(
      "quiet safe",
      deriveScanDetailViewModel(
        {
          ...baseResult,
          decision: {
            recommendation: "safe",
            confidence: "high",
            reasoning: [],
          },
        },
        { scanId: "q", status: "done" },
      ),
      { tier0MaxWords: 12, tier1Meaningful: true, act2MaxBullets: 0 },
    );
  });

  it("safe + wide reach", () => {
    assertScenario(
      "safe wide",
      deriveScanDetailViewModel(
        {
          ...baseResult,
          totalScore: 88,
          decision: {
            recommendation: "safe",
            confidence: "high",
            reasoning: [],
          },
          graphInsights: {
            maxDepth: 8,
            nodes: 900,
            edges: 1200,
            deepest: [],
          },
        },
        { scanId: "sw", status: "done" },
      ),
      { tier0MaxWords: 12, tier1Meaningful: true },
    );
  });

  it("risky vulnerability-heavy", () => {
    assertScenario(
      "risky vuln",
      deriveScanDetailViewModel(
        {
          ...baseResult,
          totalScore: 72,
          findings: [
            {
              id: "f1",
              title: "CVE in lodash",
              description: "Remote code execution",
              severity: "critical",
              packageName: "lodash",
            },
          ],
          graphInsights: {
            maxDepth: 5,
            nodes: 400,
            edges: 800,
            vulnerable: [
              {
                kind: "vulnerable",
                packageName: "lodash",
                direct: false,
                depth: 2,
              },
            ],
          },
          recommendations: [
            {
              id: "r1",
              title: "Upgrade lodash to patched version",
              rationale: "Resolves critical CVE",
              impact: "high",
            },
          ],
          decision: {
            recommendation: "risky",
            confidence: "high",
            reasoning: [],
          },
        },
        { scanId: "rv", status: "done" },
      ),
      {
        tier0MaxWords: 12,
        tier1Meaningful: true,
        act2MaxBullets: 4,
        act3Navigable: true,
        recommendationsActionable: true,
      },
    );
  });

  it("graph-only scan", () => {
    assertScenario(
      "graph only",
      deriveScanDetailViewModel(
        {
          ...minimalResult(),
          insights: [],
          reportPresentation: { mode: "lightweight_pr_graph_baseline" },
        },
        { scanId: "go", status: "done" },
      ),
      { tier0MaxWords: 12, tier1Meaningful: true, act2MaxBullets: 4 },
    );
  });

  it("insight-rich scan", () => {
    assertScenario(
      "insight rich",
      deriveScanDetailViewModel(
        {
          ...minimalResult({ totalScore: 55 }),
          insights: [
            {
              type: "behavioral_change",
              priority: "high",
              confidence: "confirmed",
              scope: "changed",
              message: primaryPrExample.message,
              context: "apps/api/src/middleware/auth.ts",
              remediation: "Run auth integration tests",
            },
          ],
          recommendations: [
            {
              id: "r1",
              title: "Review auth middleware ordering",
              rationale: "Middleware order affects auth guards",
              impact: "high",
            },
          ],
        },
        { scanId: "ir", status: "done" },
      ),
      {
        tier0MaxWords: 12,
        tier1Meaningful: true,
        act2MaxBullets: 4,
        recommendationsActionable: true,
      },
    );
  });

  it("large enterprise scan", () => {
    const fat: ScanResult = {
      ...minimalResult({ totalScore: 72 }),
      graphInsights: {
        maxDepth: 14,
        nodes: 2400,
        edges: 9000,
        deepest: Array.from({ length: 20 }, (_, i) => ({
          kind: "deep" as const,
          packageName: `pkg-${i}`,
          depth: 10 + i,
          direct: false,
          via: ["a", "b"],
        })),
        hotspots: Array.from({ length: 12 }, (_, i) => ({
          kind: "hotspot" as const,
          packageName: `hot-${i}`,
          depth: 3,
          direct: false,
        })),
        vulnerable: Array.from({ length: 8 }, (_, i) => ({
          kind: "vulnerable" as const,
          packageName: `vuln-${i}`,
          depth: 2,
          direct: false,
        })),
      },
      insights: Array.from({ length: 30 }, (_, i) => ({
        type: "behavioral_change" as const,
        priority: "high" as const,
        confidence: "confirmed" as const,
        scope: "changed" as const,
        message: `Insight message ${i} about runtime behavior`,
        context: `src/module-${i}/index.ts`,
        remediation: `Verify step ${i}`,
      })),
      recommendations: Array.from({ length: 25 }, (_, i) => ({
        id: `rec-${i}`,
        title: `Recommendation title ${i}`,
        rationale: `Rationale ${i}`,
        impact: "high" as const,
      })),
      findings: Array.from({ length: 40 }, (_, i) => ({
        id: `find-${i}`,
        title: `Finding ${i}`,
        description: `Description ${i}`,
        severity: "high" as const,
        packageName: `pkg-${i}`,
      })),
      decision: {
        recommendation: "risky",
        confidence: "high",
        reasoning: [],
      },
    };
    const vm = deriveScanDetailViewModel(fat, {
      scanId: "fat",
      status: "done",
    });
    expect(vm?.operationalImpact.items.length).toBeGreaterThan(
      TIER1_MAX_VISIBLE_IMPACTS,
    );
    expect(vm?.evidence?.findings.length).toBe(40);
    expect(vm?.recommendedActions.items.length).toBeLessThanOrEqual(3);
    expect(
      vm?.recommendedActions.items[0]?.detail.whyNow.length,
    ).toBeGreaterThan(0);
    expect(vm?.evidence?.findingsOverflowCount).toBe(30);
  });

  it("includes signalSummary on done scans", () => {
    const vm = deriveScanDetailViewModel(
      { ...minimalResult(), totalScore: 71 },
      { scanId: "risk", status: "done" },
    );
    expect(vm?.signalSummary?.overallBand).toBe("moderate");
    expect(vm?.signalSummary?.score).toBe(71);
    expect(vm?.signalSummary?.overallLabel).toBe("Moderate");
  });

  it("derives follow-up bridge note from recommended action count", () => {
    expect(deriveFollowUpBridgeNote(0)).toBeNull();
    expect(deriveFollowUpBridgeNote(1)).toBe(
      "1 follow-up improvement was identified",
    );
    expect(deriveFollowUpBridgeNote(3)).toBe(
      "3 follow-up improvements were identified",
    );

    const vm = deriveScanDetailViewModel(minimalResult(), {
      scanId: "bridge",
      status: "done",
    });
    expect(vm?.followUpBridgeNote).toMatch(/follow-up improvement/);
  });
});

describe("repo context", () => {
  it("defaults to hidden", () => {
    const vm = deriveScanDetailViewModel(minimalResult(), {
      scanId: "x",
      status: "done",
    });
    expect(vm?.repoContext).toEqual({ status: "hidden" });
  });
});
