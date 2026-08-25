import type { AssessmentPresentationPublic } from "../assessment/types.js";

type PackageReachGuard = {
  suppressRuntimeNarrative?: boolean;
};

/**
 * Whether user-facing presentation may surface reach/runtime evidence derived from
 * canonical Repository Intelligence. Assessment `reachVisibility` is the primary gate;
 * package-level `suppressRuntimeNarrative` is a subordinate per-package guard.
 */
export function shouldSurfaceReachNarrative(
  presentation: Pick<AssessmentPresentationPublic, "reachVisibility">,
  packageWireRow?: PackageReachGuard,
): boolean {
  if (presentation.reachVisibility === "hidden") return false;
  if (packageWireRow?.suppressRuntimeNarrative === true) return false;
  return true;
}
