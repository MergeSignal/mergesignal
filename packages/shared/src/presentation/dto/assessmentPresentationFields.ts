import type {
  AssessmentPosture,
  MergeConcernKind,
  NarrativeIntensity,
  ReachVisibility,
  VerificationIntensity,
} from "../../assessment/types.js";
import type { VerificationChannel } from "../../assessmentProjection.js";

/** Assessment-aligned fields projected identically across surfaces. */
export type AssessmentPresentationFields = {
  posture: AssessmentPosture;
  primaryConcern: MergeConcernKind | null;
  factors: string[];
  reasoning: string[];
  verificationFocus: string[];
  verificationChannel: VerificationChannel;
  reachVisibility: ReachVisibility;
  narrativeIntensity: NarrativeIntensity;
  /** ABI 3 expression — optional confidence explanation. */
  confidenceRationale?: string;
  /** ABI 3 expression — optional focal-election narrative. */
  electionSummary?: string;
};
