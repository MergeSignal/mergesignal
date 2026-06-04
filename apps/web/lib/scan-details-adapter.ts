import type {
  ScanDetailOperationalImpact,
  ScanDetailRecommendationCenter,
  ScanDetailSignalSummary,
  ScanDetailVerdict,
  ScanDetailViewModel,
} from "@mergesignal/shared";
import type { ScanDetailsPresentation } from "@mergesignal/shared";

export function detailPresentationToViewModel(
  p: ScanDetailsPresentation,
): ScanDetailViewModel {
  const verdict: ScanDetailVerdict = {
    posture: p.status,
    scopeChip: p.hero.scopeChip ?? null,
    verdictLine: p.hero.verdictLine,
    statusLabel: p.hero.postureLabel,
  };

  const signalSummary: ScanDetailSignalSummary | null = p.signalSummary
    ? {
        score: p.signalSummary.riskIndex,
        overallBand:
          p.signalSummary.band === "high"
            ? "high"
            : p.signalSummary.band === "medium"
              ? "moderate"
              : "low",
        overallLabel: p.hero.postureLabel,
        gauge: {
          fillPercent: p.signalSummary.riskIndex,
          band:
            p.signalSummary.band === "high"
              ? "high"
              : p.signalSummary.band === "medium"
                ? "moderate"
                : "low",
          ariaLabel: `Risk index ${p.signalSummary.riskIndex}`,
        },
        layers: p.signalSummary.layers.map((l) => ({
          layer: l.layer,
          label: l.label,
          score: l.score,
          concernLevel: l.band.toLowerCase().includes("high")
            ? "high"
            : l.band.toLowerCase().includes("medium") ||
                l.band.toLowerCase().includes("moderate")
              ? "medium"
              : "low",
          concernLabel: l.band,
        })),
      }
    : null;

  const operationalImpact: ScanDetailOperationalImpact =
    p.operationalImpact.status === "hidden"
      ? { status: "hidden", items: [] }
      : p.operationalImpact.status === "rich"
        ? { status: "rich", items: p.operationalImpact.items }
        : {
            status: "fallback",
            items: p.operationalImpact.items,
            fallbackMessage: p.operationalImpact.fallbackMessage,
          };

  const recommendedActions: ScanDetailRecommendationCenter = {
    heading: "Recommended actions",
    defaultSelectedId: p.recommendations.items[0]?.title ?? "",
    items: p.recommendations.items.map((item, index) => ({
      id: `rec-${index}`,
      rank: item.rank,
      title: item.title,
      priority: item.priority,
      source: "recommendation",
      detail: {
        why: item.rationale ?? "",
        whyNow: "",
        signals: [],
        expectedBenefit: "",
      },
    })),
    posture: p.status,
  };

  return {
    verdict,
    signalSummary,
    followUpBridgeNote: null,
    recommendedActions,
    operationalImpact,
    because: {
      themes: p.narrative.keyPoints,
      confidenceCaveat: p.evidenceContext.degradedMessage,
    },
    evidence: {
      attentionAreas: p.evidence.attentionAreas.map((area) => ({
        ...area,
        packages: area.packages.map((pkg) => ({
          ...pkg,
          direct: pkg.direct,
        })),
      })),
      findings: p.evidence.findings.map((f) => ({
        ...f,
        severity: f.severity,
      })),
      findingsOverflowCount: p.evidence.findingsOverflowCount,
      topology: p.evidence.topology ?? null,
    },
    repoContext: { status: "hidden" },
    narrativeContext: {
      mode:
        p.evidenceContext.priority === "pr_intelligence"
          ? "pr_intelligence"
          : "graph_fallback",
      codeIntelligenceAvailable:
        p.evidenceContext.priority === "pr_intelligence",
      changedPackagesDisplay: p.narrative.changedPackages.join(", ") || null,
      runtimeSurfaceLabel: null,
      reachabilityLabel: null,
      blastRadiusLabel: null,
      affectedAreas: p.narrative.keyPoints.filter(Boolean).slice(0, 4),
      structuralOnlyDisclaimer:
        p.evidenceContext.priority === "limited"
          ? (p.evidenceContext.degradedMessage ?? null)
          : null,
      usageHighlights: p.usage?.items.flatMap((u) => u.paths).slice(0, 5) ?? [],
      frameworks: p.usage?.frameworks ?? [],
      blastRadiusFactors: [],
      hotspotNames: [],
      usageContextLine: p.usage?.summary ?? null,
      upgradeContextLine: p.hero.headline,
    },
    metadata: p.metadata,
  };
}
