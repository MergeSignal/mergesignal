import type { ScanQueueJob } from "@mergesignal/shared";
import type {
  AnalysisPreparation,
  CodeAnalysisInput,
  ScanRequest,
} from "@mergesignal/shared";

/** Narrow production transport — not the full private AnalyzeOptions surface. */
export type ProductionAnalyzeOptions = {
  collectionContext?: unknown;
  reasoningTier?: "free" | "pro" | "enterprise";
};

export type ProductionScanPreparationSummary = {
  codeAnalysisEnabled: boolean;
  changedPackageCount: number;
  lockfileDeltaAdded: number;
  lockfileDeltaRemoved: number;
  lockfileDeltaUpdated: number;
  changedFileCount: number;
  sourceFilesFetched: number;
  sourceFilesSkipped: number;
  repositoryEvidenceEligibleCandidateCount: number;
  repositoryEvidenceSelectedCandidateCount: number;
  repositoryEvidenceCapTruncatedCandidateCount: number;
  sourceFilesSkippedOversized: number;
  sourceFilesSkippedFetchError: number;
  warningCodes: string[];
};

export type ProductionScanIngressResult = {
  scanRequest: ScanRequest;
  codeAnalysis?: CodeAnalysisInput;
  warnings: AnalysisPreparation["warnings"];
  preparationSummary: ProductionScanPreparationSummary;
  collectionContext?: unknown;
};

/** Structural match for the private in-process repository reader. */
export type ProductionRepositoryTreeListing = {
  entries: Array<{ type?: string; path?: string; sha?: string }>;
  truncated: boolean;
};

export type ProductionRepositoryBlob = {
  size?: number;
  bytes: Uint8Array;
};

export type ProductionRepositoryFileAtRevision =
  | { kind: "file"; sha: string; content: string }
  | { kind: "absent" }
  | { kind: "rejected" }
  | { kind: "oversized" }
  | { kind: "failed" };

export type ProductionRepositoryReader = {
  listTree(objectId: string): Promise<ProductionRepositoryTreeListing>;
  readBlob(blobId: string): Promise<ProductionRepositoryBlob>;
  readFileAtRevision(
    revisionRef: string,
    repoRelativePath: string,
  ): Promise<ProductionRepositoryFileAtRevision>;
};

export type OrchestrateProductionScanIngressOptions = {
  reasoningTier?: ProductionAnalyzeOptions["reasoningTier"];
  repositoryReader?: ProductionRepositoryReader;
};

export type OrchestrateProductionScanIngressFn = (
  job: ScanQueueJob,
  options?: OrchestrateProductionScanIngressOptions,
) => Promise<ProductionScanIngressResult>;

export type AnalyzeWithProductionOptionsFn = (
  req: ScanRequest,
  codeAnalysis?: CodeAnalysisInput,
  options?: ProductionAnalyzeOptions,
) => Promise<unknown>;
