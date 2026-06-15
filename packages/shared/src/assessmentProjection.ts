import type { ScanResult } from "./types.js";
import {
  safeParseRepoIntelligence,
  type RepoIntelligence,
} from "./repoIntelligenceSchema.js";
import type {
  Assessment,
  AssessmentPresentationPublic,
  ReachVisibility,
} from "@mergesignal/contracts";
import {
  labelAssessmentFactor,
  MERGE_CONCERN_LABELS,
} from "./assessmentLabels.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import { applyPostureVocabularyGuardHeadline } from "./presentation/intent/applyPostureVocabularyGuard.js";
import type { PresentationStatus } from "./presentation/dto/types.js";

function focalDisplayPackage(assessment: Assessment): string {
  const anchors = assessment.reviewFocalPoint.anchors;
  if (anchors.length === 0) return "dependency";
  const token = anchors[0]!;
  if (token === "dependency_graph") return "dependencies";
  if (token.includes("+")) return token.split("+")[0]!;
  return token;
}

function focalHeadlinePackages(assessment: Assessment): string {
  const focal = assessment.reviewFocalPoint;
  if (focal.episodeShape === "multi_anchor") {
    return focal.anchors.join(", ");
  }
  return focalDisplayPackage(assessment);
}

/** Copy-formatting only — fills {surface} in runtime headline template. */
function surfaceHintFromAssessment(assessment: Assessment): string {
  const factors = assessment.factors;
  const anchor = focalDisplayPackage(assessment);
  if (anchor === "bullmq" || factors.includes("queue_infrastructure")) {
    return "workers and queues";
  }
  if (anchor === "next-auth" || factors.includes("auth_infrastructure")) {
    return "authentication flows";
  }
  return "application code";
}

export function collectVerificationFocus(result: ScanResult): string[] {
  const scope = result.assessment?.verificationScope;
  if (scope?.focus?.length) return [...scope.focus];
  const packages = scope?.packages ?? [];
  const parsed = safeParseRepoIntelligence(result.repoIntelligence);
  if (!parsed.ok) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    const row = parsed.value.packages[pkg];
    for (const focus of row?.verificationFocus ?? []) {
      const t = focus.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      labels.push(t);
    }
  }
  return labels;
}

export function reachVisibilityLabel(
  visibility: ReachVisibility,
): string | undefined {
  switch (visibility) {
    case "hidden":
      return undefined;
    case "contextual":
      return scanSurfaceCopy.scanDetail.reachChip.limited;
    case "prominent":
      return scanSurfaceCopy.scanDetail.reachChip.moderate;
    default:
      return undefined;
  }
}

export function formatAssessmentHeadline(
  assessment: Assessment,
  status: PresentationStatus,
): string {
  const copy = scanSurfaceCopy.presentation;
  const primaryPkg = focalHeadlinePackages(assessment);
  if (assessment.reviewFocalPoint.episodeShape === "structural") {
    const headline = copy.defaultUpgradeHeadline.replace(
      "{package}",
      "dependencies",
    );
    return applyPostureVocabularyGuardHeadline(headline, status, null);
  }

  if (assessment.primaryConcern === "insufficient_evidence") {
    return applyPostureVocabularyGuardHeadline(
      copy.limitedContextHeadline,
      status,
      primaryPkg,
    );
  }

  const changeClass = assessment.changeClasses[0];
  if (
    assessment.posture === "safe" &&
    (changeClass === "tooling_maintenance" || changeClass === "test_infra")
  ) {
    const headline = copy.toolingPatchHeadline.replace("{package}", primaryPkg);
    return applyPostureVocabularyGuardHeadline(headline, status, primaryPkg);
  }

  if (assessment.primaryConcern === "confirmed_runtime_usage") {
    const surface = surfaceHintFromAssessment(assessment);
    const headline = copy.runtimeUpgradeHeadline
      .replace("{package}", primaryPkg)
      .replace("{surface}", surface);
    return applyPostureVocabularyGuardHeadline(headline, status, primaryPkg);
  }

  if (assessment.posture === "safe") {
    return applyPostureVocabularyGuardHeadline(
      copy.safeNeutralHeadline.replace("{package}", primaryPkg),
      status,
      primaryPkg,
    );
  }

  return applyPostureVocabularyGuardHeadline(
    copy.defaultUpgradeHeadline.replace("{package}", primaryPkg),
    status,
    primaryPkg,
  );
}

export function projectReasoningLines(result: ScanResult): string[] {
  const fromDecision = result.decision?.reasoning?.filter(Boolean) ?? [];
  if (fromDecision.length > 0) return fromDecision.slice(0, 3);
  return [];
}

export function projectInsightLines(
  assessment: Assessment,
  result: ScanResult,
): string[] {
  const reasoning = projectReasoningLines(result);
  if (reasoning.length > 0) return reasoning;

  const lines: string[] = [];
  if (assessment.primaryConcern) {
    lines.push(MERGE_CONCERN_LABELS[assessment.primaryConcern]);
  }
  for (const token of assessment.factors) {
    const label = labelAssessmentFactor(token);
    if (!lines.includes(label)) lines.push(label);
  }
  return lines.slice(0, 3);
}

export function projectVerificationActions(
  assessment: Assessment,
  presentation: AssessmentPresentationPublic,
  result: ScanResult,
  max: number,
): string[] {
  if (presentation.verificationIntensity === "none") return [];
  const focus = collectVerificationFocus(result);
  return focus.slice(0, max);
}

export function applicationAreaLabels(ri: RepoIntelligence | null): string[] {
  if (!ri) return [];
  const areas = ri.affectedAreas ?? ri.applicationAreas ?? [];
  return areas.map((a) => a.label).filter(Boolean);
}
