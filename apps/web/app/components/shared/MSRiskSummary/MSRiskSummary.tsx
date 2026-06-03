import type { MergePosture, ScanCardSummary } from "@mergesignal/shared";
import {
  ariaLabelForCardSummary,
  cardPostureDisplayLabel,
  deriveCardExposureDisplay,
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

function displayPipelineSummary(summary: ScanCardSummary): string | null {
  if (!summary.summaryLine) return null;
  if (summary.mergePosture && isPipelinePlaceholderCopy(summary.summaryLine)) {
    return null;
  }
  return summary.summaryLine;
}

function operationalObservations(summary: ScanCardSummary): string[] {
  if (summary.operationalObservations?.length) {
    return summary.operationalObservations;
  }
  return [];
}

export function MSRiskSummary({
  summary,
  stale = false,
  staleSubline,
}: MSRiskSummaryProps) {
  const tone = postureTone(summary.mergePosture);
  const observations = operationalObservations(summary);
  const primaryObservation = observations[0] ?? null;
  const secondaryObservations = observations.slice(1);
  const supportingLine =
    observations.length === 1 ? summary.supportingLine : null;
  const pipelineSummary = displayPipelineSummary(summary);
  const hasObservations = observations.length > 0;
  const isQuietOutcome =
    tone === "safe" &&
    !hasObservations &&
    !supportingLine &&
    !pipelineSummary &&
    !staleSubline;
  const postureLabel = summary.mergePosture
    ? MERGE_POSTURE_LABEL[summary.mergePosture]
    : summary.headline;
  const exposure = deriveCardExposureDisplay(summary.riskIndex);

  const ariaLabel = ariaLabelForCardSummary(
    postureLabel,
    summary.riskIndex,
    observations,
    supportingLine,
  );

  return (
    <div
      className={[
        styles.outcomeFlow,
        styles[tone],
        isQuietOutcome ? styles.quietOutcome : "",
        hasObservations ? styles.hasEvidence : "",
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

      {(hasObservations || supportingLine || pipelineSummary) && (
        <div className={styles.artifactCore}>
          {primaryObservation && (
            <p
              className={[
                styles.evidenceLine,
                tone === "review" ? styles.evidenceReview : "",
                tone === "risky" ? styles.evidenceRisky : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {primaryObservation}
            </p>
          )}

          {secondaryObservations.map((observation) => (
            <p key={observation} className={styles.whyLine}>
              {observation}
            </p>
          ))}

          {supportingLine && (
            <p className={[styles.whyLine, styles.whySubordinate].join(" ")}>
              {supportingLine}
            </p>
          )}

          {pipelineSummary && !hasObservations && (
            <p className={styles.whyLine}>{pipelineSummary}</p>
          )}
        </div>
      )}

      {stale && staleSubline && (
        <p className={styles.staleNote}>{staleSubline}</p>
      )}
    </div>
  );
}
