import Link from "next/link";
import {
  mergePostureLabel,
  ariaLabelForPosture,
  type MergePosture,
} from "@mergesignal/shared";
import type {
  PRHealthRow,
  ScanState,
} from "../../../../lib/repo-health-view-model";
import styles from "./PRHealthCard.module.css";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function scoreColorClass(score: number | null | undefined): {
  number: string;
  meterFill: string;
} {
  if (score == null) return { number: styles.scoreNone, meterFill: "" };
  if (score > 60)
    return { number: styles.scoreHigh, meterFill: styles.scoreMeterFillHigh };
  if (score > 30)
    return {
      number: styles.scoreMedium,
      meterFill: styles.scoreMeterFillMedium,
    };
  return { number: styles.scoreLow, meterFill: styles.scoreMeterFillLow };
}

function postureClass(posture: MergePosture | null): string {
  if (posture === "risky") return styles.postureRisky;
  if (posture === "needs_review") return styles.postureReview;
  if (posture === "safe") return styles.postureSafe;
  return styles.postureNone;
}

function ScanStateBadge({ state }: { state: ScanState }) {
  if (state === "done") return null;
  const label =
    state === "in_progress"
      ? "Scan in progress"
      : state === "failed"
        ? "Scan failed"
        : state === "outdated"
          ? "Scan outdated"
          : "Not scanned";
  const cls =
    state === "in_progress"
      ? styles.stateInProgress
      : state === "failed"
        ? styles.stateFailed
        : state === "outdated"
          ? styles.stateOutdated
          : styles.stateNotScanned;
  return <span className={`${styles.stateBadge} ${cls}`}>{label}</span>;
}

export function PRHealthCard({ row }: { row: PRHealthRow }) {
  const { pr, scan, scanState, posture } = row;
  const score = scan?.totalScore ?? null;
  const colors = scoreColorClass(score);
  const topAreas = scan?.topAffectedAreas ?? [];
  const areasLabel =
    topAreas.length > 0 ? `Top risk areas: ${topAreas.join(", ")}` : undefined;

  return (
    <li>
      <article
        className={styles.card}
        aria-labelledby={`pr-title-${pr.number}`}
      >
        <div className={styles.cardMain}>
          {/* Row 1: PR number + title + branch */}
          <div className={styles.metaRow}>
            <span className={styles.prNumber}>#{pr.number}</span>
            <span
              id={`pr-title-${pr.number}`}
              className={styles.prTitle}
              title={pr.title}
            >
              {pr.title}
            </span>
            <span
              className={styles.branchChip}
              aria-label={`Target branch: ${pr.baseRef}`}
            >
              {pr.baseRef}
            </span>
          </div>

          {/* Row 2: posture + score + state badge */}
          <div className={styles.signalRow}>
            {(scanState === "done" || scanState === "outdated") && (
              <span
                className={`${styles.postureBadge} ${postureClass(posture)}`}
                aria-label={ariaLabelForPosture(scan?.decision, score)}
              >
                {mergePostureLabel(scan?.decision, "Unknown")}
              </span>
            )}
            {score != null && (
              <div
                className={styles.scoreBar}
                aria-label={`Risk score ${Math.round(score)}`}
              >
                <span className={`${styles.scoreNumber} ${colors.number}`}>
                  {Math.round(score)}
                </span>
                <div className={styles.scoreMeter} aria-hidden="true">
                  <div
                    className={`${styles.scoreMeterFill} ${colors.meterFill}`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
              </div>
            )}
            <ScanStateBadge state={scanState} />
          </div>

          {/* Row 3: summary text */}
          {scan?.summaryText && scanState === "done" && (
            <p className={styles.summaryText}>{scan.summaryText}</p>
          )}

          {/* Row 4: top areas */}
          {topAreas.length > 0 && (
            <div className={styles.topAreas} aria-label={areasLabel}>
              <span className={styles.topAreasLabel} aria-hidden="true">
                Top areas
              </span>
              <span className={styles.topAreasItems} aria-hidden="true">
                {topAreas.join(" · ")}
              </span>
            </div>
          )}

          {/* Row 5: updated time */}
          <div className={styles.footerRow}>
            <time dateTime={pr.updatedAt} className={styles.updatedAt}>
              Updated {formatRelativeTime(pr.updatedAt)}
            </time>
          </div>
        </div>

        {/* Right column: action */}
        <div className={styles.cardAction}>
          {scan && (
            <Link
              href={`/scan/${encodeURIComponent(scan.scanId)}`}
              className={styles.viewDetailsLink}
              aria-label={`View scan details for PR #${pr.number}: ${pr.title}`}
            >
              View details
            </Link>
          )}
        </div>
      </article>
    </li>
  );
}
