import type { PackageExpectedImpact } from "../../scanNarrativeFacts.js";

export type PresentationIntent =
  | "limited_context"
  | "no_changed_packages"
  | "tooling_patch"
  | "tooling_upgrade"
  | "runtime_upgrade"
  | "auth_runtime_upgrade"
  | "queue_runtime_upgrade"
  | "multi_runtime_upgrade"
  | "unknown_upgrade";

export type PresentationInterpretation = {
  intent: PresentationIntent;
  anchorPackage: string | null;
  suppressRuntimeNarrative: boolean;
  allowRuntimeNarrative: boolean;
  showLimitedEvidence: boolean;
  expectedImpactKey: PackageExpectedImpact | null;
  verificationLabels: string[];
  runtimeSurfaceLabel: string | null;
  runtimePackages: string[];
};
