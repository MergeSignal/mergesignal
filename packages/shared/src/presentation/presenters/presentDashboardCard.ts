import {
  MERGE_POSTURE_LABEL,
  MERGE_POSTURE_SORT_ORDER,
} from "../../riskVocabulary.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "../../normalizeGeneratedText.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { DashboardCardPresentation } from "../dto/dashboardCardPresentation.js";
import { buildNarrativeChannels } from "../compose/narrativeChannels.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { projectAssessmentFields } from "../projectAssessmentFields.js";

const INSIGHTS_CAP = 3;
const SCOPE_AREAS_CAP = 2;
const EVIDENCE_CAP = 2;
const VERIFICATION_CAP = 2;

function formatVerificationLine(action: string): string {
  const trimmed = action.trim();
  if (/^verify\b/i.test(trimmed)) return trimmed;
  return `Verify ${trimmed}`;
}

function deriveLayout(
  channels: ReturnType<typeof buildNarrativeChannels>,
  profile: ScanPresentationBundle["profile"],
): DashboardCardPresentation["layout"] {
  const bodyCount =
    channels.insights.length +
    channels.scopeAreas.length +
    channels.evidence.length +
    channels.verification.length;

  if (
    profile.status === "safe" &&
    profile.density === "minimal" &&
    bodyCount === 0 &&
    !channels.limitedContextMessage
  ) {
    return "quiet";
  }
  if (profile.density === "rich") {
    return "expanded";
  }
  return "standard";
}

function normalizeDashboardCard(
  card: DashboardCardPresentation,
): DashboardCardPresentation {
  return {
    ...card,
    headline: normalizeGeneratedText(card.headline),
    limitedContext: card.limitedContext
      ? {
          message: normalizeGeneratedText(card.limitedContext.message),
        }
      : undefined,
    insights: card.insights.map((i) => normalizeGeneratedText(i)),
    scopeAreas: card.scopeAreas?.map((a) => normalizeGeneratedText(a)),
    verification: card.verification.map((v) => normalizeGeneratedText(v)),
    evidenceChips: card.evidenceChips?.map((e) => ({
      label: normalizeGeneratedText(e.label),
      value: normalizeGeneratedText(e.value),
    })),
    pipeline: card.pipeline
      ? {
          ...card.pipeline,
          headline: normalizeGeneratedText(card.pipeline.headline),
          subheadline:
            normalizeGeneratedTextNullable(card.pipeline.subheadline) ??
            undefined,
        }
      : undefined,
  };
}

export function presentDashboardCard(
  bundle: ScanPresentationBundle,
): DashboardCardPresentation {
  const { facts, profile } = bundle;
  const channels = buildNarrativeChannels(bundle);
  const posture = profile.status;
  const riskIndex =
    facts.riskIndex != null && Number.isFinite(facts.riskIndex)
      ? facts.riskIndex
      : -1;

  const insights = channels.insights.slice(0, INSIGHTS_CAP);
  const scopeAreas =
    channels.scopeAreas.length > 0
      ? channels.scopeAreas.slice(0, SCOPE_AREAS_CAP)
      : undefined;
  const evidenceChips =
    channels.evidence.length > 0
      ? channels.evidence.slice(0, EVIDENCE_CAP)
      : undefined;
  const verification = channels.verification
    .slice(0, VERIFICATION_CAP)
    .map(formatVerificationLine);

  const card: DashboardCardPresentation = {
    ...projectAssessmentFields(bundle),
    verdict: {
      posture,
      postureLabel: MERGE_POSTURE_LABEL[posture],
      scopeLabel: channels.reachLabel,
    },
    headline: channels.headline,
    limitedContext: channels.limitedContextMessage
      ? { message: channels.limitedContextMessage }
      : undefined,
    insights,
    scopeAreas,
    verification,
    evidenceChips,
    layout: deriveLayout(channels, profile),
    detailActionLabel: scanSurfaceCopy.presentation.actionLabelReview,
    sortKey: {
      postureRank: MERGE_POSTURE_SORT_ORDER[posture],
      riskIndex,
    },
  };

  return normalizeDashboardCard(card);
}

export function presentSurfacesIncompleteDashboardCard(): DashboardCardPresentation {
  const headline = scanSurfaceCopy.pipeline.surfacesNotSynchronized;
  return normalizeDashboardCard({
    pipeline: {
      status: "failed",
      headline,
      subheadline: scanSurfaceCopy.pipeline.surfacesNotSynchronizedDetail,
    },
    headline,
    insights: [],
    verification: [],
    layout: "standard",
    detailActionLabel: scanSurfaceCopy.presentation.actionLabelReview,
    sortKey: { postureRank: -1, riskIndex: -1 },
  });
}

export function presentPipelineDashboardCard(
  pipelineStatus: "queued" | "running" | "failed",
): DashboardCardPresentation {
  const isRunning = pipelineStatus === "queued" || pipelineStatus === "running";
  const headline = isRunning
    ? scanSurfaceCopy.pipeline.scanRunning
    : scanSurfaceCopy.pipeline.analysisIncomplete;

  return normalizeDashboardCard({
    pipeline: {
      status: pipelineStatus,
      headline,
      subheadline: isRunning
        ? scanSurfaceCopy.pipeline.scanIncomplete
        : undefined,
    },
    headline,
    insights: [],
    verification: [],
    layout: "standard",
    detailActionLabel: scanSurfaceCopy.presentation.actionLabelReview,
    sortKey: { postureRank: -1, riskIndex: -1 },
  });
}
