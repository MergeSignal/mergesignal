import { formatPrRiskSummary } from "../../prRiskBand.js";
import { resolvePrRiskLayerScores } from "../../prRiskWire.js";
import {
  buildNarrativeChannels,
  composeSubheadline,
  composeSupportingContext,
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
  const channels = buildNarrativeChannels(bundle);
  const layerScores = resolvePrRiskLayerScores(result);
  const layerLine = layerScores
    ? `security=${layerScores.security} maintainability=${layerScores.maintainability} ecosystem=${layerScores.ecosystem} upgradeImpact=${layerScores.upgradeImpact}`
    : "";
  const prRisk = formatPrRiskSummary(facts);
  const prRiskScore = prRisk?.prRiskScore ?? facts.riskIndex ?? 0;

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
    headline: channels.headline,
    subheadline: composeSubheadline(bundle),
    keyPoints: projectCompactKeyPoints(channels, 6),
    verificationActions: channels.verification.slice(0, 5),
    metrics: {
      prRiskScore,
      prRiskBandLabel: prRisk?.prRiskBandLabel ?? undefined,
      riskIndex: prRiskScore,
      layerLine,
      findingCount: result.findings?.length ?? 0,
      recommendationCount: result.recommendations?.length ?? 0,
    },
    supportingContext: composeSupportingContext(bundle),
  };
}
