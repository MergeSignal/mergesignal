import type { ScanResult } from "./types.js";
import {
  safeParseRepoIntelligence,
  type RepoIntelligence,
} from "./repoIntelligenceSchema.js";
import type {
  Assessment,
  AssessmentPresentationPublic,
  ReachVisibility,
  VerificationIntensity,
} from "@mergesignal/contracts";
import {
  labelAssessmentFactor,
  MERGE_CONCERN_LABELS,
} from "./assessmentLabels.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import { applyPostureVocabularyGuardHeadline } from "./presentation/intent/applyPostureVocabularyGuard.js";
import type { PresentationStatus } from "./presentation/dto/types.js";

export type VerificationChannel = "runtime" | "artifact" | "none";

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

function collectVerificationFocusFromPackages(
  packages: string[],
  parsed: { ok: true; value: RepoIntelligence } | { ok: false },
): string[] {
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

export function resolveVerificationChannel(
  intensity: VerificationIntensity,
): VerificationChannel {
  if (intensity === "none") return "none";
  if (intensity === "required") return "runtime";
  return "artifact";
}

export function collectRuntimeVerificationFocus(result: ScanResult): string[] {
  const scope = result.assessment?.verificationScope;
  if (scope?.focus?.length) return [...scope.focus];
  const packages = scope?.packages ?? [];
  return collectVerificationFocusFromPackages(
    packages,
    safeParseRepoIntelligence(result.repoIntelligence),
  );
}

export function collectArtifactVerificationFocus(result: ScanResult): string[] {
  const artifactGrounded =
    result.assessment?.verificationScope?.artifactGrounded;
  if (!artifactGrounded) return [];
  if (artifactGrounded.focus.length > 0) return [...artifactGrounded.focus];
  return collectVerificationFocusFromPackages(
    artifactGrounded.packages,
    safeParseRepoIntelligence(result.repoIntelligence),
  );
}

export function collectVerificationFocusForPresentation(
  presentation: AssessmentPresentationPublic,
  result: ScanResult,
): { channel: VerificationChannel; focus: string[] } {
  const channel = resolveVerificationChannel(
    presentation.verificationIntensity,
  );
  if (channel === "none") {
    return { channel, focus: [] };
  }
  if (channel === "runtime") {
    return { channel, focus: collectRuntimeVerificationFocus(result) };
  }
  return { channel, focus: collectArtifactVerificationFocus(result) };
}

/** @deprecated Use collectVerificationFocusForPresentation or channel-specific collectors. */
export function collectVerificationFocus(result: ScanResult): string[] {
  return collectRuntimeVerificationFocus(result);
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
  // ABI 3: assessment.reasoning is the authoritative source for repository-specific prose
  const fromAssessment = result.assessment?.reasoning?.filter(Boolean) ?? [];
  if (fromAssessment.length > 0) return fromAssessment;
  // Fallback for pre-ABI-3 scan results still in the database
  return result.decision?.reasoning?.filter(Boolean) ?? [];
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
  // ABI 3: use actionable prose guidance when present
  const guidance = assessment.verificationScope?.guidance;
  if (guidance && guidance.length > 0) return guidance.slice(0, max);
  // Fallback: focus tokens from legacy scope or repoIntelligence
  const { focus } = collectVerificationFocusForPresentation(
    presentation,
    result,
  );
  return focus.slice(0, max);
}

export function applicationAreaLabels(ri: RepoIntelligence | null): string[] {
  if (!ri) return [];
  const areas = ri.affectedAreas ?? ri.applicationAreas ?? [];
  return areas.map((a) => a.label).filter(Boolean);
}
