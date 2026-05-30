import Link from "next/link";
import { staleScanSubline } from "@mergesignal/shared";
import type { PRHealthRow } from "../../../../lib/repo-health-view-model";
import { formatRelativeTime } from "../../../../lib/formatRelativeTime";
import { MSChip } from "../../shared/MSChip/MSChip";
import { MSRiskSummary } from "../../shared/MSRiskSummary/MSRiskSummary";
import { MSScanStateIndicator } from "../../shared/MSScanStateIndicator/MSScanStateIndicator";
import { MSTruncatedWithTooltip } from "../../shared/MSTruncatedWithTooltip/MSTruncatedWithTooltip";
import styles from "./PRHealthCard.module.css";

function timestampLabel(presentationState: PRHealthRow["presentationState"]) {
  if (presentationState === "scanning") return "Started";
  if (presentationState === "ready" || presentationState === "stale") {
    return "Scanned";
  }
  return "Updated";
}

function showMetaRow(presentationState: PRHealthRow["presentationState"]) {
  return presentationState !== "ready";
}

export function PRHealthCard({ row }: { row: PRHealthRow }) {
  const { pr, scan, presentationState, cardSummary, timestampIso } = row;
  const showRiskBlock =
    presentationState === "ready" || presentationState === "stale";
  const showPipelineBody =
    presentationState === "scanning" ||
    presentationState === "analysis_failed" ||
    presentationState === "not_scanned";

  return (
    <li className={styles.listItem}>
      <article
        className={styles.card}
        aria-labelledby={`pr-title-${pr.number}`}
      >
        <header className={styles.headerRow}>
          <span className={styles.prNumber}>#{pr.number}</span>
          <MSTruncatedWithTooltip
            id={`pr-title-${pr.number}`}
            className={styles.prTitle}
            tooltipProps={{ position: "bottom" }}
          >
            {pr.title}
          </MSTruncatedWithTooltip>
          <MSChip label={pr.baseRef} className={styles.branchChip} />
        </header>

        {showMetaRow(presentationState) && (
          <div className={styles.metaRow}>
            <MSScanStateIndicator state={presentationState} compact />
          </div>
        )}

        <div className={styles.body}>
          {showRiskBlock && cardSummary && (
            <MSRiskSummary
              summary={cardSummary}
              stale={presentationState === "stale"}
              staleSubline={
                presentationState === "stale" ? staleScanSubline() : undefined
              }
            />
          )}

          {showPipelineBody && cardSummary?.summaryLine && (
            <p className={styles.pipelineSummary}>{cardSummary.summaryLine}</p>
          )}

          {showPipelineBody && !cardSummary?.summaryLine && (
            <p className={styles.pipelineSummaryMuted}>
              {presentationState === "not_scanned"
                ? "No scan available for this pull request yet."
                : null}
            </p>
          )}
        </div>

        <footer className={styles.footerRow}>
          <div className={styles.footerActions}>
            {scan ? (
              <Link
                href={`/scan/${encodeURIComponent(scan.scanId)}`}
                className={styles.viewDetailsLink}
                aria-label={`View scan details for PR #${pr.number}: ${pr.title}`}
              >
                View details
              </Link>
            ) : (
              <span className={styles.noAction} aria-hidden="true">
                —
              </span>
            )}
          </div>
          <time dateTime={timestampIso} className={styles.updatedAt}>
            {timestampLabel(presentationState)}{" "}
            {formatRelativeTime(timestampIso)}
          </time>
        </footer>
      </article>
    </li>
  );
}
