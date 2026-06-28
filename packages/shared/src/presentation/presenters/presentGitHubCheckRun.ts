import { scoreToBandLabel } from "../../prRiskBand.js";
import {
  buildNarrativeChannels,
  composeHeadline,
  composeSubheadline,
  composeVerificationActions,
  evidenceContextFromProfile,
  projectCompactKeyPoints,
} from "../compose/narrativeCompose.js";
import type { GitHubCheckRunPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

export function presentGitHubCheckRun(
  bundle: ScanPresentationBundle,
  ctx: { scanId: string; webAppOrigin: string; baseline?: boolean },
): GitHubCheckRunPresentation {
  const { profile } = bundle;
  const headline = composeHeadline(bundle);
  const assessmentFields = projectAssessmentFields(bundle);
  const actions = composeVerificationActions(bundle, 3);
  const detailsUrl = `${ctx.webAppOrigin.replace(/\/$/, "")}/scan/${ctx.scanId}`;

  const conclusion =
    profile.status === "safe"
      ? "success"
      : profile.status === "risky"
        ? "failure"
        : "neutral";

  const sections: GitHubCheckRunPresentation["sections"] = [];
  const prRiskScore = bundle.facts.riskSignals?.riskIndex;
  const prRiskBandLabelText = scoreToBandLabel(prRiskScore);
  if (prRiskScore != null && prRiskBandLabelText) {
    sections.push({
      id: "why",
      title: "PR Risk",
      bullets: [`${prRiskScore} (${prRiskBandLabelText})`],
    });
  }
  // Use assessment.reasoning directly for the Why section (ABI 3).
  // Fall back to compact key points for pre-ABI-3 scan results.
  const reasoningLines = assessmentFields.reasoning.slice(0, 3);
  const whyBullets =
    reasoningLines.length > 0
      ? reasoningLines
      : projectCompactKeyPoints(buildNarrativeChannels(bundle), 3);
  if (whyBullets.length > 0) {
    sections.push({ id: "why", title: "Why", bullets: whyBullets });
  }
  if (actions.length > 0) {
    sections.push({ id: "actions", title: "What to verify", bullets: actions });
  }
  sections.push({ id: "footer", bullets: [`Full scan: ${detailsUrl}`] });

  return {
    ...assessmentFields,
    status: profile.status,
    density: profile.density,
    confidence: profile.confidence,
    evidenceContext: evidenceContextFromProfile(bundle),
    title: headline,
    conclusion,
    summaryLead: composeSubheadline(bundle) ?? headline,
    sections,
    detailsUrl,
  };
}
