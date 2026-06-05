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
export { derivePresentationInterpretation } from "./intent/derivePresentationInterpretation.js";
export type {
  PipelineStatus,
  PresentationStatus,
  PresentationDensity,
  PresentationConfidence,
  PresentationPriority,
  PresentationEvidenceContext,
  PresentationEvidenceRow,
} from "./dto/types.js";

export type { ScanCardPresentation } from "./dto/scanCardPresentation.js";
export type { ScanDetailsPresentation } from "./dto/scanDetailsPresentation.js";
export type {
  GitHubCheckRunPresentation,
  GitHubPrCommentPresentation,
  CliScanPresentation,
} from "./dto/githubAndCliPresentation.js";

export { presentScanCard } from "./presenters/presentScanCard.js";
export type { PresentScanCardContext } from "./presenters/presentScanCard.js";
export { presentPipelineScanCard } from "./presenters/presentPipelineScanCard.js";
export { presentScanDetails } from "./presenters/presentScanDetails.js";
export type { PresentScanDetailsContext } from "./presenters/presentScanDetails.js";
export { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
export { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
export { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";

export { renderGitHubCheckRunMarkdown } from "./render/renderGitHubCheckRunMarkdown.js";
export { renderGitHubPrCommentMarkdown } from "./render/renderGitHubPrCommentMarkdown.js";
export { renderCliScanSummaryText } from "./render/renderCliScanSummaryText.js";

export {
  composeHeadline,
  composeSubheadline,
  composeKeyPoints,
  composeVerificationActions,
  composeAffectedAreaLabels,
  composeEvidenceRows,
  composeSupportingContext,
  evidenceContextFromProfile,
} from "./compose/narrativeCompose.js";
