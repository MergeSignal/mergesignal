/**
 * Repository-evidence acquisition accounting carried through preparation.
 * Not part of @mergesignal/scan-prep/repository-evidence policy exports.
 */

export type RepositoryEvidenceAcquisitionAccounting = {
  /** Eligible unique paths after policy eligibility and exact-path dedupe, before cap. */
  repositoryEvidenceEligibleCandidateCount: number;
  /** Paths selected for content acquisition after governed cap. */
  repositoryEvidenceSelectedCandidateCount: number;
  /** Eligible candidates not selected because of REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES. */
  repositoryEvidenceCapTruncatedCandidateCount: number;
  /** Cap-selected paths skipped due to REPOSITORY_EVIDENCE_MAX_FILE_BYTES. */
  sourceFilesSkippedOversized: number;
  /** Cap-selected paths skipped due to blob fetch/read failure. */
  sourceFilesSkippedFetchError: number;
};

export const ZERO_REPOSITORY_EVIDENCE_ACQUISITION: RepositoryEvidenceAcquisitionAccounting =
  {
    repositoryEvidenceEligibleCandidateCount: 0,
    repositoryEvidenceSelectedCandidateCount: 0,
    repositoryEvidenceCapTruncatedCandidateCount: 0,
    sourceFilesSkippedOversized: 0,
    sourceFilesSkippedFetchError: 0,
  };

export function aggregateSourceFilesSkipped(
  accounting: Pick<
    RepositoryEvidenceAcquisitionAccounting,
    "sourceFilesSkippedOversized" | "sourceFilesSkippedFetchError"
  >,
): number {
  return (
    accounting.sourceFilesSkippedOversized +
    accounting.sourceFilesSkippedFetchError
  );
}

export function assertRepositoryEvidenceAcquisitionInvariants(input: {
  accounting: RepositoryEvidenceAcquisitionAccounting;
  sourceFilesFetched: number;
  sourceFilesSkipped: number;
}): void {
  const { accounting, sourceFilesFetched, sourceFilesSkipped } = input;
  const {
    repositoryEvidenceEligibleCandidateCount: eligible,
    repositoryEvidenceSelectedCandidateCount: selected,
    repositoryEvidenceCapTruncatedCandidateCount: capTruncated,
    sourceFilesSkippedOversized: oversized,
    sourceFilesSkippedFetchError: fetchError,
  } = accounting;

  if (eligible < selected) {
    throw new Error(
      `repository evidence invariant: eligible (${eligible}) < selected (${selected})`,
    );
  }
  if (selected < sourceFilesFetched) {
    throw new Error(
      `repository evidence invariant: selected (${selected}) < fetched (${sourceFilesFetched})`,
    );
  }
  if (capTruncated !== eligible - selected) {
    throw new Error(
      `repository evidence invariant: capTruncated (${capTruncated}) != eligible - selected (${eligible - selected})`,
    );
  }
  if (sourceFilesSkipped !== oversized + fetchError) {
    throw new Error(
      `repository evidence invariant: sourceFilesSkipped (${sourceFilesSkipped}) != oversized + fetchError (${oversized + fetchError})`,
    );
  }
  if (sourceFilesFetched + sourceFilesSkipped > selected) {
    throw new Error(
      `repository evidence invariant: fetched + skipped (${sourceFilesFetched + sourceFilesSkipped}) > selected (${selected})`,
    );
  }
}
