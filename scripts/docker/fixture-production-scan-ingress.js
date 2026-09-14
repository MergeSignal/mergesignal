/**
 * Fixture-only production scan ingress — not real Evidence Collection.
 * Baked beside engine-test-fixture for CI/runtime ABI shape verification.
 */
export async function orchestrateProductionScanIngress(job, options) {
  return {
    scanRequest: {
      repoId: job.repoId,
      dependencyGraph: job.dependencyGraph ?? {},
      scanAnalysisScope: "change_request",
    },
    warnings: [],
    preparationSummary: {
      changedPackageCount: 0,
      lockfileDeltaAdded: 0,
      lockfileDeltaRemoved: 0,
      lockfileDeltaUpdated: 0,
      changedFileCount: 0,
      sourceFilesFetched: 0,
      sourceFilesSkipped: 0,
      codeAnalysisEnabled: false,
      warningCodes: [],
    },
    collectionContext: {
      fixture: true,
      reasoningTier: options?.reasoningTier ?? null,
    },
  };
}
