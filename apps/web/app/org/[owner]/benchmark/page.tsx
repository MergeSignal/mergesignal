import { AppShell } from "../../../_components/AppShell";
import { DataTable, TD } from "../../../_components/ui/Table";
import { Card, cardStyles } from "../../../_components/ui/Card";
import styles from "./Benchmark.module.css";
import typo from "../../../_styles/typography.module.css";
import { ApiError, serverApiGet } from "../../../../lib/api";
import { requireOrgAccess } from "../../../../lib/org-guard";

type Summary = {
  scope: "global" | "owner";
  owner?: string;
  repoCount: number;
  avgTotalScore: number | null;
  medianTotalScore: number | null;
  p10TotalScore: number | null;
  p25TotalScore: number | null;
  p75TotalScore: number | null;
  p90TotalScore: number | null;
  worst: Array<{ repoId: string; totalScore: number; createdAt: string }>;
  best: Array<{ repoId: string; totalScore: number; createdAt: string }>;
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
      <AppShell title="Benchmark" subtitle={owner} owner={owner}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Benchmark"
      subtitle="Higher totalScore means higher relative risk."
      owner={owner}
    >
      <h2 className={typo.h2Tight}>Global distribution</h2>
      <SummaryCards s={global} />

      <h2 className={typo.h2}>Org distribution</h2>
      <SummaryCards s={org} />

      <h2 className={typo.h2}>Org worst (highest risk)</h2>
      <RepoList rows={org.worst} />

      <h2 className={typo.h2}>Org best (lowest risk)</h2>
      <RepoList rows={org.best} />
    </AppShell>
  );
}

function SummaryCards({ s }: { s: Summary }) {
  const items: Array<[string, string | number]> = [
    ["repos", s.repoCount],
    ["avg", s.avgTotalScore ?? "n/a"],
    ["median", s.medianTotalScore ?? "n/a"],
    ["p10", s.p10TotalScore ?? "n/a"],
    ["p25", s.p25TotalScore ?? "n/a"],
    ["p75", s.p75TotalScore ?? "n/a"],
    ["p90", s.p90TotalScore ?? "n/a"],
  ];

  return (
    <div className={styles.grid}>
      {items.map(([k, v]) => (
        <Card
          key={k}
          as="div"
          title={k}
          subtitle={<b className={styles.metricValue}>{v}</b>}
        >
          <div />
        </Card>
      ))}
    </div>
  );
}

function RepoList({
  rows,
}: {
  rows: Array<{ repoId: string; totalScore: number; createdAt: string }>;
}) {
  if (!rows.length)
    return <div className={cardStyles.muted}>No scored repos yet.</div>;
  return (
    <DataTable
      headers={["Repo", "Score", "Last scan"]}
      rows={rows.map((r) => (
        <tr key={r.repoId}>
          <TD>
            <code>{r.repoId}</code>
          </TD>
          <TD>
            <b>{r.totalScore}</b>
          </TD>
          <TD>{new Date(r.createdAt).toLocaleString()}</TD>
        </tr>
      ))}
    />
  );
}
