import { deriveDetailReachChip } from "../../formatCardExposureDisplay.js";
import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import {
  deriveVerdictLineFromFacts,
  presentScanDetailViewModel,
  type ScanDetailViewModel,
} from "../../scanDetailViewModel.js";
import {
  composeHeadline,
  composeKeyPoints,
  composeSubheadline,
  composeSupportingContext,
  composeVerificationActions,
  evidenceContextFromProfile,
} from "../compose/narrativeCompose.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "../../normalizeGeneratedText.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanDetailsPresentation } from "../dto/scanDetailsPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";

export type PresentScanDetailsContext = {
  scanId: string;
  methodologyVersion?: string | null;
  prNumber?: number | null;
};

function mapOperationalImpact(
  vm: ScanDetailViewModel,
): ScanDetailsPresentation["operationalImpact"] {
  const oi = vm.operationalImpact;
  if (oi.status === "hidden") {
    return { status: "hidden", items: [] };
  }
  if (oi.status === "rich") {
    return {
      status: "rich",
      items: oi.items.map((item) => ({
        message: item.message,
        where: item.where,
        verify: item.verify,
        affectedFiles: item.affectedFiles,
      })),
    };
  }
  return {
    status: "compact",
    items: oi.items,
    fallbackMessage: oi.fallbackMessage,
  };
}

function mapRecommendations(
  vm: ScanDetailViewModel,
): ScanDetailsPresentation["recommendations"] {
  const items = vm.recommendedActions.items.map((item) => ({
    rank: item.rank,
    title: item.title,
    priority:
      item.priority === "high" ||
      item.priority === "medium" ||
      item.priority === "low"
        ? item.priority
        : ("medium" as const),
    rationale: item.detail?.why,
  }));
  return { items };
}

function mapEvidence(
  bundle: ScanPresentationBundle,
  vm: ScanDetailViewModel,
): ScanDetailsPresentation["evidence"] {
  const defaultCollapsed =
    bundle.profile.priority === "pr_intelligence" &&
    bundle.profile.density === "rich";

  const ev = vm.evidence;
  if (!ev) {
    return {
      defaultCollapsed,
      attentionAreas: [],
      findings: [],
      findingsOverflowCount: 0,
    };
  }

  return {
    defaultCollapsed,
    attentionAreas: ev.attentionAreas.map((area) => ({
      problemLabel: area.problemLabel,
      problemDescription: area.problemDescription,
      packages: area.packages.map((p) => ({
        name: p.name,
        version: p.version,
        direct: p.direct,
        severity: p.severity,
        evidence: p.evidence,
      })),
      overflowCount: area.overflowCount,
    })),
    findings: ev.findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      description: f.description,
      packageName: f.packageName,
      recommendation: f.recommendation,
      source: f.source,
    })),
    findingsOverflowCount: ev.findingsOverflowCount,
    topology: ev.topology
      ? {
          summaryLine: ev.topology.summaryLine,
          deepest: ev.topology.deepest,
        }
      : undefined,
  };
}

function mapUsage(
  bundle: ScanPresentationBundle,
): ScanDetailsPresentation["usage"] {
  const { facts } = bundle;
  if (facts.packageUsage.length === 0 && facts.frameworks.length === 0) {
    return undefined;
  }
  return {
    summary: facts.packageUsage[0]
      ? `${facts.packageUsage.length} package(s) with usage data`
      : undefined,
    items: facts.packageUsage.map((row) => ({
      packageName: row.packageName,
      paths: row.paths,
      areas: row.areas,
      criticalPaths: row.criticalPaths,
    })),
    frameworks: facts.frameworks,
  };
}

export function presentScanDetails(
  bundle: ScanPresentationBundle,
  ctx: PresentScanDetailsContext,
): ScanDetailsPresentation {
  const { facts, profile, result } = bundle;

  const vm = presentScanDetailViewModel(facts, result, {
    scanId: ctx.scanId,
    status: "done",
    methodologyVersion: ctx.methodologyVersion,
    prNumber: ctx.prNumber,
    repoContext: { status: "hidden" },
  });

  const headline = composeHeadline(bundle);
  const subheadline = composeSubheadline(bundle);
  const keyPoints = composeKeyPoints(bundle, 6);
  const verificationTitles = composeVerificationActions(bundle, 6);

  const supportingLines = composeSupportingContext(bundle);
  const supportingContext = supportingLines
    ? {
        title: scanSurfaceCopy.scanDetail.topologyCollapsedHint,
        lines: supportingLines,
      }
    : undefined;

  const posture = profile.status;
  const postureLabel = MERGE_POSTURE_LABEL[posture];

  return {
    evidenceContext: evidenceContextFromProfile(bundle),
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    hero: {
      headline: normalizeGeneratedText(headline),
      subheadline: normalizeGeneratedTextNullable(subheadline) ?? undefined,
      verdictLine: deriveVerdictLineFromFacts(facts, result),
      scopeChip: deriveDetailReachChip(result.totalScore) ?? undefined,
      postureLabel,
      riskIndex: facts.riskIndex,
    },
    narrative: {
      keyPoints: keyPoints.map((k) => normalizeGeneratedText(k)),
      changedPackages: facts.changedPackages.all,
      primaryPackage: facts.changedPackages.primary ?? undefined,
    },
    usage: mapUsage(bundle),
    verification: {
      actions: verificationTitles.map((title) => ({
        title: normalizeGeneratedText(title),
      })),
    },
    signalSummary: vm.signalSummary
      ? {
          riskIndex: vm.signalSummary.score,
          band:
            vm.signalSummary.overallBand === "moderate"
              ? ("medium" as const)
              : vm.signalSummary.overallBand === "high"
                ? ("high" as const)
                : ("low" as const),
          layers: vm.signalSummary.layers.map((l) => ({
            layer: l.layer,
            score: l.score,
            band: l.concernLabel,
            label: l.label,
          })),
        }
      : undefined,
    operationalImpact: mapOperationalImpact(vm),
    recommendations: mapRecommendations(vm),
    evidence: mapEvidence(bundle, vm),
    supportingContext,
    metadata: {
      scanId: ctx.scanId,
      generatedAt: result.generatedAt,
      methodologyVersion: ctx.methodologyVersion,
      changedPackagesSummary:
        facts.changedPackages.primary ?? facts.changedPackages.all.join(", "),
    },
  };
}
