import { deriveScanNarrative } from "../../deriveScanNarrative.js";
import type { ScanResult } from "../../types.js";
import type { PipelineStatus } from "../dto/types.js";
import { derivePresentationProfile } from "../profile/derivePresentationProfile.js";
import type { ScanPresentationBundle } from "./scanPresentationBundle.js";

export type BuildScanPresentationBundleInput = {
  result: ScanResult;
  pipelineStatus: PipelineStatus;
  decision?: string | null;
  totalScore?: number | null;
};

/**
 * Mandatory orchestration entrypoint for completed-scan presentation.
 * Only place that calls deriveScanNarrative and derivePresentationProfile.
 */
export function buildScanPresentationBundle(
  input: BuildScanPresentationBundleInput,
): ScanPresentationBundle | null {
  if (input.pipelineStatus !== "done" || !input.result) return null;

  const facts = deriveScanNarrative(input.result);
  const profile = derivePresentationProfile(facts, {
    pipelineStatus: input.pipelineStatus,
    decision: input.decision,
    totalScore: input.totalScore ?? input.result.totalScore,
  });

  if (!profile) return null;

  return {
    facts,
    profile,
    result: input.result,
  };
}
