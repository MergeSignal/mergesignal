import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ScanDetailsPresentation } from "@mergesignal/shared";
import { SignalSummaryPanel } from "./SignalSummaryPanel";
import { RecommendedActionsPanel } from "./RecommendedActionsPanel";
import { EvidencePanel } from "./EvidencePanel";
import { ScanMetadataFooter } from "./ScanMetadataFooter";
import { OperationalImpactPanel } from "./OperationalImpactPanel";

// Minimal authored ScanDetailsPresentation for rendering tests.
// All string values are authored fields from the bundle — not derived in UI.
function makePresentation(
  overrides: Partial<ScanDetailsPresentation> = {},
): ScanDetailsPresentation {
  return {
    posture: "needs_review",
    primaryConcern: "behavioral_change",
    factors: [
      "Changed package has confirmed usage on runtime application paths.",
    ],
    reasoning: ["HTTP framework infrastructure detected."],
    verificationFocus: ["Run integration tests"],
    verificationChannel: "runtime",
    reachVisibility: "contextual",
    narrativeIntensity: "elevated",
    evidenceContext: {
      priority: "pr_intelligence",
    },
    status: "needs_review",
    density: "standard",
    confidence: "medium",
    hero: {
      headline: "fastify upgraded from 4.x to 5.x",
      verdictLine: "This upgrade changes runtime request handling behaviour.",
      postureLabel: "Needs review",
      scopeChip: "Runtime scope",
      prRiskScore: 63,
      prRiskBandLabel: "Medium risk",
    },
    narrative: {
      keyPoints: [
        "Middleware ordering may affect auth paths.",
        "HTTP request lifecycle has changed.",
      ],
      changedPackages: ["fastify"],
    },
    signalSummary: {
      prRiskScore: 63,
      band: "medium",
      layers: [
        { layer: "security", score: 10, band: "low", label: "Security" },
        {
          layer: "upgradeImpact",
          score: 70,
          band: "high",
          label: "Upgrade impact",
        },
      ],
    },
    usage: {
      summary: "Used in 3 server entry points.",
      items: [],
      frameworks: ["fastify"],
    },
    verification: {
      actions: [{ title: "Run auth smoke tests" }],
    },
    operationalImpact: {
      status: "rich",
      items: [
        {
          message: "Auth middleware ordering may break after upgrade.",
          where: "apps/api/src/middleware/auth.ts",
          verify: "Run POST /login in staging",
        },
      ],
    },
    recommendations: {
      items: [
        {
          rank: 1,
          title: "Run auth smoke tests before merge",
          priority: "high",
          rationale:
            "Fastify 5 changed hook lifecycle which may affect auth middleware.",
        },
      ],
    },
    evidence: {
      defaultCollapsed: false,
      attentionAreas: [
        {
          problemLabel: "Middleware lifecycle change",
          problemDescription: "Request lifecycle hooks have changed.",
          packages: [{ name: "fastify", direct: true, version: "5.0.0" }],
          overflowCount: 0,
        },
      ],
      findings: [
        {
          id: "f-1",
          severity: "medium",
          title: "Runtime middleware coupling",
          description: "Fastify middleware ordering may affect auth paths.",
          packageName: "fastify",
          recommendation: "Run auth smoke tests",
          source: "dependency",
        },
      ],
      findingsOverflowCount: 0,
    },
    metadata: {
      scanId: "scan-abc-123",
      generatedAt: "2026-01-01T00:00:00.000Z",
      methodologyVersion: "engine/1.0.0",
      changedPackagesSummary: "fastify",
    },
    ...overrides,
  };
}

