export type { ScanPresentationBundle } from "./orchestration/scanPresentationBundle.js";
export { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
export type { BuildScanPresentationBundleInput } from "./orchestration/buildScanPresentationBundle.js";
export { buildScanCardPresentation } from "./orchestration/buildScanCardPresentation.js";
export type { BuildScanCardPresentationInput } from "./orchestration/buildScanCardPresentation.js";
export { buildScanDetailsPresentation } from "./orchestration/buildScanDetailsPresentation.js";
export type { BuildScanDetailsPresentationInput } from "./orchestration/buildScanDetailsPresentation.js";

export type { PresentationProfile } from "./profile/presentationProfile.js";
export type {
  PresentationIntent,
  PresentationInterpretation,
} from "./intent/presentationIntent.js";
export type {
  PipelineStatus,
  PresentationStatus,
  PresentationDensity,
  PresentationConfidence,
  PresentationPriority,
  PresentationEvidenceContext,
  PresentationEvidenceRow,
} from "./dto/types.js";

export type { DashboardCardPresentation } from "./dto/dashboardCardPresentation.js";
export type { DashboardCardLayout } from "./dto/dashboardCardPresentation.js";
/** @deprecated Use DashboardCardPresentation */
export type { DashboardCardPresentation as ScanCardPresentation } from "./dto/dashboardCardPresentation.js";
export type { ScanDetailsPresentation } from "./dto/scanDetailsPresentation.js";
export type {
  GitHubCheckRunPresentation,
  GitHubPrCommentPresentation,
  CliScanPresentation,
} from "./dto/githubAndCliPresentation.js";

export {
  presentDashboardCard,
  presentPipelineDashboardCard,
  presentSurfacesIncompleteDashboardCard,
} from "./presenters/presentDashboardCard.js";
export { presentScanDetails } from "./presenters/presentScanDetails.js";
export type { PresentScanDetailsContext } from "./presenters/presentScanDetails.js";
export { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
export { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
export { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";

export { renderGitHubCheckRunMarkdown } from "./render/renderGitHubCheckRunMarkdown.js";
export {
  buildGitHubCheckRunOutput,
  resolveWebAppOrigin,
  type GitHubCheckRunConclusion,
  type GitHubCheckRunOutput,
  type BuildGitHubCheckRunOutputOptions,
} from "./buildGitHubCheckRunOutput.js";
export { renderGitHubPrCommentMarkdown } from "./render/renderGitHubPrCommentMarkdown.js";
export { renderCliScanSummaryText } from "./render/renderCliScanSummaryText.js";

export {
  buildNarrativeChannels,
  projectCompactKeyPoints,
  composeHeadline,
  composeSubheadline,
  composeKeyPoints,
  composeVerificationActions,
  composeAffectedAreaLabels,
  composeEvidenceRows,
  composeSupportingContext,
  evidenceContextFromProfile,
} from "./compose/narrativeCompose.js";
