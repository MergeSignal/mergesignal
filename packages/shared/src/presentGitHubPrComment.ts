import { deriveScanNarrative } from "./deriveScanNarrative.js";
import {
  composeVerificationPrompt,
  formatChangedPackagesShort,
  formatUsageSummaryLine,
  selectReviewerGuidance,
} from "./narrativePresentation.js";
import { normalizeGeneratedText } from "./normalizeGeneratedText.js";
import {
  MERGE_POSTURE_LABEL,
  mergePostureFromDecision,
} from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import type { PRDecision, PRInsight, ScanResult } from "./types.js";

function renderGuidanceBlock(
  message: string,
  where: string,
  action: string,
): string {
  return [
    normalizeGeneratedText(message),
    "",
    "**Where it shows up**",
    "",
    normalizeGeneratedText(where),
    "",
    "**What to do**",
    "",
    normalizeGeneratedText(action),
  ].join("\n");
}

/**
 * PR comment markdown from narrative facts (compressed dashboard story).
 */
export function presentGitHubPrComment(
  facts: ScanNarrativeFacts,
  result: ScanResult,
): string {
  const posture =
    facts.mergePosture ??
    mergePostureFromDecision(result.decision?.recommendation);
  const title = posture
    ? `**${MERGE_POSTURE_LABEL[posture]}**`
    : `**${scanSurfaceCopy.checkRun.mergePostureUnavailable}**`;

  const introLines: string[] = [];
  const changed = formatChangedPackagesShort(facts, 3);
  if (changed) introLines.push(`Changed: ${changed}`);
  const usage = formatUsageSummaryLine(facts, 1);
  if (usage) introLines.push(usage);
  const verify = composeVerificationPrompt(facts);
  if (verify) introLines.push(`Verify: ${verify}`);

  const guidance = selectReviewerGuidance(facts, { scope: "changed", max: 3 });
  if (guidance.length === 0) {
    const fallback = selectReviewerGuidance(facts, { max: 3 });
    guidance.push(...fallback.slice(0, 3 - guidance.length));
  }

  const blocks = guidance.map((g) => {
    const where =
      g.context?.trim() ||
      facts.packageUsage
        .flatMap((u) => u.paths.slice(0, 1))
        .filter(Boolean)[0] ||
      "See scan detail for affected paths.";
    const action =
      g.remediation?.trim() ||
      composeVerificationPrompt(facts) ||
      "Review before merge.";
    return renderGuidanceBlock(g.message, where, action);
  });

  const parts = [title];
  if (introLines.length > 0) {
    parts.push("", introLines.join("\n"));
  }
  if (blocks.length > 0) {
    parts.push("", ...blocks);
  }

  return parts.join("\n\n---\n\n").trimEnd();
}

/** Backward-compatible entry: derives facts then presents. */
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
  const facts = deriveScanNarrative(result);
  return presentGitHubPrComment(facts, result);
}
