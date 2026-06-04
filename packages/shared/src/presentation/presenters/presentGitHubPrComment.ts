import { MERGE_POSTURE_LABEL } from "../../riskVocabulary.js";
import {
  composeHeadline,
  composeKeyPoints,
  composeSubheadline,
  composeSupportingContext,
  composeVerificationActions,
  evidenceContextFromProfile,
} from "../compose/narrativeCompose.js";
import {
  formatChangedPackagesShort,
  formatUsageSummaryLine,
  selectReviewerGuidance,
} from "../../narrativePresentation.js";
import type { GitHubPrCommentPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";

export function presentGitHubPrComment(
  bundle: ScanPresentationBundle,
): GitHubPrCommentPresentation {
  const { facts, profile } = bundle;

  const introLines: string[] = [];
  const changed = formatChangedPackagesShort(facts, 3);
  if (changed) introLines.push(`Changed: ${changed}`);
  const usage = formatUsageSummaryLine(facts, 1);
  if (usage) introLines.push(usage);
  const verify = composeVerificationActions(bundle, 1)[0];
  if (verify) introLines.push(`Verify: ${verify}`);

  const guidance = selectReviewerGuidance(facts, { scope: "changed", max: 3 });
  const selected =
    guidance.length === 0
      ? selectReviewerGuidance(facts, { max: 3 })
      : guidance;

  const guidanceBlocks = selected.map((g) => {
    const where =
      g.context?.trim() ||
      facts.packageUsage
        .flatMap((u) => u.paths.slice(0, 1))
        .filter(Boolean)[0] ||
      "See scan detail for affected paths.";
    const action =
      g.remediation?.trim() ||
      composeVerificationActions(bundle, 1)[0] ||
      "Review before merge.";
    return { message: g.message, where, action };
  });

  return {
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    title: MERGE_POSTURE_LABEL[profile.status],
    introLines,
    guidanceBlocks,
  };
}
