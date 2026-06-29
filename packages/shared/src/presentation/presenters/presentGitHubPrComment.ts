import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import { formatPrRiskSummary } from "../../prRiskBand.js";
import {
  buildNarrativeChannels,
  evidenceContextFromProfile,
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
  const prRisk = formatPrRiskSummary(facts);
  if (prRisk) {
    introLines.push(
      `PR Risk: ${prRisk.prRiskScore} (${prRisk.prRiskBandLabel})`,
    );
  }
  if (assessmentFields.electionSummary) {
    introLines.push(assessmentFields.electionSummary);
  }
  for (const line of assessmentFields.reasoning.slice(0, 2)) {
    introLines.push(line);
  }
  const verify = channels.verification[0];
  if (verify) introLines.push(`Verify: ${verify}`);

  const guidanceBlocks = channels.verification
    .slice(0, 3)
    .map((action, index) => ({
      message: assessmentFields.reasoning[index] ?? action,
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
