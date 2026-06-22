import type {
  MergeConcernKind,
  NarrativeIntensity,
  ReachVisibility,
  VerificationIntensity,
} from "@mergesignal/contracts";
import type { VerificationChannel } from "../../assessmentProjection.js";

/** Assessment-aligned fields projected identically across surfaces. */
export type AssessmentPresentationFields = {
  posture: "safe" | "needs_review" | "risky";
  primaryConcern: MergeConcernKind | null;
  factors: string[];
  reasoning: string[];
  verificationFocus: string[];
  verificationChannel: VerificationChannel;
  reachVisibility: ReachVisibility;
  narrativeIntensity: NarrativeIntensity;
};
