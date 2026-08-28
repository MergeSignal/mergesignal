import type { ScanAnalysisScope, ScanQueueJob, ScanRequest } from "./types.js";

/** Expected fresh engine-output shape for context-aware ABI-5 validation. */
export type FreshEngineOutputExpectation = ScanAnalysisScope;

const DEFAULT_SCAN_ANALYSIS_SCOPE: ScanAnalysisScope = "repository";

/**
 * Resolves governed analysis scope from a normalized ScanRequest.
 * Defaults to repository when unset.
 */
export function resolveScanAnalysisScope(
  request: Pick<ScanRequest, "scanAnalysisScope">,
): ScanAnalysisScope {
  return request.scanAnalysisScope ?? DEFAULT_SCAN_ANALYSIS_SCOPE;
}

/**
 * Derives strict fresh-output validation expectation from the same normalized
 * ScanRequest fact used by the engine producer.
 */
export function freshOutputExpectationFromScanRequest(
  request: Pick<ScanRequest, "scanAnalysisScope">,
): FreshEngineOutputExpectation {
  return resolveScanAnalysisScope(request);
}

/**
 * Normalizes queue job context into engine ingress scope.
 * GitHub PR jobs are change-request scoped; repository/manual jobs are repository scoped.
 */
export function scanAnalysisScopeFromQueueJob(
  job: Pick<ScanQueueJob, "github">,
): ScanAnalysisScope {
  return job.github ? "change_request" : "repository";
}
