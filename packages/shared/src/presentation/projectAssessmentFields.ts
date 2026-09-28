import { collectVerificationFocusForPresentation } from "../assessmentProjection.js";
import type { AssessmentPresentationFields } from "./dto/assessmentPresentationFields.js";
import type { ScanPresentationBundle } from "./orchestration/scanPresentationBundle.js";

function trimOptionalExpression(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function projectAssessmentFields(
  bundle: ScanPresentationBundle,
): AssessmentPresentationFields {
  const { assessment, presentation, result } = bundle;
  const { channel, focus } = collectVerificationFocusForPresentation(
    presentation,
    result,
  );
  return {
    posture: assessment.posture,
    primaryConcern: assessment.primaryConcern,
    factors: [...assessment.factors],
    reasoning: [...bundle.reasoningLines],
    verificationFocus: focus,
    verificationChannel: channel,
    reachVisibility: presentation.reachVisibility,
    narrativeIntensity: presentation.narrativeIntensity,
    confidenceRationale: trimOptionalExpression(bundle.trustLine),
    electionSummary: trimOptionalExpression(
      assessment.reviewFocalPoint.electionSummary,
    ),
  };
}
