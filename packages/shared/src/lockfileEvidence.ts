import type {
  AnalysisContextWarning,
  AnalysisContextWarningCode,
} from "./types.js";

/** Authoritative lockfile comparison outcome from Scan Preparation. */
export type LockfileEvidenceStatus =
  | { kind: "not_applicable" }
  | { kind: "verified"; delta: "empty" | "changed" }
  | {
      kind: "unavailable";
      reason:
        | "incomplete_parse"
        | "missing_head"
        | "missing_base"
        | "manager_mismatch"
        | "comparison_failed";
    };

/** Lockfile warnings that limit evidence confidence for merge decisions. */
export const LOCKFILE_UNCERTAINTY_WARNING_CODES = [
  "lockfile_evidence_incomplete",
  "lockfile_head_missing",
  "base_lockfile_missing",
  "lockfile_diff_skipped",
  "lockfile_diff_failed",
] as const satisfies readonly AnalysisContextWarningCode[];

export type LockfileUncertaintyWarningCode =
  (typeof LOCKFILE_UNCERTAINTY_WARNING_CODES)[number];

/** Preparation warnings that limit scan context confidence (excludes informational events). */
export const PREPARATION_UNCERTAINTY_WARNING_CODES = [
  ...LOCKFILE_UNCERTAINTY_WARNING_CODES,
  "code_fetch_failed",
  "code_fetch_auth_failure",
  "code_fetch_timeout",
  "code_fetch_rate_limit",
  "code_corpus_empty",
  "repo_intelligence_contract_invalid",
] as const satisfies readonly AnalysisContextWarningCode[];

export type PreparationUncertaintyWarningCode =
  (typeof PREPARATION_UNCERTAINTY_WARNING_CODES)[number];

const lockfileUncertaintySet = new Set<string>(
  LOCKFILE_UNCERTAINTY_WARNING_CODES,
);
const preparationUncertaintySet = new Set<string>(
  PREPARATION_UNCERTAINTY_WARNING_CODES,
);

export function isLockfileUncertaintyWarningCode(
  code: string,
): code is LockfileUncertaintyWarningCode {
  return lockfileUncertaintySet.has(code);
}

export function isPreparationUncertaintyWarning(
  warning: AnalysisContextWarning,
): boolean {
  return preparationUncertaintySet.has(warning.code);
}

export function hasLockfileUncertaintyWarnings(
  warnings: readonly AnalysisContextWarning[],
): boolean {
  return warnings.some((w) => isLockfileUncertaintyWarningCode(w.code));
}

export function hasPreparationUncertaintyWarnings(
  warnings: readonly AnalysisContextWarning[],
): boolean {
  return warnings.some(isPreparationUncertaintyWarning);
}