describe("SignalSummaryPanel", () => {
  const p = makePresentation();

  it("renders the authored verdictLine from the bundle", () => {
    render(
      <SignalSummaryPanel
        status={p.status}
        hero={p.hero}
        narrative={p.narrative}
        evidenceContext={p.evidenceContext}
        signalSummary={p.signalSummary}
        usage={p.usage}
      />,
    );
    expect(
      screen.getByText(
        "This upgrade changes runtime request handling behaviour.",
      ),
    ).toBeTruthy();
  });

  it("renders authored keyPoints from narrative", () => {
    render(
      <SignalSummaryPanel
        status={p.status}
        hero={p.hero}
        narrative={p.narrative}
        evidenceContext={p.evidenceContext}
        signalSummary={p.signalSummary}
        usage={p.usage}
      />,
    );
    expect(
      screen.getByText("Middleware ordering may affect auth paths."),
    ).toBeTruthy();
    expect(
      screen.getByText("HTTP request lifecycle has changed."),
    ).toBeTruthy();
  });

  it("renders the authored prRiskBandLabel from hero", () => {
    render(
      <SignalSummaryPanel
        status={p.status}
        hero={p.hero}
        narrative={p.narrative}
        evidenceContext={p.evidenceContext}
        signalSummary={p.signalSummary}
        usage={p.usage}
      />,
    );
    expect(screen.getByText("Medium risk")).toBeTruthy();
  });

  it("does not leak raw reachVisibility enum values as UI text", () => {
    render(
      <SignalSummaryPanel
        status={p.status}
        hero={p.hero}
        narrative={p.narrative}
        evidenceContext={p.evidenceContext}
        signalSummary={p.signalSummary}
        usage={p.usage}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("contextual");
    expect(body).not.toContain("prominent");
    // "hidden" is an internal DTO status value, not UI text
    expect(body).not.toMatch(/\bhidden\b/);
  });

  it("renders authored usage.summary", () => {
    render(
      <SignalSummaryPanel
        status={p.status}
        hero={p.hero}
        narrative={p.narrative}
        evidenceContext={p.evidenceContext}
        signalSummary={p.signalSummary}
        usage={p.usage}
      />,
    );
    expect(screen.getByText("Used in 3 server entry points.")).toBeTruthy();
  });

  it("renders authored confidenceRationale adjacent to the verdict", () => {
    const withConfidence = makePresentation({
      confidenceRationale:
        "Confidence is medium because runtime usage was confirmed on application paths.",
    });
    render(
      <SignalSummaryPanel
        status={withConfidence.status}
        hero={withConfidence.hero}
        narrative={withConfidence.narrative}
        evidenceContext={withConfidence.evidenceContext}
        signalSummary={withConfidence.signalSummary}
        usage={withConfidence.usage}
        confidenceRationale={withConfidence.confidenceRationale}
      />,
    );
    expect(
      screen.getByText(
        "Confidence is medium because runtime usage was confirmed on application paths.",
      ),
    ).toBeTruthy();
  });

  it("renders electionSummary only for multi-package upgrades", () => {
    const multiPackage = makePresentation({
      electionSummary:
        "MergeSignal focused on fastify because it anchors the largest runtime footprint.",
      narrative: {
        keyPoints: ["Middleware ordering may affect auth paths."],
        changedPackages: ["fastify", "undici"],
      },
    });
    render(
      <SignalSummaryPanel
        status={multiPackage.status}
        hero={multiPackage.hero}
        narrative={multiPackage.narrative}
        evidenceContext={multiPackage.evidenceContext}
        signalSummary={multiPackage.signalSummary}
        usage={multiPackage.usage}
        electionSummary={multiPackage.electionSummary}
      />,
    );
    expect(
      screen.getByText(
        "MergeSignal focused on fastify because it anchors the largest runtime footprint.",
      ),
    ).toBeTruthy();
  });

  it("omits electionSummary for single-package upgrades", () => {
    const singlePackage = makePresentation({
      electionSummary:
        "MergeSignal focused on fastify because it anchors the largest runtime footprint.",
      narrative: {
        keyPoints: ["Middleware ordering may affect auth paths."],
        changedPackages: ["fastify"],
      },
    });
    render(
      <SignalSummaryPanel
        status={singlePackage.status}
        hero={singlePackage.hero}
        narrative={singlePackage.narrative}
        evidenceContext={singlePackage.evidenceContext}
        signalSummary={singlePackage.signalSummary}
        usage={singlePackage.usage}
        electionSummary={singlePackage.electionSummary}
      />,
    );
    expect(
      screen.queryByText(
        "MergeSignal focused on fastify because it anchors the largest runtime footprint.",
      ),
    ).toBeNull();
  });

  it("renders supportingContext as progressive disclosure", () => {
    const withContext = makePresentation({
      supportingContext: {
        title: "Supporting detail - graph paths and depth",
        lines: [
          "fastify is 2 hops from the application entry point.",
          "Transitive depth peaks at 4 packages.",
        ],
      },
    });
    render(
      <SignalSummaryPanel
        status={withContext.status}
        hero={withContext.hero}
        narrative={withContext.narrative}
        evidenceContext={withContext.evidenceContext}
        signalSummary={withContext.signalSummary}
        usage={withContext.usage}
        supportingContext={withContext.supportingContext}
      />,
    );
    expect(
      screen.getByText("Supporting detail - graph paths and depth"),
    ).toBeTruthy();
    expect(
      screen.getByText("fastify is 2 hops from the application entry point."),
    ).toBeTruthy();
    expect(
      screen.getByText("Transitive depth peaks at 4 packages."),
    ).toBeTruthy();
  });

  it("renders evidenceContext.degradedMessage when present", () => {
    const limited = makePresentation({
      evidenceContext: {
        priority: "limited",
        degradedMessage: "Limited code intelligence available for this scan.",
      },
    });
    render(
      <SignalSummaryPanel
        status={limited.status}
        hero={limited.hero}
        narrative={limited.narrative}
        evidenceContext={limited.evidenceContext}
        signalSummary={limited.signalSummary}
        usage={limited.usage}
      />,
    );
    expect(
      screen.getByText("Limited code intelligence available for this scan."),
    ).toBeTruthy();
  });
});

describe("RecommendedActionsPanel", () => {
  it("renders the authored recommendation title and rationale", () => {
    const p = makePresentation();
    render(<RecommendedActionsPanel recommendations={p.recommendations} />);
    expect(screen.getByText("Run auth smoke tests before merge")).toBeTruthy();
    expect(
      screen.getByText(
        "Fastify 5 changed hook lifecycle which may affect auth middleware.",
      ),
    ).toBeTruthy();
  });

  it("does not render empty guidance headings (whyNow / signals / expectedBenefit)", () => {
    const p = makePresentation({
      recommendations: {
        items: [{ rank: 1, title: "Check middleware", priority: "medium" }],
      },
    });
    render(<RecommendedActionsPanel recommendations={p.recommendations} />);
    const body = document.body.textContent ?? "";
    // These headings came from the legacy empty fields — must not appear
    expect(body).not.toContain("Why now");
    expect(body).not.toContain("Expected benefit");
    expect(body).not.toContain("Supporting signals");
  });

  it("returns null for empty recommendations", () => {
    const p = makePresentation({ recommendations: { items: [] } });
    const { container } = render(
      <RecommendedActionsPanel recommendations={p.recommendations} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("EvidencePanel", () => {
  it("renders the authored finding title from the bundle", () => {
    const p = makePresentation();
    render(<EvidencePanel evidence={p.evidence} />);
    expect(screen.getByText("Runtime middleware coupling")).toBeTruthy();
  });

  it("renders the authored attention area problemLabel", () => {
    const p = makePresentation();
    render(<EvidencePanel evidence={p.evidence} />);
    expect(screen.getByText("Middleware lifecycle change")).toBeTruthy();
  });

  it("renders the authored finding recommendation", () => {
    const p = makePresentation();
    render(<EvidencePanel evidence={p.evidence} />);
    expect(screen.getByText("Run auth smoke tests")).toBeTruthy();
  });
});

describe("ScanMetadataFooter", () => {
  it("renders the authored scanId", () => {
    const p = makePresentation();
    render(<ScanMetadataFooter metadata={p.metadata} />);
    expect(screen.getByText("scan-abc-123")).toBeTruthy();
  });

  it("renders the authored methodologyVersion", () => {
    const p = makePresentation();
    render(<ScanMetadataFooter metadata={p.metadata} />);
    expect(screen.getByText("engine/1.0.0")).toBeTruthy();
  });

  it("does not render metadata flags that are not in the bundle (codeAnalysisTimedOut, codeIntelligenceAvailable)", () => {
    const p = makePresentation();
    render(<ScanMetadataFooter metadata={p.metadata} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("timed out");
    expect(body).not.toContain("unavailable");
  });
});

describe("OperationalImpactPanel", () => {
  it("renders the authored impact message from the bundle", () => {
    const p = makePresentation();
    render(<OperationalImpactPanel operationalImpact={p.operationalImpact} />);
    expect(
      screen.getByText("Auth middleware ordering may break after upgrade."),
    ).toBeTruthy();
  });

  it("renders nothing when status is hidden", () => {
    const p = makePresentation({
      operationalImpact: { status: "hidden", items: [] },
    });
    const { container } = render(
      <OperationalImpactPanel operationalImpact={p.operationalImpact} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders fallbackMessage for compact status", () => {
    const p = makePresentation({
      operationalImpact: {
        status: "compact",
        items: [],
        fallbackMessage:
          "No application-level impact identified for this upgrade.",
      },
    });
    render(<OperationalImpactPanel operationalImpact={p.operationalImpact} />);
    expect(
      screen.getByText(
        "No application-level impact identified for this upgrade.",
      ),
    ).toBeTruthy();
  });
});
