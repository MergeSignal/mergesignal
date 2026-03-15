import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { DataTable, TD } from "../../_components/ui/Table";
import { Card, cardStyles } from "../../_components/ui/Card";
import { apiGet, ApiError } from "../../../lib/api";
import styles from "./OrgDashboard.module.css";

type Dashboard = {
  owner: string;
  summary: {
    repoCount: number;
    scoredRepoCount: number;
    avgScore: number | null;
    worst: Array<{ repoId: string; totalScore: number }>;
  };
  repos: Array<{
    repoId: string;
    latest: {
      scanId: string;
      status: string;
      totalScore: number | null;
      methodologyVersion: string | null;
      createdAt: string;
    };
    deltaTotalScore?: number | null;
  }>;
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string }>;
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { owner } = await params;
  const sp = (await searchParams) ?? {};
  const limit = sp.limit ? Number(sp.limit) : 50;

  let data: Dashboard;
  try {
    data = await apiGet<Dashboard>(`/org/${encodeURIComponent(owner)}/dashboard?limit=${limit}`);
  } catch (err: unknown) {
    const errorText = err instanceof ApiError ? err.body ?? err.message : String(err);
    return (
      <AppShell title="Org dashboard" subtitle={owner} owner={owner}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Org dashboard"
      subtitle={owner}
      owner={owner}
    >
      {/* Summary Cards */}
      <div className={styles.grid}>
        <Card as="div" title="Total Repos">
          <div className={styles.metricValue}>{data.summary.repoCount}</div>
        </Card>
        <Card as="div" title="Scored Repos">
          <div className={styles.metricValue}>{data.summary.scoredRepoCount}</div>
        </Card>
        <Card as="div" title="Avg Score">
          <div className={styles.metricValue}>
            {data.summary.avgScore !== null ? Math.round(data.summary.avgScore) : "n/a"}
          </div>
        </Card>
      </div>

      {/* Repository Table */}
      <DataTable
        headers={["Repo", "Score", "Δ", "Status", "Last scan", ""]}
        rows={data.repos.map((r) => (
          <tr key={r.repoId}>
            <TD>
              <code>{r.repoId}</code>
            </TD>
            <TD>
              <ScoreBadge score={r.latest.totalScore} />
            </TD>
            <TD>
              <DeltaBadge delta={r.deltaTotalScore} />
            </TD>
            <TD>
              <StatusBadge status={r.latest.status} />
            </TD>
            <TD>{new Date(r.latest.createdAt).toLocaleString()}</TD>
            <TD>
              <Link href={`/scan/${r.latest.scanId}`}>Open</Link>
            </TD>
          </tr>
        ))}
      />

      {data.summary.worst.length > 0 ? (
        <div className={cardStyles.note}>
          Worst scores:{" "}
          {data.summary.worst.map((w, i) => (
            <span key={w.repoId}>
              <code>{w.repoId}</code> ({w.totalScore})
              {i < data.summary.worst.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span>n/a</span>;
  }

  let badgeClass = styles.scoreGood;
  if (score > 60) {
    badgeClass = styles.scoreHigh;
  } else if (score > 30) {
    badgeClass = styles.scoreMedium;
  }

  return (
    <span className={styles.scoreCell}>
      <span className={`${styles.scoreBadge} ${badgeClass}`}>{Math.round(score)}</span>
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (typeof delta !== "number") {
    return <span className={styles.deltaNeutral}>—</span>;
  }

  if (delta > 0) {
    return (
      <span className={`${styles.deltaCell} ${styles.deltaPositive}`}>
        ⬆ +{delta}
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span className={`${styles.deltaCell} ${styles.deltaNegative}`}>
        ⬇ {delta}
      </span>
    );
  }

  return <span className={styles.deltaNeutral}>—</span>;
}

function StatusBadge({ status }: { status: string }) {
  let badgeClass = styles.statusQueued;
  let icon = "⏳";

  switch (status) {
    case "done":
      badgeClass = styles.statusDone;
      icon = "✓";
      break;
    case "running":
      badgeClass = styles.statusRunning;
      icon = "◉";
      break;
    case "failed":
      badgeClass = styles.statusFailed;
      icon = "✗";
      break;
    case "queued":
      badgeClass = styles.statusQueued;
      icon = "⏳";
      break;
  }

  return (
    <span className={`${styles.statusBadge} ${badgeClass}`}>
      {status === "running" ? <span className={styles.spinner} /> : icon}
      {status}
    </span>
  );
}

