import type { ScanResult } from "../types.js";
import { normalizeEngineOutputAbi4 } from "../scanResultSchema.js";

/** Attach ABI-4 prRisk + repositoryHealth wire blocks for strict engine validation tests. */
export function withAbi4EngineScores<T extends ScanResult>(result: T): T {
  return normalizeEngineOutputAbi4(result) as T;
}
