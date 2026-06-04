import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentGitHubPrComment as presentGitHubPrCommentFromBundle } from "./presentation/presenters/presentGitHubPrComment.js";
import { renderGitHubPrCommentMarkdown } from "./presentation/render/renderGitHubPrCommentMarkdown.js";
import type { PRDecision, PRInsight, ScanResult } from "./types.js";

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

/** Backward-compatible entry: derives bundle then renders markdown. */
export function renderInsightsAsMarkdown(
  insights: PRInsight[],
  decision: PRDecision,
): string {
  const result: ScanResult = {
    totalScore: 0,
    layerScores: {
      security: 0,
      maintainability: 0,
      ecosystem: 0,
      upgradeImpact: 0,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    insights,
    decision,
  };
  return presentGitHubPrCommentMarkdownFromResult(result);
}
