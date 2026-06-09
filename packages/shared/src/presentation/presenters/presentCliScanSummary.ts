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
  const layers = result.layerScores;
  const layerLine = layers
    ? `security=${layers.security} maintainability=${layers.maintainability} ecosystem=${layers.ecosystem} upgradeImpact=${layers.upgradeImpact}`
    : "";

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
      riskIndex: facts.riskIndex ?? result.totalScore ?? 0,
      layerLine,
      findingCount: result.findings?.length ?? 0,
      recommendationCount: result.recommendations?.length ?? 0,
    },
    supportingContext: composeSupportingContext(bundle),
  };
}
