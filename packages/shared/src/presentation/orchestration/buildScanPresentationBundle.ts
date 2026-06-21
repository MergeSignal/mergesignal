import { parseAssessmentOrThrow } from "@mergesignal/contracts";
import { toPublicPresentation } from "../../assessmentPresentationUtils.js";
import { deriveScanNarrative } from "../../deriveScanNarrative.js";
import type { ScanResult } from "../../types.js";
import type { PipelineStatus } from "../dto/types.js";
import { buildProfileFromAssessment } from "../profile/buildProfileFromAssessment.js";
import type { ScanPresentationBundle } from "./scanPresentationBundle.js";

export type BuildScanPresentationBundleInput = {
  result: ScanResult;
  pipelineStatus: PipelineStatus;
  decision?: string | null;
};

/**
 * Mandatory orchestration entrypoint for completed-scan presentation.
 * Assessment is the sole authority; profile is a thin projection.
 */
export function buildScanPresentationBundle(
  input: BuildScanPresentationBundleInput,
): ScanPresentationBundle | null {
  if (input.pipelineStatus !== "done" || !input.result) return null;

  const assessment = input.result.assessment;
  if (!assessment) return null;

  let normalized;
  try {
    normalized = parseAssessmentOrThrow(assessment);
  } catch {
    return null;
  }

  const presentation = toPublicPresentation(normalized.presentation);
  const profile = buildProfileFromAssessment(
    normalized,
    presentation,
    input.result,
  );
  const facts = deriveScanNarrative(input.result);

  return {
    assessment: normalized,
    presentation,
    profile,
    facts,
    result: input.result,
  };
}
