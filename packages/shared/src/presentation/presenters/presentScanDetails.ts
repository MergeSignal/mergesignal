import { MERGE_CONCERN_LABELS } from "../../assessmentLabels.js";
import { normalizedPackageUsagePaths } from "../../narrativePresentation.js";
import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import {
  buildNarrativeChannels,
  composeSubheadline,
  composeSupportingContext,
  evidenceContextFromProfile,
  projectCompactKeyPoints,
} from "../compose/narrativeCompose.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "../../normalizeGeneratedText.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanDetailsPresentation } from "../dto/scanDetailsPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

export type PresentScanDetailsContext = {
  scanId: string;
  methodologyVersion?: string | null;
  prNumber?: number | null;
};

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
      paths: normalizedPackageUsagePaths(row),
      areas: row.areas,
      criticalPaths: row.criticalPaths,
    })),
    frameworks: facts.frameworks,
  };
}

function mapEvidence(
  bundle: ScanPresentationBundle,
): ScanDetailsPresentation["evidence"] {
  const defaultCollapsed =
    bundle.profile.priority === "pr_intelligence" &&
    bundle.profile.density === "rich";

  const findings = (bundle.result.findings ?? []).slice(0, 8).map((f) => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    description: f.description,
    packageName: f.packageName,
    recommendation: f.recommendation,
    source: "dependency" as const,
  }));

  return {
    defaultCollapsed,
    attentionAreas: [],
    findings,
    findingsOverflowCount: Math.max(
      0,
      (bundle.result.findings?.length ?? 0) - findings.length,
    ),
  };
}

export function presentScanDetails(
  bundle: ScanPresentationBundle,
  ctx: PresentScanDetailsContext,
): ScanDetailsPresentation {
  const { assessment, facts, profile, result } = bundle;
  const assessmentFields = projectAssessmentFields(bundle);
  const channels = buildNarrativeChannels(bundle);
  const keyPoints = projectCompactKeyPoints(channels, 6);
  const subheadline = composeSubheadline(bundle);
  const supportingLines = composeSupportingContext(bundle);
  const supportingContext = supportingLines
    ? {
        title: scanSurfaceCopy.scanDetail.topologyCollapsedHint,
        lines: supportingLines,
      }
    : undefined;

  const postureLabel = MERGE_POSTURE_LABEL[profile.status];
  const verdictLine =
    assessmentFields.reasoning[0] ??
    (assessment.primaryConcern
      ? MERGE_CONCERN_LABELS[assessment.primaryConcern]
      : postureLabel);

  const verificationActions = channels.verification.map((title, index) => ({
    title: normalizeGeneratedText(title),
    detail: assessmentFields.reasoning[index + 1],
  }));

  const recommendations = verificationActions.map((action, index) => ({
    rank: index + 1,
    title: action.title,
    priority:
      profile.status === "risky"
        ? ("high" as const)
        : profile.status === "needs_review"
          ? ("medium" as const)
          : ("low" as const),
    rationale: action.detail,
  }));

  return {
    ...assessmentFields,
    evidenceContext: evidenceContextFromProfile(bundle),
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    presentationIntent: profile.interpretation.intent,
    hero: {
      headline: normalizeGeneratedText(channels.headline),
      subheadline: normalizeGeneratedTextNullable(subheadline) ?? undefined,
      verdictLine: normalizeGeneratedText(verdictLine),
      scopeChip: channels.reachLabel,
      postureLabel,
      riskIndex: result.totalScore,
    },
    narrative: {
      keyPoints: keyPoints.map((k) => normalizeGeneratedText(k)),
      changedPackages: facts.changedPackages.all,
      primaryPackage: facts.changedPackages.primary ?? undefined,
    },
    usage: mapUsage(bundle),
    verification: { actions: verificationActions },
    operationalImpact: { status: "hidden", items: [] },
    recommendations: { items: recommendations },
    evidence: mapEvidence(bundle),
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
