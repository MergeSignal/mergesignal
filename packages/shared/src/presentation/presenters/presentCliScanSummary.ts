import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import { formatPrRiskSummary } from "../../prRiskBand.js";
import { resolvePrRiskLayerScores } from "../../prRiskWire.js";
import {
  buildNarrativeChannels,
  composeSubheadline,
  composeSupportingContext,
  evidenceContextFromProfile,
  projectCompactKeyPoints,
} from "../compose/narrativeCompose.js";
import type { CliScanPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

export function presentCliScanSummary(
  bundle: ScanPresentationBundle,
  ctx: { repoLabel?: string } = {},
): CliScanPresentation {
  const { facts, profile, result } = bundle;
  const channels = buildNarrativeChannels(bundle);
  const layerScores = resolvePrRiskLayerScores(result);
  const layerLine = layerScores
    ? `security=${layerScores.security} maintainability=${layerScores.maintainability} ecosystem=${layerScores.ecosystem} upgradeImpact=${layerScores.upgradeImpact}`
    : "";
  const prRisk = formatPrRiskSummary(facts);
  const prRiskScore = prRisk?.prRiskScore;

  return {
    ...projectAssessmentFields(bundle),
    header: {
      repoLabel: ctx.repoLabel ?? "scan",
      methodology: result.methodologyVersion ?? undefined,
      confidence: profile.confidence,
    },
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    headline: channels.headline,
    subheadline: composeSubheadline(bundle),
    keyPoints: projectCompactKeyPoints(channels, 6),
    verificationActions: channels.verification.slice(0, 5),
    metrics: {
      ...(prRiskScore !== undefined ? { prRiskScore } : {}),
      prRiskBandLabel: prRisk?.prRiskBandLabel ?? undefined,
      layerLine,
      findingCount: result.findings?.length ?? 0,
      recommendationCount: result.recommendations?.length ?? 0,
    },
    supportingContext: composeSupportingContext(bundle),
    report: humanReport(bundle),
  };
}

function humanReport(bundle: ScanPresentationBundle) {
  const seen = new Set<string>();
  const why = distinctLines(
    [
      ...bundle.reasoningLines,
      ...bundle.concernContextLines,
      bundle.whyThisPackageLine ?? "",
    ],
    seen,
  );
  const verify = distinctLines(
    [...verificationLines(bundle), ...boundedTargetLines(bundle)],
    seen,
  );
  const notAffected = distinctLine(bundle.notAffectedLine, seen);
  const resolution = distinctLine(bundle.resolutionLine, seen);
  const dependency = dependencyContext(bundle);
  return {
    ...(dependency ? { dependency } : {}),
    assessmentLabel: MERGE_POSTURE_LABEL[bundle.profile.status],
    why,
    verify,
    ...(notAffected ? { notAffected } : {}),
    ...(resolution ? { resolution } : {}),
    limitations: distinctLines(limitationLines(bundle), seen),
    findings: distinctLines(findingLines(bundle), seen),
  };
}

function dependencyContext(bundle: ScanPresentationBundle): string | undefined {
  const focal = bundle.assessment.reviewFocalPoint;
  const anchors = focal.anchors
    .map((anchor) => anchor.trim())
    .filter((anchor) => anchor.length > 0 && anchor !== "dependency_graph");
  if (focal.episodeShape === "multi_anchor" && anchors.length > 0) {
    return anchors.join(", ");
  }
  if (anchors.length > 0 && focal.episodeShape !== "structural") {
    const primary = anchors[0]!;
    const supporting = (focal.supportingPackages ?? [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && name !== primary);
    return supporting.length > 0
      ? `${primary} (${supporting.join(", ")})`
      : primary;
  }
  const changed = (bundle.result.changedPackages ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return changed.length > 0 ? changed.join(", ") : undefined;
}

function verificationLines(bundle: ScanPresentationBundle): string[] {
  return bundle.guidanceLines.filter((line) => line.trim().length > 0);
}

function boundedTargetLines(bundle: ScanPresentationBundle): string[] {
  const lines: string[] = [];
  for (const target of bundle.assessment.boundedVerifyTargets ?? []) {
    lines.push(target.whatToVerify, target.whyAutomationStopped);
  }
  return lines;
}

function limitationLines(bundle: ScanPresentationBundle): string[] {
  const lines: string[] = [];
  for (const reason of bundle.assessment.abstainReasons ?? []) {
    if (reason.detail) lines.push(reason.detail);
  }
  const verdict = bundle.assessment.evidenceSufficiencyVerdict;
  for (const blocker of verdict?.blockers ?? []) {
    if (blocker.detail) lines.push(blocker.detail);
  }
  for (const entry of Object.values(verdict?.perPackage ?? {})) {
    for (const blocker of entry.blockers) {
      if (blocker.detail) lines.push(blocker.detail);
    }
  }
  return lines;
}

function findingLines(bundle: ScanPresentationBundle): string[] {
  const lines: string[] = [];
  for (const finding of bundle.result.findings ?? []) {
    lines.push(
      finding.title,
      finding.description,
      finding.recommendation ?? "",
    );
  }
  for (const insight of bundle.result.insights ?? []) {
    lines.push(insight.message, insight.context, insight.remediation);
  }
  return lines;
}

function normalizeDisplayLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function distinctLine(
  value: string | null | undefined,
  seen: Set<string>,
): string | undefined {
  const [line] = distinctLines([value ?? ""], seen);
  return line;
}

function distinctLines(values: string[], seen: Set<string>): string[] {
  const lines: string[] = [];
  for (const value of values) {
    const line = normalizeDisplayLine(value);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}
