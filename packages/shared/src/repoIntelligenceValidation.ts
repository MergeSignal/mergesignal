import type {
  AnalysisContextWarning,
  AnalysisPreparation,
  ScanResult,
} from "./types.js";
import {
  REPO_INTELLIGENCE_ABI,
  countRepoIntelligencePackages,
  safeParseRepoIntelligence,
} from "./repoIntelligenceSchema.js";

export type RepoIntelligenceContractLogPayload = {
  issueCount: number;
  representativeIssues: string[];
  packageCount: number;
  methodologyVersion?: string;
};

const MAX_REPRESENTATIVE_ISSUES = 5;

/**
 * Non-blocking production gate: validate repoIntelligence, attach metadata, retain raw payload.
 */
export function applyRepoIntelligenceValidation(
  result: ScanResult,
  options?: { validatedAt?: string },
): {
  result: ScanResult;
  contractFailed: boolean;
  logPayload?: RepoIntelligenceContractLogPayload;
} {
  const validatedAt = options?.validatedAt ?? new Date().toISOString();
  const raw = result.repoIntelligence;

  if (
    raw == null ||
    (typeof raw === "object" && Object.keys(raw).length === 0)
  ) {
    const analysisPreparation: AnalysisPreparation = {
      ...result.analysisPreparation,
      codeIntelligenceAvailable:
        result.analysisPreparation?.codeIntelligenceAvailable ?? false,
      warnings: result.analysisPreparation?.warnings ?? [],
      repoIntelligenceValidation: {
        status: "absent",
        abi: REPO_INTELLIGENCE_ABI,
        validatedAt,
      },
    };
    return {
      result: { ...result, analysisPreparation },
      contractFailed: false,
    };
  }

  const parsed = safeParseRepoIntelligence(raw);
  const packageCount = countRepoIntelligencePackages(raw);

  if (parsed.ok) {
    const analysisPreparation: AnalysisPreparation = {
      ...result.analysisPreparation,
      codeIntelligenceAvailable:
        result.analysisPreparation?.codeIntelligenceAvailable ?? true,
      warnings: result.analysisPreparation?.warnings ?? [],
      repoIntelligenceValidation: {
        status: "valid",
        abi: REPO_INTELLIGENCE_ABI,
        validatedAt,
      },
    };
    return {
      result: { ...result, analysisPreparation },
      contractFailed: false,
    };
  }

  const representativeIssues = parsed.issues.slice(
    0,
    MAX_REPRESENTATIVE_ISSUES,
  );
  const warning: AnalysisContextWarning = {
    code: "repo_intelligence_contract_invalid",
    message:
      "Repository intelligence block failed contract validation; narrative uses graph fallback.",
    details: {
      issueCount: parsed.issueCount,
      representativeIssues,
      abi: REPO_INTELLIGENCE_ABI,
    },
  };

  const analysisPreparation: AnalysisPreparation = {
    ...result.analysisPreparation,
    codeIntelligenceAvailable:
      result.analysisPreparation?.codeIntelligenceAvailable ?? true,
    warnings: [...(result.analysisPreparation?.warnings ?? []), warning],
    repoIntelligenceValidation: {
      status: "invalid",
      abi: REPO_INTELLIGENCE_ABI,
      issueCount: parsed.issueCount,
      representativeIssues,
      validatedAt,
    },
  };

  return {
    result: { ...result, repoIntelligence: raw, analysisPreparation },
    contractFailed: true,
    logPayload: {
      issueCount: parsed.issueCount,
      representativeIssues,
      packageCount,
      methodologyVersion: result.methodologyVersion,
    },
  };
}
