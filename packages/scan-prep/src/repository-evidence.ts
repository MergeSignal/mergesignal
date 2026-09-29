/**
 * Approved repository-evidence policy surface for `@mergesignal/scan-prep/repository-evidence`.
 * Authority: docs/engineering/scan-prep-api.md
 */
export {
  REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS,
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
  REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS,
  isRepositoryEvidencePathEligible,
  isRepositoryEvidencePathExcluded,
  prioritizeRepositoryEvidencePaths,
} from "./repository-evidence/corpusPolicy.js";
export {
  filterChangeRequestChangedSourcePaths,
  isChangeRequestChangedSourcePathEligible,
} from "./repository-evidence/changeRequestSourcePaths.js";
