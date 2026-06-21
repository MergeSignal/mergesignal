import {
  MSDataTable,
  MSTD,
} from "../../../../components/shared/MSTable/MSTable";
import {
  MSCard,
  MSCardMuted,
} from "../../../../components/shared/MSCard/MSCard";
import { ShellTitlebar } from "../../../../components/shared/layout/SiteChrome/ShellTitlebar";
import styles from "./Benchmark.module.css";
import typo from "../../../../_styles/typography.module.css";
import { ApiError, serverApiGet } from "../../../../../lib/api";
import { requireOrgAccess } from "../../../../../lib/org-guard";

type Summary = {
  scope: "global" | "owner";
  owner?: string;
  repoCount: number;
  avgRepositoryHealthScore: number | null;
  medianRepositoryHealthScore: number | null;
  p10RepositoryHealthScore: number | null;
  p25RepositoryHealthScore: number | null;
  p75RepositoryHealthScore: number | null;
  p90RepositoryHealthScore: number | null;
  worst: Array<{
    repoId: string;
    repositoryHealthScore: number;
    createdAt: string;
  }>;
  best: Array<{
    repoId: string;
    repositoryHealthScore: number;
    createdAt: string;
  }>;
};

export default async function Page({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner } = await params;
  await requireOrgAccess(owner);

  let global: Summary;
  let org: Summary;
  try {
    [global, org] = await Promise.all([
      serverApiGet<Summary>(`/benchmark/global`),
      serverApiGet<Summary>(`/benchmark/org/${encodeURIComponent(owner)}`),
    ]);
  } catch (err: unknown) {
    const errorText =
      err instanceof ApiError ? (err.body ?? err.message) : String(err);
    return (
      <>
        <ShellTitlebar title="Benchmark" subtitle={owner} />
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </>
    );
  }

  return (
    <>
      <ShellTitlebar
        title="Benchmark"
        subtitle="Higher repository health score means higher relative risk."
      />
      <h2 className={typo.h2Tight}>Global distribution</h2>
      <SummaryCards s={global} />

      <h2 className={typo.h2}>Org distribution</h2>
      <SummaryCards s={org} />

      <h2 className={typo.h2}>Org worst (highest risk)</h2>
      <RepoList rows={org.worst} />

      <h2 className={typo.h2}>Org best (lowest risk)</h2>
      <RepoList rows={org.best} />
    </>
  );
}

function SummaryCards({ s }: { s: Summary }) {
  const items: Array<[string, string | number]> = [
    ["repos", s.repoCount],
    ["avg", s.avgRepositoryHealthScore ?? "n/a"],
    ["median", s.medianRepositoryHealthScore ?? "n/a"],
    ["p10", s.p10RepositoryHealthScore ?? "n/a"],
    ["p25", s.p25RepositoryHealthScore ?? "n/a"],
    ["p75", s.p75RepositoryHealthScore ?? "n/a"],
    ["p90", s.p90RepositoryHealthScore ?? "n/a"],
  ];

  return (
    <div className={styles.grid}>
      {items.map(([k, v]) => (
        <MSCard
          key={k}
          as="div"
          title={k}
          subtitle={<b className={styles.metricValue}>{v}</b>}
        >
          <div />
        </MSCard>
      ))}
    </div>
  );
}

function RepoList({
  rows,
}: {
  rows: Array<{
    repoId: string;
    repositoryHealthScore: number;
    createdAt: string;
  }>;
}) {
  if (!rows.length)
    return <MSCardMuted as="div">No scored repos yet.</MSCardMuted>;
  return (
    <MSDataTable
      headers={["Repo", "Score", "Last scan"]}
      rows={rows.map((r) => (
        <tr key={r.repoId}>
          <MSTD>
            <code>{r.repoId}</code>
          </MSTD>
          <MSTD>
            <b>{r.repositoryHealthScore}</b>
          </MSTD>
          <MSTD>{new Date(r.createdAt).toLocaleString()}</MSTD>
        </tr>
      ))}
    />
  );
}
