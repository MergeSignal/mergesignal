import type { AnalysisPreparation } from "../types.js";
import { REPO_INTELLIGENCE_ABI } from "../repoIntelligenceSchema.js";

/** Worker-shaped preparation for tests that consume trusted repoIntelligence. */
export function analysisPreparationWithValidRepoIntel(
  over?: Partial<AnalysisPreparation>,
): AnalysisPreparation {
  return {
    codeIntelligenceAvailable: true,
    warnings: [],
    repoIntelligenceValidation: {
      status: "valid",
      abi: REPO_INTELLIGENCE_ABI,
      validatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...over,
  };
}

export function analysisPreparationWithInvalidRepoIntel(
  over?: Partial<AnalysisPreparation>,
): AnalysisPreparation {
  return {
    codeIntelligenceAvailable: true,
    warnings: [],
    repoIntelligenceValidation: {
      status: "invalid",
      abi: REPO_INTELLIGENCE_ABI,
      issueCount: 1,
      representativeIssues: ["packages: at least one package required"],
      validatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...over,
  };
}
