import type { DashboardCardPresentation } from "@mergesignal/shared";
import { MSBadge } from "../../shared/MSBadge/MSBadge";
import styles from "./DashboardScanCardBody.module.css";

export type DashboardScanCardBodyProps = {
  presentation: DashboardCardPresentation;
  stale?: boolean;
  staleSubline?: string;
};

function postureTone(
  posture: DashboardCardPresentation["verdict"],
): "safe" | "review" | "risky" | "neutral" {
  const status = posture?.posture;
  if (status === "risky") return "risky";
  if (status === "needs_review") return "review";
  if (status === "safe") return "safe";
  return "neutral";
}

export function DashboardScanCardBody({
  presentation,
  stale = false,
  staleSubline,
}: DashboardScanCardBodyProps) {
  if (presentation.pipeline) {
    return (
      <div className={styles.outcomeFlow}>
        <p className={styles.pipelineHeadline}>{presentation.headline}</p>
        {presentation.pipeline.subheadline && (
          <p className={styles.pipelineSubheadline}>
            {presentation.pipeline.subheadline}
          </p>
        )}
      </div>
    );
  }

  const tone = postureTone(presentation.verdict);
  const hasBody =
    presentation.insights.length > 0 ||
    (presentation.scopeAreas?.length ?? 0) > 0 ||
    presentation.verification.length > 0 ||
    (presentation.evidenceChips?.length ?? 0) > 0 ||
    Boolean(presentation.limitedContext);

  const isQuietOutcome =
    presentation.layout === "quiet" && !hasBody && !staleSubline;

  const postureLabel =
    presentation.verdict?.postureLabel ?? presentation.headline;

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
      data-layout={presentation.layout}
      data-posture={tone}
      aria-label={`${postureLabel}. ${presentation.headline}`}
    >
      {presentation.verdict && (
        <div className={styles.verdictRow}>
          <MSBadge
            variant="posture"
            tone={tone}
            className={styles.postureBadge}
          >
            {presentation.verdict.postureLabel}
          </MSBadge>
          {presentation.verdict.scopeLabel && (
            <span className={styles.scopeLabel}>
              {presentation.verdict.scopeLabel}
            </span>
          )}
        </div>
      )}

      <h3 className={styles.headline}>{presentation.headline}</h3>

      {presentation.limitedContext && (
        <p className={styles.limitedContext} role="note">
          {presentation.limitedContext.message}
        </p>
      )}

      {hasBody && (
        <>
          {presentation.insights.length > 0 && (
            <div className={styles.insightBlock}>
              {presentation.insights.map((insight) => (
                <p key={insight} className={styles.insightLine}>
                  {insight}
                </p>
              ))}
            </div>
          )}

          {presentation.scopeAreas && presentation.scopeAreas.length > 0 && (
            <p className={styles.scopeAreas}>
              {presentation.scopeAreas.join(" · ")}
            </p>
          )}

          {presentation.verification.length > 0 && (
            <div className={styles.verificationBlock}>
              {presentation.verification.map((action) => (
                <p key={action} className={styles.verificationPill}>
                  {action}
                </p>
              ))}
            </div>
          )}

          {presentation.evidenceChips &&
            presentation.evidenceChips.length > 0 && (
              <div className={styles.evidenceChips}>
                {presentation.evidenceChips.map((chip) => (
                  <span
                    key={`${chip.label}-${chip.value}`}
                    className={styles.evidenceChip}
                  >
                    {chip.label} · {chip.value}
                  </span>
                ))}
              </div>
            )}
        </>
      )}

      {stale && staleSubline && (
        <p className={styles.staleNote}>{staleSubline}</p>
      )}
    </div>
  );
}
