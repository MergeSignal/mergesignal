import {
  collectVerificationFocus,
  projectReasoningLines,
} from "../assessmentProjection.js";
import type { AssessmentPresentationFields } from "./dto/assessmentPresentationFields.js";
import type { ScanPresentationBundle } from "./orchestration/scanPresentationBundle.js";

export function projectAssessmentFields(
  bundle: ScanPresentationBundle,
): AssessmentPresentationFields {
  const { assessment, presentation, result } = bundle;
  return {
    posture: assessment.posture,
    primaryConcern: assessment.primaryConcern,
    factors: [...assessment.factors],
    reasoning: projectReasoningLines(result),
    verificationFocus: collectVerificationFocus(result),
    reachVisibility: presentation.reachVisibility,
    narrativeIntensity: presentation.narrativeIntensity,
  };
}
