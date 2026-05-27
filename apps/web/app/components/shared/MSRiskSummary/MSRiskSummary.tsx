import type { MergePosture, ScanCardSummary } from "@mergesignal/shared";
import {
  ariaLabelForCardSummary,
  cardPostureDisplayLabel,
  deriveCardExposureDisplay,
  formatCardEvidenceCounts,
  isPipelinePlaceholderCopy,
  joinCardAreaLabels,
  MERGE_POSTURE_LABEL,
} from "@mergesignal/shared";
import { MSBadge } from "../MSBadge/MSBadge";
import styles from "./MSRiskSummary.module.css";

export type MSRiskSummaryProps = {
  summary: ScanCardSummary;
  stale?: boolean;
  staleSubline?: string;
};

function postureTone(
  posture: MergePosture | null,
): "safe" | "review" | "risky" | "neutral" {
  if (posture === "risky") return "risky";
  if (posture === "needs_review") return "review";
  if (posture === "safe") return "safe";
  return "neutral";
}

function displaySummaryLine(summary: ScanCardSummary): string | null {
  if (!summary.summaryLine) return null;
  if (summary.mergePosture && isPipelinePlaceholderCopy(summary.summaryLine)) {
    return null;
  }
  return summary.summaryLine;
}

/** Operational evidence — areas/counts when not already the primary why line. */
function evidenceLine(
  summary: ScanCardSummary,
  whyLine: string | null,
): string | null {
  const areas = joinCardAreaLabels(summary.topAffectedAreas);
  const counts = formatCardEvidenceCounts(
    summary.findingCounts,
    summary.mergePosture,
  );

  if (whyLine && areas && whyLine.includes(areas)) {
    return counts;
  }
  if (whyLine && areas && areas !== whyLine) {
    return counts ? `${areas} · ${counts}` : areas;
  }
  if (!whyLine && areas) return counts ? `${areas} · ${counts}` : areas;
  if (counts) return counts;
  return null;
}

export function MSRiskSummary({
  summary,
  stale = false,
  staleSubline,
}: MSRiskSummaryProps) {
  const tone = postureTone(summary.mergePosture);
  const whyLine = displaySummaryLine(summary);
  const evidence = evidenceLine(summary, whyLine);
  const hasEvidence = Boolean(evidence);
  const isQuietOutcome =
    tone === "safe" && !whyLine && !evidence && !staleSubline;
  const postureLabel = summary.mergePosture
    ? MERGE_POSTURE_LABEL[summary.mergePosture]
    : summary.headline;
  const exposure = deriveCardExposureDisplay(summary.riskIndex);

  const ariaLabel = ariaLabelForCardSummary(
    postureLabel,
    summary.riskIndex,
    stale && staleSubline ? `${whyLine ?? ""} ${staleSubline}`.trim() : whyLine,
    evidence,
  );

  return (
    <div
      className={[
        styles.outcomeFlow,
        styles[tone],
        isQuietOutcome ? styles.quietOutcome : "",
        hasEvidence ? styles.hasEvidence : "",
        stale ? styles.stale : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-posture={tone}
      aria-label={ariaLabel}
    >
      {summary.mergePosture && (
        <div className={styles.outcomeRow}>
          <MSBadge
            variant="posture"
            tone={tone}
            className={styles.postureBadge}
          >
            {cardPostureDisplayLabel(summary.mergePosture)}
          </MSBadge>
          {exposure && (
            <span className={styles.exposureMeta}>
              <span className={styles.exposureCategory}>{exposure.label}</span>
            </span>
          )}
        </div>
      )}

      {(evidence || whyLine) && (
        <div className={styles.artifactCore}>
          {evidence && (
            <p
              className={[
                styles.evidenceLine,
                tone === "review" ? styles.evidenceReview : "",
                tone === "risky" ? styles.evidenceRisky : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {evidence}
            </p>
          )}

          {whyLine && (
            <p
              className={[
                styles.whyLine,
                hasEvidence ? styles.whySubordinate : "",
                tone === "review" && !hasEvidence ? styles.whyReview : "",
                tone === "risky" && !hasEvidence ? styles.whyRisky : "",
                tone === "safe" ? styles.whySafe : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {whyLine}
            </p>
          )}
        </div>
      )}

      {stale && staleSubline && (
        <p className={styles.staleNote}>{staleSubline}</p>
      )}
    </div>
  );
}
