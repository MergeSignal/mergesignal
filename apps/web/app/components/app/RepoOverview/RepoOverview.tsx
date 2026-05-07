import Link from "next/link";
import styles from "./RepoOverview.module.css";

type Scan = {
  id: string;
  status: string;
  totalScore: number | null;
  layerSecurity: number | null;
  layerMaintainability: number | null;
  layerEcosystem: number | null;
  layerUpgradeImpact: number | null;
  createdAt: string;
  decision: string | null;
};

type AlertCounts = {
  high: number;
  medium: number;
  low: number;
};

type Props = {
  repoId: string;
  latestScan: Scan | null;
  alertCounts: AlertCounts;
};

export function RepoOverview({ latestScan, alertCounts }: Props) {
  if (!latestScan) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>No scans yet</h2>
        <p className={styles.emptyBody}>
          This repository has not been scanned yet. Connect it via the GitHub
          App or run a scan using the CLI to see health data here.
        </p>
        <Link href="/getting-started" className={styles.ctaLink}>
          Get started →
        </Link>
      </div>
    );
  }

  const totalScore = latestScan.totalScore;
  const scannedAt = new Date(latestScan.createdAt);
  const totalAlerts = alertCounts.high + alertCounts.medium + alertCounts.low;

  return (
    <div className={styles.overview}>
      {/* Score + decision row */}
      <div className={styles.topRow}>
        <div className={styles.scoreBlock}>
          <span className={styles.scoreLabel}>Risk score</span>
          <span
            className={`${styles.scoreValue} ${scoreClass(totalScore, styles)}`}
          >
            {totalScore !== null ? Math.round(totalScore) : "—"}
          </span>
        </div>

        <div className={styles.metaBlock}>
          <StatusBadge status={latestScan.status} />
          {latestScan.decision ? (
            <DecisionBadge decision={latestScan.decision} />
          ) : null}
          <span className={styles.lastScan}>
            Last scan{" "}
            <time dateTime={latestScan.createdAt}>
              {scannedAt.toLocaleString()}
            </time>
          </span>
        </div>
      </div>

      {/* Alert severity breakdown */}
      <section className={styles.section} aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className={styles.sectionTitle}>
          Alerts
          {totalAlerts > 0 ? (
            <span className={styles.totalAlerts}>{totalAlerts} total</span>
          ) : null}
        </h2>
        <div className={styles.alertGrid}>
          <AlertCount label="High" count={alertCounts.high} level="high" />
          <AlertCount
            label="Medium"
            count={alertCounts.medium}
            level="medium"
          />
          <AlertCount label="Low" count={alertCounts.low} level="low" />
        </div>
      </section>

      {/* Layer score breakdown */}
      <section className={styles.section} aria-labelledby="layers-heading">
        <h2 id="layers-heading" className={styles.sectionTitle}>
          Score breakdown
        </h2>
        <div className={styles.layerGrid}>
          <LayerRow label="Security" score={latestScan.layerSecurity} />
          <LayerRow
            label="Maintainability"
            score={latestScan.layerMaintainability}
          />
          <LayerRow label="Ecosystem" score={latestScan.layerEcosystem} />
          <LayerRow
            label="Upgrade impact"
            score={latestScan.layerUpgradeImpact}
          />
        </div>
      </section>

      {/* Link to full scan detail */}
      <div className={styles.scanLinkRow}>
        <Link href={`/scan/${latestScan.id}`} className={styles.scanLink}>
          View full scan report →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function scoreClass(
  score: number | null,
  s: Record<string, string | undefined>,
): string {
  if (score === null) return "";
  if (score > 60) return s.scoreHigh ?? "";
  if (score > 30) return s.scoreMedium ?? "";
  return s.scoreLow ?? "";
}

function AlertCount({
  label,
  count,
  level,
}: {
  label: string;
  count: number;
  level: "high" | "medium" | "low";
}) {
  return (
    <div className={`${styles.alertCard} ${styles[`alert_${level}`]}`}>
      <span className={styles.alertCount}>{count}</span>
      <span className={styles.alertLabel}>{label}</span>
    </div>
  );
}

function LayerRow({ label, score }: { label: string; score: number | null }) {
  const display = score !== null ? Math.round(score) : null;
  const pct = score !== null ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div className={styles.layerRow}>
      <span className={styles.layerLabel}>{label}</span>
      <div className={styles.layerBar}>
        <div className={styles.layerBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${styles.layerScore} ${scoreClass(score, styles)}`}>
        {display !== null ? display : "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "done"
      ? styles.statusDone
      : status === "running"
        ? styles.statusRunning
        : status === "failed"
          ? styles.statusFailed
          : styles.statusQueued;
  return <span className={`${styles.badge} ${cls}`}>{status}</span>;
}

function DecisionBadge({ decision }: { decision: string }) {
  const cls =
    decision === "safe"
      ? styles.decisionSafe
      : decision === "risky"
        ? styles.decisionRisky
        : styles.decisionReview;
  return <span className={`${styles.badge} ${cls}`}>{decision}</span>;
}
