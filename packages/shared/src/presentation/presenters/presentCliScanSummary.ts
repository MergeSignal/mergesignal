import { scoreToBandLabel } from "../../prRiskBand.js";
import { resolvePrRiskLayerScores } from "../../prRiskWire.js";
import {
  buildNarrativeChannels,
  composeHeadline,
  composeSubheadline,
  composeSupportingContext,
  composeVerificationActions,
  evidenceContextFromProfile,
  projectCompactKeyPoints,
} from "../compose/narrativeCompose.js";
import type { CliScanPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

export function presentCliScanSummary(
  bundle: ScanPresentationBundle,
  ctx: { repoLabel?: string } = {},
): CliScanPresentation {
  const { facts, profile, result } = bundle;
  const layerScores = resolvePrRiskLayerScores(result);
  const layerLine = layerScores
    ? `security=${layerScores.security} maintainability=${layerScores.maintainability} ecosystem=${layerScores.ecosystem} upgradeImpact=${layerScores.upgradeImpact}`
    : "";
  const prRiskScore = facts.riskSignals?.riskIndex ?? facts.riskIndex ?? 0;

  return {
    ...projectAssessmentFields(bundle),
    header: {
      repoLabel: ctx.repoLabel ?? "scan",
      methodology: result.methodologyVersion ?? undefined,
      confidence: profile.confidence,
    },
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    headline: composeHeadline(bundle),
    subheadline: composeSubheadline(bundle),
    keyPoints: projectCompactKeyPoints(buildNarrativeChannels(bundle), 6),
    verificationActions: composeVerificationActions(bundle, 5),
    metrics: {
      prRiskScore,
      prRiskBandLabel: scoreToBandLabel(prRiskScore) ?? undefined,
      riskIndex: prRiskScore,
      layerLine,
      findingCount: result.findings?.length ?? 0,
      recommendationCount: result.recommendations?.length ?? 0,
    },
    supportingContext: composeSupportingContext(bundle),
  };
}
