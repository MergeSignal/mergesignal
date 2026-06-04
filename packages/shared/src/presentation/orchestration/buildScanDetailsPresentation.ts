import type { PipelineStatus } from "../dto/types.js";
import type { ScanResult } from "../../types.js";
import { buildScanPresentationBundle } from "./buildScanPresentationBundle.js";
import { presentScanDetails } from "../presenters/presentScanDetails.js";
import type { ScanDetailsPresentation } from "../dto/scanDetailsPresentation.js";

export type BuildScanDetailsPresentationInput = {
  scanId: string;
  pipelineStatus: PipelineStatus;
  result: ScanResult;
  methodologyVersion?: string | null;
  prNumber?: number | null;
  decision?: string | null;
  totalScore?: number | null;
};

export function buildScanDetailsPresentation(
  input: BuildScanDetailsPresentationInput,
): ScanDetailsPresentation | null {
  if (input.pipelineStatus !== "done" || !input.result) return null;

  const bundle = buildScanPresentationBundle({
    result: input.result,
    pipelineStatus: input.pipelineStatus,
    decision: input.decision,
    totalScore: input.totalScore,
  });

  if (!bundle) return null;

  return presentScanDetails(bundle, {
    scanId: input.scanId,
    methodologyVersion: input.methodologyVersion,
    prNumber: input.prNumber,
  });
}
