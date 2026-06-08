import { deriveDetailReachChip } from "../../formatCardExposureDisplay.js";
import { scanSurfaceCopy } from "../../scanSurfaceCopy.js";
import type { PresentationEvidenceRow } from "../dto/types.js";
import {
  formatPresentationHeadline,
  formatPresentationInsightLines,
  formatPresentationVerification,
} from "../intent/formatPresentationCopy.js";
import type { ScanPresentationBundle } from "../orchestration/scanPresentationBundle.js";
import { formatCardAreaLabels } from "../../formatCardAreaLabels.js";
import {
  labelBlastRadiusLevel,
  labelReachabilityKind,
} from "../../narrativePresentation.js";

export type NarrativeChannels = {
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
  const labels: string[] = [];
  for (const area of bundle.facts.affectedAreas) {
    const formatted = formatCardAreaLabels([area.label], 1);
    if (formatted[0]) labels.push(formatted[0]);
    if (labels.length >= max) break;
  }
  return labels;
}

function isTautologicalEvidenceRow(row: PresentationEvidenceRow): boolean {
  const label = row.label.trim().toLowerCase();
  const value = row.value.trim().toLowerCase();
  if (label === "runtime" && value === "runtime") return true;
  return false;
}

function composeChannelEvidence(
  bundle: ScanPresentationBundle,
  max: number,
): PresentationEvidenceRow[] {
  const { facts, profile } = bundle;
  const rows: PresentationEvidenceRow[] = [];

  if (!profile.interpretation.suppressRuntimeNarrative) {
    const reach = labelReachabilityKind(facts);
    if (reach) rows.push({ label: "Reachability", value: reach });
  }

  const blast = labelBlastRadiusLevel(facts);
  if (blast) rows.push({ label: "Blast radius", value: blast });

  return rows.filter((row) => !isTautologicalEvidenceRow(row)).slice(0, max);
}

function shouldShowReachLabel(bundle: ScanPresentationBundle): boolean {
  const { profile } = bundle;
  if (profile.status === "safe" && profile.density === "minimal") {
    return false;
  }
  return profile.status !== "safe" || profile.density !== "minimal";
}

/** Canonical non-redundant narrative channels — single dedupe point for all surfaces. */
export function buildNarrativeChannels(
  bundle: ScanPresentationBundle,
): NarrativeChannels {
  const { facts, profile, result } = bundle;
  const riskIndex = facts.riskIndex ?? result.totalScore ?? null;

  const reachLabel =
    shouldShowReachLabel(bundle) && riskIndex != null
      ? (deriveDetailReachChip(riskIndex) ?? undefined)
      : undefined;

  return {
    headline: formatPresentationHeadline(
      profile.interpretation,
      facts,
      profile.status,
    ),
    limitedContextMessage: profile.degradedMessage ?? undefined,
    reachLabel,
    insights: formatPresentationInsightLines(
      profile.interpretation,
      facts,
      profile.status,
    ),
    scopeAreas: composeScopeAreaLabels(bundle, 4),
    evidence: composeChannelEvidence(bundle, 4),
    verification: formatPresentationVerification(
      profile.interpretation,
      profile.status,
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
