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
  warningCodes: string[];
};

export type ProductionScanIngressResult = {
  scanRequest: ScanRequest;
  codeAnalysis?: CodeAnalysisInput;
  warnings: AnalysisPreparation["warnings"];
  preparationSummary: ProductionScanPreparationSummary;
  collectionContext?: unknown;
};

export type OrchestrateProductionScanIngressOptions = {
  reasoningTier?: ProductionAnalyzeOptions["reasoningTier"];
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
