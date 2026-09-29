import { describe, expect, it } from "vitest";

import {
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  selectRepositoryEvidenceCandidatePaths,
} from "./corpusPolicy.js";
import {
  assertRepositoryEvidenceAcquisitionInvariants,
  aggregateSourceFilesSkipped,
} from "../repository-evidence-acquisition-accounting.js";

describe("selectRepositoryEvidenceCandidatePaths accounting", () => {
  it("reports cap truncation for 5000 eligible unique candidates", () => {
    const paths = Array.from(
      { length: 5_000 },
      (_, i) => `src/evidence-${String(i).padStart(5, "0")}.ts`,
    );
    const selection = selectRepositoryEvidenceCandidatePaths(paths);
    expect(selection.eligibleCandidateCount).toBe(5_000);
    expect(selection.selectedCandidateCount).toBe(
      REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
    );
    expect(selection.capTruncatedCandidateCount).toBe(4_000);
    expect(selection.selectedPaths).toHaveLength(
      REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
    );
  });

  it("keeps prioritizeRepositoryEvidencePaths aligned with selectedPaths", () => {
    const paths = ["src/b.ts", "src/a.ts"];
    const selection = selectRepositoryEvidenceCandidatePaths(paths);
    expect(selection.selectedPaths).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("repository evidence acquisition invariants", () => {
  it("holds for the 5000 → 1000 honesty case with successful fetch", () => {
    const accounting = {
      repositoryEvidenceEligibleCandidateCount: 5_000,
      repositoryEvidenceSelectedCandidateCount: 1_000,
      repositoryEvidenceCapTruncatedCandidateCount: 4_000,
      sourceFilesSkippedOversized: 0,
      sourceFilesSkippedFetchError: 0,
    };
    const sourceFilesSkipped = aggregateSourceFilesSkipped(accounting);
    expect(sourceFilesSkipped).toBe(0);
    assertRepositoryEvidenceAcquisitionInvariants({
      accounting,
      sourceFilesFetched: 1_000,
      sourceFilesSkipped,
    });
  });
});
