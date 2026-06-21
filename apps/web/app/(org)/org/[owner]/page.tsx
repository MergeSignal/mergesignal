import Link from "next/link";
import { MSDataTable, MSTD } from "../../../components/shared/MSTable/MSTable";
import {
  MSCard,
  MSCardMuted,
  MSCardNote,
} from "../../../components/shared/MSCard/MSCard";
import { ShellTitlebar } from "../../../components/shared/layout/SiteChrome/ShellTitlebar";
import { ApiError, serverApiGet } from "../../../../lib/api";
import { requireOrgAccess } from "../../../../lib/org-guard";
import styles from "./OrgDashboard.module.css";

type Dashboard = {
  owner: string;
  summary: {
    repoCount: number;
    scoredRepoCount: number;
    avgScore: number | null;
    worst: Array<{ repoId: string; repositoryHealthScore: number }>;
  };
  repos: Array<{
    repoId: string;
    latest: {
      scanId: string;
      status: string;
      repositoryHealthScore: number | null;
      methodologyVersion: string | null;
      createdAt: string;
    };
    deltaRepositoryHealthScore?: number | null;
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
  await requireOrgAccess(owner);
  const sp = (await searchParams) ?? {};
  const limit = sp.limit ? Number(sp.limit) : 50;

  let data: Dashboard;
  try {
    data = await serverApiGet<Dashboard>(
      `/org/${encodeURIComponent(owner)}/dashboard?limit=${limit}`,
    );
  } catch (err: unknown) {
    const errorText =
      err instanceof ApiError ? (err.body ?? err.message) : String(err);
    return (
      <>
        <ShellTitlebar title="Org dashboard" subtitle={owner} />
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </>
    );
  }

  // 6. Empty state
  const hasRepos = data.repos.length > 0;

  return (
    <>
      <ShellTitlebar title="Org dashboard" subtitle={owner} />
      {/* 5. Highlight worst repos - moved to top */}
      {data.summary.worst.length > 0 && (
        <MSCard as="div" title="⚠️ High Risk Repositories" padding={true}>
          <div className={styles.warningCard}>
            <MSCardMuted>
              These repositories have the highest risk scores and require
              immediate attention:
            </MSCardMuted>
            <div className={styles.worstReposList}>
              {data.summary.worst.map((w) => (
                <div key={w.repoId} className={styles.worstRepoItem}>
                  <code className={styles.worstRepoName}>{w.repoId}</code>
                  <ScoreBadge score={w.repositoryHealthScore} />
                </div>
              ))}
            </div>
          </div>
        </MSCard>
      )}

      {/* Summary Cards */}
      <div className={styles.grid}>
        <MSCard as="div" title="Total Repos">
          <div className={styles.metricValue}>{data.summary.repoCount}</div>
        </MSCard>
        <MSCard as="div" title="Scored Repos">
          <div className={styles.metricValue}>
            {data.summary.scoredRepoCount}
          </div>
        </MSCard>
        <MSCard as="div" title="Avg Score">
          <div className={styles.metricValue}>
            {data.summary.avgScore !== null
              ? Math.round(data.summary.avgScore)
              : "n/a"}
          </div>
          {/* 8. Score distribution visualization */}
          {data.summary.avgScore !== null && (
            <div className={styles.scoreBar}>
              <div
                className={styles.scoreBarFill}
                style={{ width: `${data.summary.avgScore}%` }}
              />
            </div>
          )}
        </MSCard>
      </div>

      {/* 6. Empty State */}
      {!hasRepos ? (
        <MSCard as="div" title="No Repositories Yet">
          <div className={styles.emptyState}>
            <MSCardMuted>
              No repositories have been scanned for this organization yet.
            </MSCardMuted>
            <MSCardNote as="p">
              To get started, scan a repository using the CLI or API.
            </MSCardNote>
          </div>
        </MSCard>
      ) : (
        <>
          {/* Repository Table */}
          <MSDataTable
            headers={["Repo", "Score", "Δ", "Status", "Last scan", ""]}
            rows={data.repos.map((r) => (
              <tr key={r.repoId} className={styles.tableRow}>
                <MSTD>
                  <code>{r.repoId}</code>
                </MSTD>
                <MSTD>
                  <ScoreBadge score={r.latest.repositoryHealthScore} />
                </MSTD>
                <MSTD>
                  <DeltaBadge delta={r.deltaRepositoryHealthScore} />
                </MSTD>
                <MSTD>
                  <StatusBadge status={r.latest.status} />
                </MSTD>
                <MSTD>{new Date(r.latest.createdAt).toLocaleString()}</MSTD>
                <MSTD>
                  <Link
                    href={`/scan/${r.latest.scanId}`}
                    className={styles.openLink}
                  >
                    Open
                  </Link>
                </MSTD>
              </tr>
            ))}
          />
        </>
      )}
    </>
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
      <span className={`${styles.scoreBadge} ${badgeClass}`}>
        {Math.round(score)}
      </span>
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (typeof delta !== "number") {
    return <span className={styles.deltaNeutral}>-</span>;
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

  return <span className={styles.deltaNeutral}>-</span>;
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
