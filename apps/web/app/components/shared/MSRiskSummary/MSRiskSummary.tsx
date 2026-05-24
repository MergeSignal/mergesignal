import type {
  FindingCountSummary,
  MergePosture,
  ScanCardSummary,
} from "@mergesignal/shared";
import {
  ariaLabelForCardSummary,
  isPipelinePlaceholderCopy,
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

function postureIcon(posture: MergePosture | null): string | null {
  if (posture === "safe") return "✓";
  if (posture === "needs_review") return "⚠";
  if (posture === "risky") return "✕";
  return null;
}

function postureEyebrow(posture: MergePosture | null): string | null {
  if (!posture) return null;
  return `Merge risk · ${MERGE_POSTURE_LABEL[posture]}`;
}

function displaySummaryLine(summary: ScanCardSummary): string | null {
  if (!summary.summaryLine) return null;
  if (summary.mergePosture && isPipelinePlaceholderCopy(summary.summaryLine)) {
    return null;
  }
  return summary.summaryLine;
}

function findingCountChips(counts: FindingCountSummary | null) {
  if (!counts) return null;
  const chips: React.ReactNode[] = [];
  if (counts.critical > 0) {
    chips.push(
      <MSBadge key="critical" variant="count" tone="danger">
        {counts.critical} critical
      </MSBadge>,
    );
  }
  if (counts.high > 0) {
    chips.push(
      <MSBadge key="high" variant="count" tone="danger">
        {counts.high} high
      </MSBadge>,
    );
  }
  return chips.length > 0 ? chips : null;
}

export function MSRiskSummary({
  summary,
  stale = false,
  staleSubline,
}: MSRiskSummaryProps) {
  const tone = postureTone(summary.mergePosture);
  const icon = postureIcon(summary.mergePosture);
  const eyebrow = postureEyebrow(summary.mergePosture);
  const summaryLine = displaySummaryLine(summary);
  const countChips = findingCountChips(summary.findingCounts);
  const ariaLabel = ariaLabelForCardSummary(
    summary.headline,
    summary.riskIndex,
    stale && staleSubline
      ? `${summaryLine ?? ""} ${staleSubline}`.trim()
      : summaryLine,
  );

  return (
    <div
      className={[styles.riskBlock, styles[tone], stale ? styles.stale : ""]
        .filter(Boolean)
        .join(" ")}
      data-posture={tone}
      aria-label={ariaLabel}
    >
      {eyebrow && (
        <span className={styles.eyebrow} aria-hidden="true">
          {eyebrow}
        </span>
      )}
      <div className={styles.riskHeader}>
        <span className={styles.headlineWrap}>
          {icon && (
            <span className={styles.postureIcon} aria-hidden="true">
              {icon}
            </span>
          )}
          <span className={styles.headline}>{summary.headline}</span>
        </span>
        {summary.riskIndex != null && (
          <span
            className={[
              styles.riskIndex,
              styles[`index_${summary.riskIndexBand ?? "low"}`],
            ].join(" ")}
          >
            Index {Math.round(summary.riskIndex)}
          </span>
        )}
      </div>

      {summaryLine && <p className={styles.summaryLine}>{summaryLine}</p>}

      {stale && staleSubline && (
        <p className={styles.staleSubline}>{staleSubline}</p>
      )}

      {countChips && (
        <div className={styles.countRow} aria-hidden="true">
          {countChips}
        </div>
      )}
    </div>
  );
}
