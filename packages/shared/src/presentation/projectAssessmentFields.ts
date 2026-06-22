import {
  collectVerificationFocusForPresentation,
  projectReasoningLines,
} from "../assessmentProjection.js";
import type { AssessmentPresentationFields } from "./dto/assessmentPresentationFields.js";
import type { ScanPresentationBundle } from "./orchestration/scanPresentationBundle.js";

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
    reasoning: projectReasoningLines(result),
    verificationFocus: focus,
    verificationChannel: channel,
    reachVisibility: presentation.reachVisibility,
    narrativeIntensity: presentation.narrativeIntensity,
  };
}
