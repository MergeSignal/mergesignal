import {
  composeHeadline,
  composeKeyPoints,
  composeSubheadline,
  composeVerificationActions,
  evidenceContextFromProfile,
} from "../compose/narrativeCompose.js";
import type { GitHubCheckRunPresentation } from "../dto/githubAndCliPresentation.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";

export function presentGitHubCheckRun(
  bundle: ScanPresentationBundle,
  ctx: { scanId: string; webAppOrigin: string; baseline?: boolean },
): GitHubCheckRunPresentation {
  const { profile } = bundle;
  const headline = composeHeadline(bundle);
  const keyPoints = composeKeyPoints(bundle, 3);
  const actions = composeVerificationActions(bundle, 3);
  const detailsUrl = `${ctx.webAppOrigin.replace(/\/$/, "")}/scan/${ctx.scanId}`;

  const conclusion =
    profile.status === "safe"
      ? "success"
      : profile.status === "risky"
        ? "failure"
        : "neutral";

  const sections: GitHubCheckRunPresentation["sections"] = [];
  if (keyPoints.length > 0) {
    sections.push({ id: "why", title: "Why", bullets: keyPoints });
  }
  if (actions.length > 0) {
    sections.push({ id: "actions", title: "What to verify", bullets: actions });
  }
  sections.push({ id: "footer", bullets: [`Full scan: ${detailsUrl}`] });

  return {
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
