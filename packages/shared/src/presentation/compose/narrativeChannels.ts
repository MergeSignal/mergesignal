import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import {
  applicationAreaLabels,
  formatAssessmentHeadline,
  projectInsightLines,
  projectVerificationActions,
  reachVisibilityLabel,
} from "../../assessmentProjection.js";
import { safeParseRepoIntelligence } from "../../repoIntelligenceSchema.js";
import type { PresentationEvidenceRow } from "../dto/types.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { labelBlastRadiusLevel } from "../../narrativePresentation.js";

type NarrativeChannels = {
  headline: string;
  limitedContextMessage?: string;
  reachLabel?: string;
  insights: string[];
  scopeAreas: string[];
  evidence: PresentationEvidenceRow[];
  verification: string[];
};

function composeScopeAreaLabels(
  bundle: ScanPresentationBundle,
  max: number,
): string[] {
  const parsed = safeParseRepoIntelligence(bundle.result.repoIntelligence);
  const labels = parsed.ok ? applicationAreaLabels(parsed.value) : [];
  return labels.slice(0, max);
}

function composeChannelEvidence(
  bundle: ScanPresentationBundle,
  max: number,
): PresentationEvidenceRow[] {
  const blast = labelBlastRadiusLevel(bundle.facts);
  const rows: PresentationEvidenceRow[] = [];
  if (blast) rows.push({ label: "Blast radius", value: blast });
  return rows.slice(0, max);
}

/** Canonical non-redundant narrative channels — single dedupe point for all surfaces. */
export function buildNarrativeChannels(
  bundle: ScanPresentationBundle,
): NarrativeChannels {
  const { assessment, presentation, profile, result } = bundle;

  const reachLabel = reachVisibilityLabel(presentation.reachVisibility);

  return {
    headline: formatAssessmentHeadline(assessment, profile.status),
    limitedContextMessage: profile.degradedMessage ?? undefined,
    reachLabel,
    insights: projectInsightLines(assessment, result),
    scopeAreas: composeScopeAreaLabels(bundle, 4),
    evidence: composeChannelEvidence(bundle, 4),
    verification: projectVerificationActions(
      assessment,
      presentation,
      result,
      6,
    ),
  };
}

/** Merge distinct channels into one bullet list for single-column surfaces (GitHub check, CLI). */
export function projectCompactKeyPoints(
  channels: NarrativeChannels,
  max: number,
): string[] {
  const bullets: string[] = [...channels.insights];

  if (channels.scopeAreas.length > 0) {
    bullets.push(
      scanSurfaceCopy.presentation.affectedAreasKeyPoint.replace(
        "{areas}",
        channels.scopeAreas.slice(0, 2).join(", "),
      ),
    );
  }

  const blastRow = channels.evidence.find((r) => r.label === "Blast radius");
  if (blastRow?.value === "Wide") {
    bullets.push(scanSurfaceCopy.presentation.blastRadiusWideKeyPoint);
  } else if (blastRow?.value === "Moderate") {
    bullets.push(
      scanSurfaceCopy.presentation.blastRadiusLevelKeyPoint.replace(
        "{level}",
        "Moderate",
      ),
    );
  }

  return bullets.slice(0, max);
}
