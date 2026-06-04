import { aggregateFindingCounts } from "../dto/types.js";
import type { ScanCardPresentation } from "../dto/scanCardPresentation.js";
import {
  composeAffectedAreaLabels,
  composeEvidenceRows,
  composeHeadline,
  composeKeyPoints,
  composeSubheadline,
  composeSupportingContext,
  composeVerificationActions,
  evidenceContextFromProfile,
} from "../compose/narrativeCompose.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "../../normalizeGeneratedText.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";

export type PresentScanCardContext = {
  includeFindingCounts?: boolean;
};

function normalizeCard(p: ScanCardPresentation): ScanCardPresentation {
  return {
    ...p,
    headline: normalizeGeneratedText(p.headline),
    subheadline: normalizeGeneratedTextNullable(p.subheadline) ?? undefined,
    keyPoints: p.keyPoints.map((k) => normalizeGeneratedText(k)),
    affectedAreas: p.affectedAreas.map((a) => normalizeGeneratedText(a)),
    verificationActions: p.verificationActions.map((v) =>
      normalizeGeneratedText(v),
    ),
    evidence: p.evidence.map((e) => ({
      label: normalizeGeneratedText(e.label),
      value: normalizeGeneratedText(e.value),
    })),
    supportingContext: p.supportingContext?.map((s) =>
      normalizeGeneratedText(s),
    ),
  };
}

export function presentScanCard(
  bundle: ScanPresentationBundle,
  ctx: PresentScanCardContext = {},
): ScanCardPresentation {
  const { facts, profile, result } = bundle;

  const presentation: ScanCardPresentation = {
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    headline: composeHeadline(bundle),
    subheadline: composeSubheadline(bundle) ?? undefined,
    changedPackages: facts.changedPackages.all,
    primaryPackage: facts.changedPackages.primary ?? undefined,
    keyPoints: composeKeyPoints(bundle, 3),
    affectedAreas: composeAffectedAreaLabels(bundle, 2),
    verificationActions: composeVerificationActions(bundle, 2),
    evidence: composeEvidenceRows(bundle, 3),
    supportingContext: composeSupportingContext(bundle),
    riskIndex: facts.riskIndex,
    findingCounts: ctx.includeFindingCounts
      ? aggregateFindingCounts(result.findings)
      : null,
    actionLabel: scanSurfaceCopy.presentation.actionLabelReview,
  };

  return normalizeCard(presentation);
}
