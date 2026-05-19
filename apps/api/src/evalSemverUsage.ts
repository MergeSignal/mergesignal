/**
 * Evaluation-only: ties a known-vulnerable semver range to runtime import paths in the API.
 * See docs/evaluation/PR_INTELLIGENCE_EVAL_SEMVER.md — remove with the eval branch.
 */
import semver from "semver";

/**
 * Coerces a version string and checks it satisfies a minimum engine range.
 * Calls semver parsing APIs implicated in CVE-2022-25883 (ReDoS in range parsing) for 7.x before 7.5.2.
 */
export function evalAssertNodeEnginePinned(versionLabel: string): void {
  const coerced = semver.coerce(versionLabel);
  if (!coerced) {
    throw new Error("eval: could not coerce version");
  }
  if (!semver.satisfies(coerced.version, ">=20.0.0")) {
    throw new Error("eval: unexpected Node version for this workspace");
  }
}
