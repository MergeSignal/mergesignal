import type {
  AssessmentPresentationPublic,
  AssessmentPresentationWire,
  NarrativeIntensity,
} from "@mergesignal/contracts";

/** Public presentation subset — excludes engine policy fields. */
export function toPublicPresentation(
  wire: AssessmentPresentationWire,
): AssessmentPresentationPublic {
  return {
    narrativeIntensity: wire.narrativeIntensity,
    reachVisibility: wire.reachVisibility,
    verificationIntensity: wire.verificationIntensity,
    reportMode: wire.reportMode,
  };
}

/** Map engine narrative intensity to presentation density (formatting only). */
export function narrativeIntensityToDensity(
  intensity: NarrativeIntensity,
): "minimal" | "standard" | "rich" {
  if (intensity === "minimal") return "minimal";
  if (intensity === "elevated") return "rich";
  return "standard";
}
