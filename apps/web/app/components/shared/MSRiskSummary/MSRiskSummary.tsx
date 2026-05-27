import type { MergePosture, ScanCardSummary } from "@mergesignal/shared";
import {
  ariaLabelForCardSummary,
  cardPostureDisplayLabel,
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

/** Secondary context — areas/counts when not already the primary "why" line. */
function contextLine(
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
  const context = contextLine(summary, whyLine);
  const isQuietOutcome =
    tone === "safe" && !whyLine && !context && !staleSubline;
  const postureLabel = summary.mergePosture
    ? MERGE_POSTURE_LABEL[summary.mergePosture]
    : summary.headline;

  const ariaLabel = ariaLabelForCardSummary(
    postureLabel,
    summary.riskIndex,
    stale && staleSubline ? `${whyLine ?? ""} ${staleSubline}`.trim() : whyLine,
    context,
  );

  return (
    <div
      className={[
        styles.outcomeFlow,
        styles[tone],
        isQuietOutcome ? styles.quietOutcome : "",
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
            className={tone === "risky" ? styles.riskyBadge : undefined}
          >
            {cardPostureDisplayLabel(summary.mergePosture)}
          </MSBadge>
        </div>
      )}

      {whyLine && (
        <p
          className={[
            styles.whyLine,
            tone === "review" ? styles.whyReview : "",
            tone === "risky" ? styles.whyRisky : "",
            tone === "safe" ? styles.whySafe : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {whyLine}
        </p>
      )}

      {context && <p className={styles.contextLine}>{context}</p>}

      {stale && staleSubline && (
        <p className={styles.staleNote}>{staleSubline}</p>
      )}
    </div>
  );
}
