import type {
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

/**
 * Stub implementation of the analyze function.
 * The actual analysis engine is proprietary and located in a private repository.
 */
export async function analyze(req: ScanRequest): Promise<ScanResult> {
  throw new Error(
    "Analysis engine not available in open-source version. This is a stub implementation."
  );
}

/**
 * Stub implementation of the simulateUpgrade function.
 * The actual upgrade simulation engine is proprietary and located in a private repository.
 */
export async function simulateUpgrade(
  req: UpgradeSimulationRequest
): Promise<UpgradeSimulationResult> {
  throw new Error(
    "Upgrade simulation not available in open-source version. This is a stub implementation."
  );
}
