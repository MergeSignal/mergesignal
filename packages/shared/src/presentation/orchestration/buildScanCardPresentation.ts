import { assessmentLimitedContext } from "../../fixtures/assessmentFixtures.js";
import type { PipelineStatus } from "../dto/types.js";
import type { ScanResult } from "../../types.js";
import {
  mergePostureFromDecision,
  type MergePosture,
} from "../../riskVocabulary.js";
import { buildScanPresentationBundle } from "./buildScanPresentationBundle.js";
import {
  presentDashboardCard,
  presentPipelineDashboardCard,
} from "../presenters/presentDashboardCard.js";
import type { DashboardCardPresentation } from "../dto/dashboardCardPresentation.js";

export type BuildScanCardPresentationInput = {
  pipelineStatus: PipelineStatus;
  result: ScanResult | null;
  decision?: string | null;
  /** Denormalized PR risk score (preferred). */
  prRiskScore?: number | null;
};

function minimalResultFromDenormalized(
  decision: string | null | undefined,
  prRiskScore: number | null | undefined,
): ScanResult | null {
  const posture = mergePostureFromDecision(decision ?? undefined);
  if (!posture && (prRiskScore == null || !Number.isFinite(prRiskScore))) {
    return null;
  }

  const score = prRiskScore ?? 0;
  const resolvedPosture = posture as MergePosture | undefined;
  return {
    totalScore: score,
    prRisk: { score },
    layerScores: {
      security: 0,
      maintainability: 0,
      ecosystem: 0,
      upgradeImpact: 0,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    decision: resolvedPosture
      ? { recommendation: resolvedPosture, confidence: "medium", reasoning: [] }
      : undefined,
    assessment: resolvedPosture
      ? { ...assessmentLimitedContext, posture: resolvedPosture }
      : undefined,
  };
}

export function buildScanCardPresentation(
  input: BuildScanCardPresentationInput,
): DashboardCardPresentation {
  if (input.pipelineStatus !== "done") {
    return presentPipelineDashboardCard(
      input.pipelineStatus === "failed" ? "failed" : input.pipelineStatus,
    );
  }

  const prRiskScore = input.prRiskScore ?? null;
  const result =
    input.result ?? minimalResultFromDenormalized(input.decision, prRiskScore);

  if (!result) {
    return presentPipelineDashboardCard("failed");
  }

  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: input.pipelineStatus,
    decision: input.decision,
  });

  if (!bundle) {
    return presentPipelineDashboardCard("failed");
  }

  return presentDashboardCard(bundle);
}
