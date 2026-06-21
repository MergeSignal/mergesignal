import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import { scoreToBandLabel } from "../../prRiskBand.js";
import {
  buildNarrativeChannels,
  composeSubheadline,
  composeSupportingContext,
  evidenceContextFromProfile,
  projectCompactKeyPoints,
} from "../compose/narrativeCompose.js";
import { formatChangedPackagesShort } from "../../narrativePresentation.js";
import type { GitHubPrCommentPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

export function presentGitHubPrComment(
  bundle: ScanPresentationBundle,
): GitHubPrCommentPresentation {
  const { facts, profile } = bundle;
  const channels = buildNarrativeChannels(bundle);
  const assessmentFields = projectAssessmentFields(bundle);

  const introLines: string[] = [];
  const changed = formatChangedPackagesShort(facts, 3);
  if (changed) introLines.push(`Changed: ${changed}`);
  const prRiskScore = bundle.facts.riskSignals?.riskIndex;
  const prRiskBandLabelText = scoreToBandLabel(prRiskScore);
  if (prRiskScore != null && prRiskBandLabelText) {
    introLines.push(`PR Risk: ${prRiskScore} (${prRiskBandLabelText})`);
  }
  for (const line of assessmentFields.reasoning.slice(0, 2)) {
    introLines.push(line);
  }
  const verify = channels.verification[0];
  if (verify) introLines.push(`Verify: ${verify}`);

  const guidanceBlocks = channels.verification.slice(0, 3).map((action) => ({
    message: assessmentFields.reasoning[0] ?? action,
    where: changed ?? "See scan detail for affected paths.",
    action,
  }));

  return {
    ...assessmentFields,
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    title: MERGE_POSTURE_LABEL[profile.status],
    introLines,
    guidanceBlocks,
  };
}
