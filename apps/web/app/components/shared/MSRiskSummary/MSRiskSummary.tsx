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

function legacyObservations(summary: ScanCardSummary): string[] {
  if (summary.operationalObservations?.length) {
    return summary.operationalObservations;
  }
  return [];
}

function contextMetaLine(summary: ScanCardSummary): string | null {
  const parts: string[] = [];
  if (summary.runtimeSurfaceLabel) parts.push(summary.runtimeSurfaceLabel);
  if (summary.reachabilityLabel) parts.push(summary.reachabilityLabel);
  if (summary.blastRadiusLabel) parts.push(summary.blastRadiusLabel);
  if (summary.affectedAreas.length > 0) {
    parts.push(summary.affectedAreas.join(" · "));
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function MSRiskSummary({
  summary,
  stale = false,
  staleSubline,
}: MSRiskSummaryProps) {
  const tone = postureTone(summary.mergePosture);
  const pipelineSummary = displayPipelineSummary(summary);
  const primaryInsight = summary.primaryInsight;
  const contextLine = contextMetaLine(summary);
  const repoObservations = legacyObservations(summary);
  const secondaryObservations = primaryInsight
    ? repoObservations
    : repoObservations.slice(1);
  const primaryRepoObservation =
    primaryInsight && repoObservations[0] ? repoObservations[0] : null;
  const supportingLine =
    !primaryInsight && repoObservations.length === 1
      ? summary.supportingLine
      : primaryRepoObservation && repoObservations.length === 1
        ? summary.supportingLine
        : null;

  const hasBody =
    Boolean(summary.changedPackagesDisplay) ||
    Boolean(contextLine) ||
    Boolean(primaryInsight) ||
    Boolean(summary.structuralOnlyDisclaimer) ||
    repoObservations.length > 0 ||
    Boolean(supportingLine) ||
    Boolean(pipelineSummary);

  const isQuietOutcome = tone === "safe" && !hasBody && !staleSubline;

  const postureLabel = summary.mergePosture
    ? MERGE_POSTURE_LABEL[summary.mergePosture]
    : summary.headline;
  const exposure = deriveCardExposureDisplay(summary.riskIndex);

  const ariaObservations = [
    summary.changedPackagesDisplay,
    contextLine,
    primaryInsight,
    ...secondaryObservations,
    primaryRepoObservation,
    supportingLine,
    summary.structuralOnlyDisclaimer,
  ].filter((s): s is string => Boolean(s?.trim()));

  const ariaLabel = ariaLabelForCardSummary(
    postureLabel,
    summary.riskIndex,
    ariaObservations,
    null,
  );

  return (
    <div
      className={[
        styles.outcomeFlow,
        styles[tone],
        isQuietOutcome ? styles.quietOutcome : "",
        hasBody ? styles.hasEvidence : "",
        stale ? styles.stale : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-posture={tone}
      data-narrative-mode={summary.narrativeMode}
      aria-label={ariaLabel}
    >
      {hasBody && (
        <div className={styles.artifactCore}>
          {summary.changedPackagesDisplay && (
            <p className={styles.upgradeContext}>
              {summary.changedPackagesDisplay}
            </p>
          )}

          {contextLine && <p className={styles.contextMeta}>{contextLine}</p>}

          {summary.structuralOnlyDisclaimer && (
            <p className={styles.structuralDisclaimer}>
              {summary.structuralOnlyDisclaimer}
            </p>
          )}

          {primaryInsight && (
            <p
              className={[
                styles.evidenceLine,
                tone === "review" ? styles.evidenceReview : "",
                tone === "risky" ? styles.evidenceRisky : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {primaryInsight}
            </p>
          )}

          {!primaryInsight &&
            repoObservations[0] &&
            (() => {
              const observation = repoObservations[0]!;
              return (
                <p
                  className={[
                    styles.evidenceLine,
                    tone === "review" ? styles.evidenceReview : "",
                    tone === "risky" ? styles.evidenceRisky : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {observation}
                </p>
              );
            })()}

          {secondaryObservations.map((observation) => (
            <p key={observation} className={styles.whyLine}>
              {observation}
            </p>
          ))}

          {primaryRepoObservation && (
            <p className={[styles.whyLine, styles.whySubordinate].join(" ")}>
              {primaryRepoObservation}
            </p>
          )}

          {supportingLine && (
            <p className={[styles.whyLine, styles.whySubordinate].join(" ")}>
              {supportingLine}
            </p>
          )}

          {pipelineSummary &&
            !primaryInsight &&
            repoObservations.length === 0 && (
              <p className={styles.whyLine}>{pipelineSummary}</p>
            )}
        </div>
      )}

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

      {stale && staleSubline && (
        <p className={styles.staleNote}>{staleSubline}</p>
      )}
    </div>
  );
}
