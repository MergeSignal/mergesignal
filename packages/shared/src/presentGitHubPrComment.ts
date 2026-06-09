import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentGitHubPrComment as presentGitHubPrCommentFromBundle } from "./presentation/presenters/presentGitHubPrComment.js";
import { renderGitHubPrCommentMarkdown } from "./presentation/render/renderGitHubPrCommentMarkdown.js";
import type { ScanResult } from "./types.js";

/**
 * PR comment markdown from a completed scan (via presentation bundle).
 */
export function presentGitHubPrCommentMarkdownFromResult(
  result: ScanResult,
): string {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
    decision: result.decision?.recommendation,
    totalScore: result.totalScore,
  });
  if (!bundle) return "";
  return renderGitHubPrCommentMarkdown(
    presentGitHubPrCommentFromBundle(bundle),
  );
}
