import type { PipelineStatus } from "../dto/types.js";
import type { ScanResult } from "../../types.js";
import { mergePostureFromDecision } from "../../riskVocabulary.js";
import { buildScanPresentationBundle } from "./buildScanPresentationBundle.js";
import { presentScanCard } from "../presenters/presentScanCard.js";
import { presentPipelineScanCard } from "../presenters/presentPipelineScanCard.js";
import type { ScanCardPresentation } from "../dto/scanCardPresentation.js";

export type BuildScanCardPresentationInput = {
  pipelineStatus: PipelineStatus;
  result: ScanResult | null;
  decision?: string | null;
  totalScore?: number | null;
};

function minimalResultFromDenormalized(
  decision: string | null | undefined,
  totalScore: number | null | undefined,
): ScanResult | null {
  const posture = mergePostureFromDecision(decision ?? undefined);
  if (!posture && (totalScore == null || !Number.isFinite(totalScore))) {
    return null;
  }

  return {
    totalScore: totalScore ?? 0,
    layerScores: {
      security: 0,
      maintainability: 0,
      ecosystem: 0,
      upgradeImpact: 0,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    decision: posture
      ? { recommendation: posture, confidence: "medium", reasoning: [] }
      : undefined,
  };
}

export function buildScanCardPresentation(
  input: BuildScanCardPresentationInput,
): ScanCardPresentation {
  if (input.pipelineStatus !== "done") {
    return presentPipelineScanCard(
      input.pipelineStatus === "failed" ? "failed" : input.pipelineStatus,
    );
  }

  const result =
    input.result ??
    minimalResultFromDenormalized(input.decision, input.totalScore);

  if (!result) {
    return presentPipelineScanCard("failed");
  }

  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: input.pipelineStatus,
    decision: input.decision,
    totalScore: input.totalScore,
  });

  if (!bundle) {
    return presentPipelineScanCard("failed");
  }

  return presentScanCard(bundle, { includeFindingCounts: true });
}
