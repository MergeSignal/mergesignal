import type { Assessment } from "../assessment/types.js";
import type { PresentationStatus } from "./dto/types.js";

/**
 * Outcome-primary presentation status. When ABI 4 `outcome` is present it is
 * authoritative over legacy `posture` (historical abstain rows may still carry
 * `posture: risky` without rewriting stored evidence).
 */
export function presentationStatusFromAssessment(
  assessment: Assessment,
): PresentationStatus {
  if (assessment.outcome) {
    switch (assessment.outcome) {
      case "cleared":
        return "safe";
      case "bounded_verify":
        return "needs_review";
      case "proven_broken":
        return "risky";
      case "abstain":
        return "indeterminate";
    }
  }
  return assessment.posture;
}
