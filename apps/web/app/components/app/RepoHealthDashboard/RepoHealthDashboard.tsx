import Link from "next/link";
import { MERGE_POSTURE_LABEL } from "@mergesignal/shared";
import type { RepoPullHealthViewModel } from "../../../../lib/repo-health-view-model";
import { PRHealthCard } from "./PRHealthCard";
import styles from "./RepoHealthDashboard.module.css";

type Props = {
  repoId: string;
  owner: string;
  repo: string;
  viewModel: RepoPullHealthViewModel;
  prsFetchError?: string | null;
  scansFetchError?: string | null;
};

function SummaryStrip({
  totalPRs,
  coveredPRs,
  byPosture,
}: Pick<RepoPullHealthViewModel, "totalPRs" | "coveredPRs" | "byPosture">) {
  return (
    <div
      className={styles.summaryStrip}
      aria-label="Pull request health summary"
    >
      <div className={styles.stripStat}>
        <span className={styles.stripValue}>{totalPRs}</span>
        <span className={styles.stripLabel}>
          open PR{totalPRs !== 1 ? "s" : ""}
        </span>
      </div>

      {coveredPRs > 0 && (
        <>
          <div className={styles.stripDivider} aria-hidden="true" />
          <div className={styles.stripStat}>
            <span className={styles.stripValue}>{coveredPRs}</span>
            <span className={styles.stripLabel}>scanned</span>
          </div>
        </>
      )}

      {(byPosture.risky > 0 ||
        byPosture.needs_review > 0 ||
        byPosture.safe > 0) && (
        <>
          <div className={styles.stripDivider} aria-hidden="true" />
          <div className={styles.stripBadges}>
            {byPosture.risky > 0 && (
              <span
                className={`${styles.stripBadge} ${styles.stripBadgeRisky}`}
              >
                {byPosture.risky} {MERGE_POSTURE_LABEL.risky}
              </span>
            )}
            {byPosture.needs_review > 0 && (
              <span
                className={`${styles.stripBadge} ${styles.stripBadgeReview}`}
              >
                {byPosture.needs_review} {MERGE_POSTURE_LABEL.needs_review}
              </span>
            )}
            {byPosture.safe > 0 && (
              <span className={`${styles.stripBadge} ${styles.stripBadgeSafe}`}>
                {byPosture.safe} {MERGE_POSTURE_LABEL.safe}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function RepoHealthDashboard({
  repoId,
  owner,
  repo,
  viewModel,
  prsFetchError,
  scansFetchError,
}: Props) {
  const hasErrors = prsFetchError || scansFetchError;

  return (
    <div className={styles.dashboard}>
      <SummaryStrip
        totalPRs={viewModel.totalPRs}
        coveredPRs={viewModel.coveredPRs}
        byPosture={viewModel.byPosture}
      />

      {hasErrors && (
        <div className={styles.errorBanner} role="alert">
          {prsFetchError && (
            <p>Could not load pull requests: {prsFetchError}</p>
          )}
          {scansFetchError && (
            <p>Could not load scan data: {scansFetchError}</p>
          )}
        </div>
      )}

      {viewModel.rows.length === 0 && !hasErrors && (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>No open pull requests</h2>
          <p className={styles.emptyBody}>
            There are no open pull requests for{" "}
            <strong>
              {owner}/{repo}
            </strong>
            . Scans run automatically when a PR changes a lockfile via the
            GitHub App.
          </p>
          <Link
            href="/getting-started"
            style={{
              fontSize: "var(--ms-text-md)",
              color: "var(--ms-color-accent-alt)",
            }}
          >
            Set up scanning →
          </Link>
        </div>
      )}

      {viewModel.rows.length > 0 && (
        <ul
          className={styles.prList}
          role="list"
          aria-label={`Pull requests for ${repoId}`}
        >
          {viewModel.rows.map((row) => (
            <PRHealthCard key={row.pr.number} row={row} />
          ))}
        </ul>
      )}

      {viewModel.hasMore && (
        <p
          style={{
            fontSize: "var(--ms-text-xs)",
            color: "var(--ms-color-text-muted)",
            padding: "var(--ms-space-sm) var(--ms-space-md)",
          }}
        >
          Showing first 30 open PRs. Additional PRs may exist.
        </p>
      )}
    </div>
  );
}
