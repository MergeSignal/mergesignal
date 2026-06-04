import type { ScanCardPresentation } from "@mergesignal/shared";
import { MERGE_POSTURE_LABEL } from "@mergesignal/shared";
import { MSBadge } from "../MSBadge/MSBadge";
import { deriveCardExposureDisplay } from "@mergesignal/shared";
import styles from "./MSRiskSummary.module.css";

export type MSRiskSummaryProps = {
  presentation: ScanCardPresentation;
  stale?: boolean;
  staleSubline?: string;
};

function postureTone(
  status: ScanCardPresentation["status"],
): "safe" | "review" | "risky" | "neutral" {
  if (status === "risky") return "risky";
  if (status === "needs_review") return "review";
  if (status === "safe") return "safe";
  return "neutral";
}

export function MSRiskSummary({
  presentation,
  stale = false,
  staleSubline,
}: MSRiskSummaryProps) {
  if (presentation.pipeline) {
    return (
      <div className={styles.outcomeFlow}>
        <p className={styles.whyLine}>{presentation.headline}</p>
        {presentation.pipeline.subheadline && (
          <p className={styles.whySubordinate}>
            {presentation.pipeline.subheadline}
          </p>
        )}
      </div>
    );
  }

  const tone = postureTone(presentation.status);
  const hasBody =
    presentation.keyPoints.length > 0 ||
    presentation.affectedAreas.length > 0 ||
    presentation.verificationActions.length > 0 ||
    presentation.evidence.length > 0 ||
    Boolean(presentation.subheadline);

  const isQuietOutcome =
    tone === "safe" &&
    presentation.density === "minimal" &&
    !hasBody &&
    !staleSubline;

  const postureLabel = presentation.status
    ? MERGE_POSTURE_LABEL[presentation.status]
    : presentation.headline;
  const exposure = deriveCardExposureDisplay(presentation.riskIndex);

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
      data-density={presentation.density}
      aria-label={`${postureLabel}. ${presentation.headline}`}
    >
      <h3 className={styles.upgradeContext}>{presentation.headline}</h3>

      {presentation.subheadline && (
        <p className={styles.contextMeta}>{presentation.subheadline}</p>
      )}

      {hasBody && (
        <div className={styles.artifactCore}>
          {presentation.primaryPackage && (
            <p className={styles.upgradeContext}>
              {presentation.changedPackages.join(", ")}
            </p>
          )}

          {presentation.keyPoints.map((point) => (
            <p key={point} className={styles.evidenceLine}>
              {point}
            </p>
          ))}

          {presentation.affectedAreas.length > 0 && (
            <p className={styles.contextMeta}>
              {presentation.affectedAreas.join(" · ")}
            </p>
          )}

          {presentation.verificationActions.map((action) => (
            <p key={action} className={styles.whySubordinate}>
              Verify: {action}
            </p>
          ))}

          {presentation.evidence.map((row) => (
            <p
              key={`${row.label}-${row.value}`}
              className={styles.whySubordinate}
            >
              {row.label}: {row.value}
            </p>
          ))}
        </div>
      )}

      {presentation.status && (
        <div className={styles.outcomeRow}>
          <MSBadge
            variant="posture"
            tone={tone}
            className={styles.postureBadge}
          >
            {postureLabel}
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
