import type {
  Assessment,
  AssessmentPresentationPublic,
} from "@mergesignal/contracts";
import { narrativeIntensityToDensity } from "../../assessmentPresentationUtils.js";
import type { ScanResult } from "../../types.js";
import { safeParseRepoIntelligence } from "../../repoIntelligenceSchema.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { PresentationInterpretation } from "../intent/presentationIntent.js";
import type { PresentationProfile } from "./presentationProfile.js";
import { collectVerificationFocus } from "../../assessmentProjection.js";

function focalAnchorPackage(assessment: Assessment): string | null {
  const anchors = assessment.reviewFocalPoint.anchors;
  if (!anchors.length) return null;
  const token = anchors[0]!;
  if (token === "dependency_graph") return null;
  if (token.includes("+")) return token.split("+")[0]!;
  return token;
}

function buildInterpretation(
  assessment: Assessment,
  presentation: AssessmentPresentationPublic,
  result: ScanResult,
): PresentationInterpretation {
  const verificationLabels = collectVerificationFocus(result);
  const anchorPackage = focalAnchorPackage(assessment);
  const suppressRuntimeNarrative = presentation.reachVisibility === "hidden";

  let intent: PresentationInterpretation["intent"] = "unknown_upgrade";
  if (assessment.primaryConcern === "insufficient_evidence") {
    intent = "limited_context";
  } else if (assessment.changeClasses.includes("tooling_maintenance")) {
    intent = "tooling_patch";
  } else if (assessment.primaryConcern === "confirmed_runtime_usage") {
    if (assessment.factors.includes("queue_infrastructure")) {
      intent = "queue_runtime_upgrade";
    } else if (assessment.factors.includes("auth_infrastructure")) {
      intent = "auth_runtime_upgrade";
    } else {
      intent = "runtime_upgrade";
    }
  }

  return {
    intent,
    anchorPackage,
    suppressRuntimeNarrative,
    allowRuntimeNarrative: !suppressRuntimeNarrative,
    showLimitedEvidence: assessment.confidence === "low",
    expectedImpactKey: null,
    verificationLabels,
    runtimeSurfaceLabel: null,
    runtimePackages: [],
  };
}

export function buildProfileFromAssessment(
  assessment: Assessment,
  presentation: AssessmentPresentationPublic,
  result: ScanResult,
): PresentationProfile {
  const riParse = safeParseRepoIntelligence(result.repoIntelligence);
  const priority =
    riParse.ok && (result.changedPackages?.length ?? 0) > 0
      ? "pr_intelligence"
      : "limited";

  const degradedMessage =
    assessment.primaryConcern === "insufficient_evidence" ||
    assessment.confidence === "low"
      ? scanSurfaceCopy.presentation.limitedContextMessage
      : priority === "limited"
        ? scanSurfaceCopy.presentation.limitedContextMessage
        : undefined;

  return {
    status: assessment.posture,
    density: narrativeIntensityToDensity(presentation.narrativeIntensity),
    confidence: assessment.confidence,
    priority,
    degradedMessage,
    interpretation: buildInterpretation(assessment, presentation, result),
  };
}
